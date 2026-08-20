import {type miscUtils, SettingsType, type Plugin} from "@yarnpkg/core";

import {GitHubReleaseAssetFetcher, GitHubReleaseFetcher} from "./fetcher.js";
import {GitHubReleaseAssetResolver, GitHubReleaseResolver} from "./resolver.js";

declare module "@yarnpkg/core" {
	interface ConfigurationValueMap {
		githubRelease: miscUtils.ToMapValue<{
			token: string | null;
		}>;
	}
}

const plugin: Plugin = {
	configuration: {
		githubRelease: {
			type: SettingsType.SHAPE,
			description: "Configuration for the github-release plugin",
			properties: {
				token: {
					type: SettingsType.SECRET,
					isNullable: true,
					default: null,
					description:
						"GitHub token to use in authentication for GitHub.com, to prevent rate limits",
				},
			},
		},
	},
	fetchers: [GitHubReleaseAssetFetcher, GitHubReleaseFetcher],
	resolvers: [GitHubReleaseAssetResolver, GitHubReleaseResolver],
};

export default plugin;
