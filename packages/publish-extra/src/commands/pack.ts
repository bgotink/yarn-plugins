import {BaseCommand, WorkspaceRequiredError} from '@yarnpkg/cli';
import {
  Configuration,
  MessageName,
  StreamReport,
  Workspace,
  formatUtils,
  structUtils,
  Project,
} from '@yarnpkg/core';
import {Filename, npath, ppath, xfs} from '@yarnpkg/fslib';
import {packUtils} from '@yarnpkg/plugin-pack';
import {Command, Option, Usage} from 'clipanion';

export default class PackCommand extends BaseCommand {
  static paths = [[`pack`]];

  static usage: Usage = Command.Usage({
    description: `generate a tarball from a folder`,
    details: `
      This command will turn given folder into a compressed archive suitable for publishing. The archive will by default be stored at the current working directory (\`package.tgz\`).
      
      If the \`-o,---out\` is set the archive will be created at the specified path. The \`%s\` and \`%v\` variables can be used within the path and will be respectively replaced by the package name and version.

      Packaging a folder doesn't run any \`prepack\` or \`postpack\` scripts.
    `,
    examples: [
      [`Create an archive from the "dist" folder`, `yarn pack dist`],
      [
        `List the files that would be made part of archive of the "output" folder`,
        `yarn pack --dry-run output`,
      ],
      [
        `Name and output the archive in a dedicated folder`,
        `yarn pack --out /artifacts/%s-%v.tgz ./dist`,
      ],
    ],
  });

  installIfNeeded = Option.Boolean(`--install-if-needed`, false, {
    description: `Run a preliminary \`yarn install\` if the package contains build scripts`,
  });

  dryRun = Option.Boolean(`-n,--dry-run`, false, {
    description: `Print the file paths without actually generating the package archive`,
  });

  json = Option.Boolean(`--json`, false, {
    description: `Format the output as an NDJSON stream`,
  });

  out = Option.String(`-o,--out`, {
    description: `Create the archive at the specified path`,
  });

  // Legacy option
  filename = Option.String(`--filename`, {hidden: true});

  folder = Option.String({
    name: 'folder',
  });

  async execute() {
    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins,
    );
    const {project} = await Project.find(configuration, this.context.cwd);

    const folder = ppath.resolve(npath.toPortablePath(this.folder));
    let workspace = project.tryWorkspaceByCwd(folder);
    if (workspace == null) {
      workspace = new Workspace(folder, {project});
      await workspace.setup();
    }

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    const out = this.out ?? this.filename;

    const target = ppath.resolve(
      this.context.cwd,
      typeof out !== `undefined`
        ? interpolateOutputName(out, workspace)
        : (`package.tgz` as Filename),
    );

    const report = await StreamReport.start(
      {
        configuration,
        stdout: this.context.stdout,
        json: this.json,
      },
      async report => {
        report.reportJson({base: npath.fromPortablePath(workspace!.cwd)});

        const files = await packUtils.genPackList(workspace!);

        for (const file of files) {
          report.reportInfo(null, npath.fromPortablePath(file));
          report.reportJson({location: npath.fromPortablePath(file)});
        }

        if (!this.dryRun) {
          const pack = await packUtils.genPackStream(workspace!, files);
          const write = xfs.createWriteStream(target);

          pack.pipe(write);

          await new Promise(resolve => {
            write.on(`finish`, resolve);
          });

          report.reportInfo(
            MessageName.UNNAMED,
            `Package archive generated in ${formatUtils.pretty(
              configuration,
              target,
              formatUtils.Type.PATH,
            )}`,
          );
          report.reportJson({output: npath.fromPortablePath(target)});
        }
      },
    );

    return report.exitCode();
  }
}

function interpolateOutputName(name: string, workspace: Workspace) {
  const interpolated = name
    .replace(`%s`, prettyWorkspaceIdent(workspace))
    .replace(`%v`, prettyWorkspaceVersion(workspace));

  return npath.toPortablePath(interpolated);
}

function prettyWorkspaceIdent(workspace: Workspace) {
  if (workspace.manifest.name !== null) {
    return structUtils.slugifyIdent(workspace.manifest.name);
  } else {
    return `package`;
  }
}

function prettyWorkspaceVersion(workspace: Workspace) {
  if (workspace.manifest.version !== null) {
    return workspace.manifest.version;
  } else {
    return `unknown`;
  }
}
