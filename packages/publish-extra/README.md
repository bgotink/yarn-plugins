# Yarn plugin publish-extra

This plugin adds support to yarn 3+ for packaging arbitrary folders and publishing arbitrary folders or pre-packaged tarballs.

Differences:

| `yarn pack` and `yarn npm publish`                                                       | `yarn pack <folder>` and `yarn npm publish <folder or file>` |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------ |
| Built into yarn itself.                                                                  | Provided in this plugin.                                     |
| Only supports packing/publishing workspaces in the yarn project.                         | Supports packing/publishing arbitrary folders.               |
| Runs `prepack` and `postpack` as well as `prepublish` lifecycle scripts when publishing. | Doesn't run any lifecycle scripts.                           |

## What's the use case?

See [yarnpkg/berry#705](https://github.com/yarnpkg/berry/issues/705).

## Status

This plugin is functional, but not thoroughly tested.
