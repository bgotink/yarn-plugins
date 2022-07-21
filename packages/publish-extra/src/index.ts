import {Plugin} from '@yarnpkg/core';

import NpmPublishCommand from './commands/npm/publish';
import PackCommand from './commands/pack';

const plugin: Plugin = {
  commands: [PackCommand, NpmPublishCommand],
};

export default plugin;
