# Clean publish

This yarn plugin removes certain development-time fields from `package.json` files before publishing.
Since yarn doesn't have a script for "run as part of `yarn` in the repository while developing but not when installing as dependency", this plugin allows using a simple `postinstall` script which will get stripped at publish time.
