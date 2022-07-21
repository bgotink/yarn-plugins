import {BaseCommand} from '@yarnpkg/cli';
import {
  Configuration,
  MessageName,
  Project,
  ReportError,
  StreamReport,
  miscUtils,
  Manifest,
  tgzUtils,
  Workspace,
  Report,
} from '@yarnpkg/core';
import {CwdFS, npath, ppath, xfs} from '@yarnpkg/fslib';
import {
  npmConfigUtils,
  npmHttpUtils,
  npmPublishUtils,
} from '@yarnpkg/plugin-npm';
import {packUtils} from '@yarnpkg/plugin-pack';
import {Command, Option, Usage, UsageError} from 'clipanion';

export default class NpmPublishCommand extends BaseCommand {
  static paths = [[`npm`, `publish`]];

  static usage: Usage = Command.Usage({
    category: `Npm-related commands`,
    description: `publish a folder or tarball to the npm registry`,
    details: `
      This command will pack the given folder into a fresh archive or take the givne tarball and upload it to the npm registry.

      The package will by default be attached to the \`latest\` tag on the registry, but this behavior can be overriden by using the \`--tag\` option.
      
      Note that for legacy reasons scoped packages are by default published with an access set to \`restricted\` (aka "private packages"). This requires you to register for a paid npm plan. In case you simply wish to publish a public scoped package to the registry (for free), just add the \`--access public\` flag. This behavior can be enabled by default through the \`npmPublishAccess\` settings.

      Publishing a tarball or folder doesn't run any \`prepack\`, \`prepublish\`, or \`postpack\` scripts.
    `,
    examples: [
      [
        `Publish the previously packaged \`package.tgz\``,
        `yarn npm publish package.tgz`,
      ],
      [`Publish the "dist" folder`, `yarn npm publish ./dist`],
    ],
  });

  access = Option.String(`--access`, {
    description: `The access for the published package (public or restricted)`,
  });

  tag = Option.String(`--tag`, `latest`, {
    description: `The tag on the registry that the package should be attached to`,
  });

  tolerateRepublish = Option.Boolean(`--tolerate-republish`, false, {
    description: `Warn and exit when republishing an already existing version of a package`,
  });

  otp = Option.String(`--otp`, {
    description: `The OTP token to use with the command`,
  });

  source = Option.String({
    name: 'source',
  });

  async #publishFolder(report: Report, project: Project) {
    const source = ppath.resolve(npath.toPortablePath(this.source));
    let workspace = project.tryWorkspaceByCwd(source);
    if (workspace == null) {
      workspace = new Workspace(source, {project});
      await workspace.setup();
    }

    report.reportJson({base: npath.fromPortablePath(workspace.cwd)});

    const files = await packUtils.genPackList(workspace);

    for (const file of files) {
      report.reportInfo(null, npath.fromPortablePath(file));
      report.reportJson({location: npath.fromPortablePath(file)});
    }

    const pack = await packUtils.genPackStream(workspace, files);
    const buffer = await miscUtils.bufferStream(pack);

    await this.#publish(report, project, workspace.manifest, workspace, buffer);
  }

  async #publishFile(report: Report, project: Project) {
    const file = await xfs.readFilePromise(npath.toPortablePath(this.source));
    const manifest = await getManifestFromTarball(file);

    return await this.#publish(report, project, manifest, null, file);
  }

  async #publish(
    report: Report,
    project: Project,
    manifest: Manifest,
    workspace: Workspace | null,
    tarball: Buffer,
  ) {
    if (manifest.private) {
      throw new UsageError(`Private workspaces cannot be published`);
    }
    if (manifest.name === null || manifest.version === null) {
      throw new UsageError(
        `Workspaces must have valid names and versions to be published on an external registry`,
      );
    }

    const {name: ident, version} = manifest;
    const registry = npmConfigUtils.getPublishRegistry(manifest, {
      configuration: project.configuration,
    });

    // Not an error if --tolerate-republish is set
    if (this.tolerateRepublish) {
      try {
        const registryData = await npmHttpUtils.get(
          npmHttpUtils.getIdentUrl(ident),
          {
            configuration: project.configuration,
            registry,
            ident,
            jsonResponse: true,
          },
        );

        if (!Object.prototype.hasOwnProperty.call(registryData, `versions`))
          throw new ReportError(
            MessageName.REMOTE_INVALID,
            `Registry returned invalid data for - missing "versions" field`,
          );

        if (
          Object.prototype.hasOwnProperty.call(registryData.versions, version)
        ) {
          report.reportWarning(
            MessageName.UNNAMED,
            `Registry already knows about version ${version}; skipping.`,
          );
          return;
        }
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      } catch (err: any) {
        if (err.originalError?.response?.statusCode !== 404) {
          throw err;
        }
      }
    }

    const gitHead = workspace
      ? await npmPublishUtils.getGitHead(workspace.cwd)
      : undefined;
    const body = await npmPublishUtils.makePublishBody(
      // Of everything in this plugin, this is by far the most hacky
      workspace ??
        ({
          manifest,
          project,
        } as Workspace),
      tarball,
      {
        access: this.access,
        tag: this.tag,
        registry,
        gitHead,
      },
    );

    await npmHttpUtils.put(npmHttpUtils.getIdentUrl(ident), body, {
      configuration: project.configuration,
      registry,
      ident,
      otp: this.otp,
      jsonResponse: true,
    });

    report.reportInfo(MessageName.UNNAMED, `Package archive published`);
  }

  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins,
    );
    const {project} = await Project.find(configuration, this.context.cwd);

    await project.restoreInstallState();

    const report = await StreamReport.start(
      {
        configuration,
        stdout: this.context.stdout,
      },
      async report => {
        let isFolder;
        try {
          isFolder = (
            await xfs.statPromise(npath.toPortablePath(this.source))
          ).isDirectory();
        } catch (e) {
          if ((e as NodeJS.ErrnoException).code === 'ENOENT') {
            throw new UsageError(`The source parameter has to exist`);
          }

          throw e;
        }

        if (isFolder) {
          await this.#publishFolder(report, project);
        } else {
          await this.#publishFile(report, project);
        }
      },
    );

    return report.exitCode();
  }
}

export function getManifestFromTarball(buffer: Buffer): Promise<Manifest> {
  return xfs.mktempPromise(async folder => {
    const fs = new CwdFS(folder);
    await tgzUtils.extractArchiveTo(buffer, fs, {stripComponents: 1});

    return await Manifest.fromFile(Manifest.fileName, {baseFs: fs});
  });
}
