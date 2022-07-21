try {
  module.exports = require('../../../packages/publish-extra/bundles/@yarnpkg/plugin-publish-extra.js');
} catch {
  module.exports = require('../../../packages/publish-extra/bin/@yarnpkg/plugin-publish-extra.js');
}
