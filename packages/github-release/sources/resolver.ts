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
import { extractAssetDependencies } from "./github-http-utils.js";

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
		opts: ResolveOptions,
	): Promise<Array<Locator>> {
		const {selector, params} = structUtils.parseRange(descriptor.range);
		const range = semverUtils.validRange(selector);
		if (range === null) {
			throw new Error(`Expected a valid range, got ${selector}`);
		}

		const {releases} = await githubHttpUtils.getRepoMetadata(descriptor, opts);

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
		opts: ResolveOptions,
	): Promise<Package> {
		const {params, selector} = structUtils.parseRange(locator.reference);
		const id = typeof params?.id === "string" ? parseInt(params.id) : null;

		const release = await githubHttpUtils.getReleaseMetadata(
			locator,
			id,
			selector,
			opts,
		);

		const bin = new Map<string, PortablePath>(
			[params?.binary ?? locator.name]
				.flat()
				.map((binary, index) => [
					ppath.basename(binary as PortablePath),
					`./bin-${index}.js` as PortablePath,
				])
		);

		const dependencies = extractAssetDependencies(
			locator,
			release,
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
