import type {Plugin} from "@yarnpkg/core";

import {GitHubReleaseAssetFetcher, GitHubReleaseFetcher} from "./fetcher.js";
import {GitHubReleaseAssetResolver, GitHubReleaseResolver} from "./resolver.js";

const plugin: Plugin = {
	fetchers: [GitHubReleaseAssetFetcher, GitHubReleaseFetcher],
	resolvers: [GitHubReleaseAssetResolver, GitHubReleaseResolver],
};

export default plugin;
