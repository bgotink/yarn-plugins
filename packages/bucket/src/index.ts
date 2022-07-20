import {Plugin, structUtils, Workspace} from '@yarnpkg/core';
import {Hooks as PackHooks} from '@yarnpkg/plugin-pack';

import {BucketResolver, protocol} from './resolver';
import {resolveDescriptor} from './utils';

const plugin: Plugin<PackHooks> = {
  hooks: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    beforeWorkspacePacking(workspace: Workspace, rawManifest: any): void {
      for (const dependencyType of ['dependencies', 'devDependencies']) {
        for (const descriptor of workspace.manifest
          .getForScope(dependencyType)
          .values()) {
          if (structUtils.parseRange(descriptor.range).protocol !== protocol) {
            continue;
          }

          const {
            descriptor: {range},
            peerModifier = '',
          } = resolveDescriptor(descriptor, workspace);
          const name = structUtils.stringifyIdent(descriptor);

          // Add if-check here in case another plugin has e.g. removed devDependencies
          if (rawManifest[dependencyType]?.[name]) {
            rawManifest[dependencyType][name] = range;
          }

          if (
            dependencyType === 'devDependencies' &&
            typeof rawManifest.peerDependencies?.[name] === 'string'
          ) {
            const peerRange = workspace.manifest
              .getForScope('peerDependencies')
              .get(descriptor.identHash);

            if (peerRange && /^[~^]?\*$/.test(peerRange.range)) {
              rawManifest.peerDependencies[name] = `${
                peerRange.range.length > 1 ? peerRange.range[0] : peerModifier
              }${structUtils.parseRange(range).selector}`;
            }
          }
        }
      }
    },
  },
  resolvers: [BucketResolver],
};

export default plugin;
