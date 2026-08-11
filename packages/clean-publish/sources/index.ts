import type {Plugin} from "@yarnpkg/core";
import type {Hooks} from "@yarnpkg/plugin-pack";

export default {
	hooks: {
		beforeWorkspacePacking(workspace, rawManifest: any) {
			// Remove all scripts and development info
			delete rawManifest.scripts;
			delete rawManifest.packageManager;
			delete rawManifest.devDependencies;
			delete rawManifest.resolutions;
		},
	},
} as Plugin<Hooks>;
