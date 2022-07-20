import {BaseCommand} from '@yarnpkg/cli';
import {Configuration} from '@yarnpkg/core';
import {
  Filename,
  NativePath,
  npath,
  PortablePath,
  ppath,
  xfs,
  ZipFS,
} from '@yarnpkg/fslib';
import {getLibzipPromise} from '@yarnpkg/libzip';
import {Option, Usage} from 'clipanion';
import {brotliDecompressSync} from 'zlib';

import {hook} from '../../hook';

export class CreateYarCommand extends BaseCommand {
  static paths = [['sdlx', 'create-yar']];

  output = Option.String('--output,-o', 'sdlx.sh', {
    description: 'Path to the self-unpacking script file to create',
  });

  quiet = Option.Boolean('-q,--quiet', false, {
    description:
      'Only report critical errors instead of printing the full install logs',
  });

  includeCache = Option.Boolean('--include-cache', false, {
    description: 'Include the cache in the output script',
  });

  pkgs = Option.Array('--package,-p', []);

  command = Option.String();

  args = Option.Proxy();

  static usage: Usage = {
    description: 'Create a runnable yarn archive',
  };

  async execute(): Promise<number | void> {
    // Disable telemetry to prevent each `dlx` call from counting as a project
    Configuration.telemetry = null;

    return await xfs.mktempPromise(async baseDir => {
      const tmpDir = ppath.join(baseDir, `dlx-${process.pid}` as Filename);
      const yarDir = ppath.join(baseDir, `yar-${process.pid}` as Filename);

      await Promise.all([xfs.mkdirPromise(tmpDir), xfs.mkdirPromise(yarDir)]);

      const targetYarnrc = ppath.join(yarDir, Filename.rc);
      const projectCwd = await Configuration.findProjectCwd(
        this.context.cwd,
        Filename.lockfile,
      );

      const sourceYarnrc =
        projectCwd !== null ? ppath.join(projectCwd, Filename.rc) : null;
      const relativeYarnPath = '.yarn/releases/yar.cjs' as PortablePath;
      await xfs.mkdirPromise(
        ppath.join(yarDir, ppath.dirname(relativeYarnPath)),
        {recursive: true},
      );
      await xfs.copyFilePromise(
        npath.toPortablePath(process.argv[1]),
        ppath.join(yarDir, relativeYarnPath),
      );
      await xfs.chmodPromise(ppath.join(yarDir, relativeYarnPath), 0o775);

      if (sourceYarnrc !== null && xfs.existsSync(sourceYarnrc)) {
        await xfs.copyFilePromise(sourceYarnrc, targetYarnrc);
        const pluginsToCopy: [from: PortablePath, to: PortablePath][] = [];

        await Configuration.updateConfiguration(yarDir, current => {
          const nextConfiguration: {[key: string]: unknown} = {
            ...current,
            enableTelemetry: false,
          };

          nextConfiguration.yarnPath = `%%YAR%%/${relativeYarnPath}`;
          nextConfiguration.cacheFolder = '%%YAR%%/.yarn/cache';

          nextConfiguration.enableGlobalCache = !this.includeCache;

          if (Array.isArray(current.plugins)) {
            nextConfiguration.plugins = current.plugins.map((plugin, i) => {
              const sourcePath: NativePath =
                typeof plugin === 'string' ? plugin : plugin.path;
              const absoluteSourcePath = npath.isAbsolute(sourcePath)
                ? sourcePath
                : npath.resolve(
                    npath.fromPortablePath(projectCwd!),
                    sourcePath,
                  );

              const remapPath = `.yarn/plugins/plugin-${i}.cjs` as PortablePath;
              pluginsToCopy.push([
                npath.toPortablePath(absoluteSourcePath),
                remapPath,
              ]);

              if (typeof plugin === 'string') {
                return `%%YAR%%/${remapPath}`;
              } else {
                return {path: `%%YAR%%/${remapPath}`, spec: plugin.spec};
              }
            });
          }

          return nextConfiguration;
        });

        if (pluginsToCopy.length) {
          await xfs.mkdirPromise(
            ppath.join(yarDir, '.yarn/plugins' as PortablePath),
            {recursive: true},
          );
          await Promise.all(
            pluginsToCopy.map(([from, to]) =>
              xfs.copyFilePromise(from, ppath.join(yarDir, to)),
            ),
          );
        }
      } else {
        await xfs.writeFilePromise(
          targetYarnrc,
          `cacheFolder: %%YAR%%/.yarn/cache\nenableGlobalCache: ${!this
            .includeCache}\nenableTelemetry: false\nyarnPath: %%YAR%%${relativeYarnPath}\n`,
        );
      }

      await Promise.all([
        xfs.writeFilePromise(ppath.join(tmpDir, Filename.manifest), `{}\n`),
        xfs.writeFilePromise(ppath.join(tmpDir, Filename.lockfile), ``),

        xfs
          .readFilePromise(targetYarnrc, 'utf8')
          .then(content =>
            xfs.writeFilePromise(
              ppath.join(tmpDir, Filename.rc),
              content.replace(/%%YAR%%/g, ppath.relative(tmpDir, yarDir)),
            ),
          ),
      ]);

      const addExitCode = await this.cli.run([`add`, `--`, ...this.pkgs], {
        cwd: tmpDir,
        quiet: this.quiet,
      });
      if (addExitCode !== 0) return addExitCode;

      const zip = new ZipFS(null, {
        libzip: await getLibzipPromise(),
        level: 'mixed',
      });

      await zip.copyPromise(PortablePath.root, yarDir, {
        baseFs: xfs,
      });

      await zip.copyPromise(
        ppath.join(PortablePath.root, Filename.manifest),
        ppath.join(tmpDir, Filename.manifest),
        {
          baseFs: xfs,
        },
      );

      await zip.copyPromise(
        ppath.join(PortablePath.root, Filename.lockfile),
        ppath.join(tmpDir, Filename.lockfile),
        {
          baseFs: xfs,
        },
      );

      await zip.writeJsonPromise('/command.json' as PortablePath, [
        this.command,
        ...this.args,
      ]);

      if (!this.quiet) this.context.stdout.write(`\n`);

      await xfs.writeFilePromise(
        npath.toPortablePath(this.output),
        createWrapper(zip.getBufferAndClose()),
      );
      await xfs.chmodPromise(npath.toPortablePath(this.output), 0o775);
    });
  }
}

function createWrapper(data: Buffer) {
  return `#!/usr/bin/env bash

jsFile() {
  cat << "YAR_EOF"
${brotliDecompressSync(Buffer.from(hook, 'base64')).toString()}
YAR_EOF
}

exec node <(jsFile) "$0" "$@"

### DATA ###
${data.toString('base64')}
`;
}
