import {Plugin} from '@yarnpkg/core';

import SdlxByPackagesCommand from './commands/sdlx';
import {CreateYarCommand} from './commands/sdlx/create-yar';
import {RunYarCommand} from './commands/sdlx/run-yar';

const plugin: Plugin = {
  commands: [SdlxByPackagesCommand, CreateYarCommand, RunYarCommand],
};

export default plugin;
