import {BaseCommand, WorkspaceRequiredError} from '@yarnpkg/cli';
import {
  Cache,
  Configuration,
  Project,
  scriptUtils,
  ThrowReport,
} from '@yarnpkg/core';
import {npath, PortablePath, xfs} from '@yarnpkg/fslib';
import {Command} from 'clipanion';

export class RunYarCommand extends BaseCommand {
  @Command.Proxy()
  args: string[] = [];

  @Command.Path('sdlx', 'run-yar')
  async execute(): Promise<number | void> {
    // Disable telemetry to prevent each `dlx` call from counting as a project
    Configuration.telemetry = null;

    const definedCommand = (await xfs.readJsonPromise(
      './command.json' as PortablePath,
    )) as string[];

    const configuration = await Configuration.find(
      this.context.cwd,
      this.context.plugins,
    );

    const {project, workspace} = await Project.find(
      configuration,
      this.context.cwd,
    );
    const cache = await Cache.find(configuration, {immutable: true});

    if (!workspace)
      throw new WorkspaceRequiredError(project.cwd, this.context.cwd);

    await project.install({cache, report: new ThrowReport(), immutable: true});

    const args = [...definedCommand, ...this.args];
    const command = args.shift()!;

    return await scriptUtils.executeWorkspaceAccessibleBinary(
      workspace,
      command,
      args,
      {
        cwd: npath.toPortablePath(this.cwd!),
        stdin: this.context.stdin,
        stdout: this.context.stdout,
        stderr: this.context.stderr,
      },
    );
  }
}
