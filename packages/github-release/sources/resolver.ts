import {
	LinkType,
	miscUtils,
	semverUtils,
	structUtils,
	type Descriptor,
	type Locator,
	type Package,
	type ResolveOptions,
	type Resolver,
} from "@yarnpkg/core";
import * as semver from "semver";

import * as githubHttpUtils from "./github-http-utils.js";
import {PROTOCOL, PROTOCOL_INTERNAL} from "./types.js";
import {PortablePath, ppath} from "@yarnpkg/fslib";

function selectMatchingVersions<T extends {tag_name: string}>(
	range: semver.Range,
	data: T[],
) {
	return miscUtils.mapAndFilter(data, (value) => {
		try {
			const version = new semverUtils.SemVer(value.tag_name);
			if (range.test(version)) {
				return {value, version};
			}
		} catch {}

		return miscUtils.mapAndFilter.skip;
	});
}

export class GitHubReleaseResolver implements Resolver {
	supportsDescriptor(descriptor: Descriptor): boolean {
		if (descriptor.scope == null || !descriptor.range.startsWith(PROTOCOL)) {
			return false;
		}

		const {selector} = structUtils.parseRange(descriptor.range);
		if (!semverUtils.validRange(selector)) {
			return false;
		}

		return true;
	}

	supportsLocator(locator: Locator): boolean {
		if (locator.scope == null || !locator.reference.startsWith(PROTOCOL)) {
			return false;
		}

		const {selector, params} = structUtils.parseRange(locator.reference);
		if (!semver.valid(selector) || typeof params?.id !== "string") {
			return false;
		}

		return true;
	}

	shouldPersistResolution(): boolean {
		return true;
	}

	bindDescriptor(descriptor: Descriptor): Descriptor {
		return descriptor;
	}

	getResolutionDependencies(): Record<string, Descriptor> {
		return {};
	}

	async getCandidates(
		descriptor: Descriptor,
		_dependencies: Record<string, Package>,
		{project, fetchOptions}: ResolveOptions,
	): Promise<Array<Locator>> {
		const {selector, params} = structUtils.parseRange(descriptor.range);
		const range = semverUtils.validRange(selector);
		if (range === null) {
			throw new Error(`Expected a valid range, got ${selector}`);
		}

		const {releases} = await githubHttpUtils.getRepoMetadata(descriptor, {
			project,
			cache: fetchOptions?.cache,
		});

		return selectMatchingVersions(range, releases)
			.sort((a, b) => -a.version.compare(b.version))
			.map(({value}) =>
				structUtils.makeLocator(
					descriptor,
					structUtils.makeRange({
						protocol: PROTOCOL,
						selector: value.tag_name,
						source: null,
						params: {...params, id: String(value.id)},
					}),
				),
			);
	}

	async getSatisfying(
		descriptor: Descriptor,
		_dependencies: Record<string, Package>,
		locators: Array<Locator>,
		_opts: ResolveOptions,
	): Promise<{locators: Array<Locator>; sorted: boolean}> {
		const range = semverUtils.validRange(
			structUtils.parseRange(descriptor.range).selector,
		);
		if (range === null)
			throw new Error(`Expected a valid range, got ${descriptor.range}`);

		const candidates = miscUtils.mapAndFilter(locators, (locator) => {
			if (locator.identHash !== descriptor.identHash)
				return miscUtils.mapAndFilter.skip;

			const parsedRange = structUtils.tryParseRange(locator.reference, {
				requireProtocol: PROTOCOL,
			});
			if (!parsedRange || typeof parsedRange.params?.id !== "string")
				return miscUtils.mapAndFilter.skip;

			return {locator, version: new semverUtils.SemVer(parsedRange.selector)};
		});

		const sortedResults = selectMatchingVersions(
			range,
			candidates.map(({locator, version}) => ({
				locator,
				tag_name: version.raw,
			})),
		)
			.sort((a, b) => -a.version.compare(b.version))
			.map(({value}) => value.locator);

		return {
			locators: sortedResults,
			sorted: true,
		};
	}

	async resolve(
		locator: Locator,
		{project, fetchOptions}: ResolveOptions,
	): Promise<Package> {
		const {params, selector} = structUtils.parseRange(locator.reference);
		const id = typeof params?.id === "string" ? parseInt(params.id) : null;

		const release = await githubHttpUtils.getReleaseMetadata(
			locator,
			id,
			selector,
			{project, cache: fetchOptions?.cache},
		);

		const bin = new Map<string, PortablePath>();

		if (typeof params?.binary === "string") {
			bin.set(
				ppath.basename(params.binary as PortablePath),
				"./bin-0.js" as PortablePath,
			);
		} else if (params?.binary?.length) {
			for (const [index, binary] of params.binary.entries()) {
				bin.set(
					ppath.basename(binary as PortablePath),
					`./bin-${index}.js` as PortablePath,
				);
			}
		} else {
			bin.set(locator.name, "./bin-0.js" as PortablePath);
		}

		const dependencies = extractAssetDependencies(
			locator,
			release,
			Array.from(bin.keys()),
			params,
		);

		return {
			...locator,
			version: release.tag_name,

			bin,

			dependencies: new Map(
				dependencies.map(([, dependency]) => [
					dependency.identHash,
					dependency,
				]),
			),
			dependenciesMeta: new Map(
				dependencies.map(
					([dependency]) =>
						[dependency, new Map([[null, {optional: true}]])] as const,
				),
			),

			conditions: undefined,
			languageName: "node",
			linkType: LinkType.HARD,
			peerDependencies: new Map(),
			peerDependenciesMeta: new Map(),
		};
	}
}

type Libc = "glibc" | "musl";

export function extractAssetDependencies(
	locator: Locator,
	release: githubHttpUtils.ReleaseMetadata,
	binary: string[],
	params: any,
): [string, Descriptor, ...unknown[]][] {
	const dependencies: [
		string,
		Descriptor,
		NodeJS.Platform,
		NodeJS.Architecture,
		Libc | null,
	][] = [];
	const linuxPlatforms = new Map<NodeJS.Architecture, Set<Libc | null>>();

	for (const asset of release.assets) {
		let strip_components = params?.strip_components;
		switch (asset.content_type) {
			case "application/gzip":
				if (!asset.name.endsWith(".tar.gz")) {
					continue;
				}
				// fall through
			case "application/x-gtar":
				strip_components = params?.strip_components_tar ?? strip_components;
				break;
			case "application/zip":
				strip_components = params?.strip_components_zip ?? strip_components;
				break;
			default:
				continue;
		}

		let platform: NodeJS.Platform;
		if (/(?:\b|_)(?:apple|darwin)(?:\b|_)/i.test(asset.name)) {
			platform = "darwin";
		} else if (/(?:\b|_)(?:linux)(?:\b|_)/i.test(asset.name)) {
			platform = "linux";
		} else if (/(?:\b|_)(?:windows)(?:\b|_)/i.test(asset.name)) {
			platform = "win32";
		} else {
			continue;
		}

		let architecture: NodeJS.Architecture;
		if (/(?:\b|_)(?:x86_64|x64|amd64)(?:\b|_)/.test(asset.name)) {
			architecture = "x64";
		} else if (/(?:\b|_)(?:ia32|x86|i[3-9]86|386)(?:\b|_)/.test(asset.name)) {
			architecture = "ia32";
		} else if (/(?:\b|_)(?:arm64|aarch64)(?:\b|_)/.test(asset.name)) {
			architecture = "arm64";
		} else if (/(?:\b|_)(?:arm|armhf|armv[6-9](hf)?)(?:\b|_)/.test(asset.name)) {
			architecture = "arm";
		} else {
			continue;
		}

		let libc: Libc | null = null;
		if (platform === "linux") {
			if (/(?:\b|_)(?:musl)(?:\b|_)/.test(asset.name)) {
				libc = "musl";
			} else if (/(?:\b|_)(?:gnu|glibc)(?:\b|_)/.test(asset.name)) {
				libc = "glibc";
			}

			miscUtils.getSetWithDefault(linuxPlatforms, architecture).add(libc);
		}

		let name = `@${locator.scope}/${locator.name}-${platform}-${architecture}`;
		if (libc) {
			name += `-${libc}`;
		}

		const range = structUtils.makeRange({
			protocol: PROTOCOL_INTERNAL,
			selector: release.tag_name,
			source: null,
			params: {
				id: String(asset.id),
				binary,
				platform,
				architecture,
				...(libc ? {libc} : undefined),
				...(strip_components ? {strip_components} : undefined),
			},
		});

		dependencies.push([
			name,
			structUtils.makeDescriptor(structUtils.parseIdent(name), range),
			platform,
			architecture,
			libc,
		]);
	}

	for (const [architecture, libcs] of linuxPlatforms) {
		if (libcs.size === 1 && libcs.has("musl")) {
			// only one libc is supported: musl
			// -> this probably means it's a binary with musl libc statically linked
			//    which means it should also work on platforms with glibc, so we can
			//    drop the libc requirement
			const dependency = dependencies.find(
				(dep) =>
					dep[2] === "linux" && dep[3] === architecture && dep[4] === "musl",
			)!;
			const range = structUtils.parseRange(dependency[1].range);

			delete range.params!.libc;

			dependency[1] = structUtils.makeDescriptor(
				structUtils.makeIdent(
					dependency[1].scope,
					dependency[1].name.slice(0, -5 /* "-musl".length */),
				),
				structUtils.makeRange(range),
			);
			dependency[0] = structUtils.stringifyIdent(dependency[1]);
		}
	}

	return dependencies;
}

export class GitHubReleaseAssetResolver implements Resolver {
	supportsDescriptor(descriptor: Descriptor): boolean {
		return descriptor.range.startsWith(PROTOCOL_INTERNAL);
	}

	supportsLocator(locator: Locator): boolean {
		return locator.reference.startsWith(PROTOCOL_INTERNAL);
	}

	shouldPersistResolution(): boolean {
		return true;
	}

	bindDescriptor(descriptor: Descriptor): Descriptor {
		return descriptor;
	}

	getResolutionDependencies(): Record<string, Descriptor> {
		return {};
	}

	async getCandidates(descriptor: Descriptor): Promise<Array<Locator>> {
		const range = structUtils.parseRange(descriptor.range);

		if (!isFinite(parseInt(String(range.params!.id)))) {
			return [];
		} else {
			return [structUtils.makeLocator(descriptor, descriptor.range)];
		}
	}

	async getSatisfying(
		descriptor: Descriptor,
		_dependencies: Record<string, Package>,
		locators: Array<Locator>,
	): Promise<{locators: Array<Locator>; sorted: boolean}> {
		return {
			locators: locators.filter(
				(locator) =>
					locator.identHash === descriptor.identHash &&
					locator.reference === descriptor.range,
			),
			sorted: true,
		};
	}

	async resolve(locator: Locator): Promise<Package> {
		const {params, selector} = structUtils.parseRange(locator.reference);

		const bin = new Map<string, PortablePath>(
			[params!.binary!]
				.flat()
				.map((binary) => [
					ppath.basename(binary as PortablePath),
					`.${ppath.resolve(PortablePath.root, binary)}` as PortablePath,
				]),
		);

		let conditions = `os=${params!.platform} & cpu=${params!.architecture}`;
		if (params!.libc) {
			conditions += ` & libc=${params!.libc}`;
		}

		return {
			...locator,
			version: selector,

			bin,
			conditions,

			languageName: "node",
			linkType: LinkType.HARD,
			dependencies: new Map(),
			dependenciesMeta: new Map(),
			peerDependencies: new Map(),
			peerDependenciesMeta: new Map(),
		};
	}
}
