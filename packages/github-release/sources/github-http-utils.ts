import {
	type Ident,
	type Cache,
	httpUtils,
	hashUtils,
	miscUtils,
	structUtils,
	type Configuration,
	type IdentHash,
	type Project,
	type Descriptor,
	nodeUtils,
} from "@yarnpkg/core";
import {type Filename, type PortablePath, ppath, xfs} from "@yarnpkg/fslib";

import {PROTOCOL, PROTOCOL_INTERNAL} from "./types.js";

export type Options = httpUtils.Options & {
	cache?: Cache;
};

// We use 2 different caches:
// - an in-memory cache, to avoid hitting the disk and the network more than once per process for each package
// - an on-disk cache, for exact version matches and to avoid refetching the metadata if the resource hasn't changed on the server

const PACKAGE_DISK_METADATA_CACHE = new Map<
	IdentHash,
	Promise<CachedMetadata | null>
>();
const PACKAGE_NETWORK_METADATA_CACHE = new Map<
	IdentHash,
	Promise<CachedMetadata>
>();

function toCacheFilename(ident: Ident): Filename;
function toCacheFilename(ident: Ident): string {
	if (ident.scope !== null) {
		return `@${ident.scope}-${ident.name}-${ident.scope.length}`;
	} else {
		return ident.name;
	}
}

async function loadRepoReleaseMetadataFromDisk(
	ident: Ident,
	cachedPath: PortablePath,
) {
	return await miscUtils.getFactoryWithDefault(
		PACKAGE_DISK_METADATA_CACHE,
		ident.identHash,
		async () => {
			try {
				return (await xfs.readJsonPromise(cachedPath)) as CachedMetadata;
			} catch {
				return null;
			}
		},
	);
}

interface LoadRepoReleaseMetadataFromNetworkOptions {
	configuration: Configuration;
	cached: CachedMetadata | null;
	cachedPath: PortablePath;
}

async function loadRepoReleaseMetadataFromNetwork(
	ident: Ident,
	{
		configuration,
		cached,
		cachedPath,
	}: LoadRepoReleaseMetadataFromNetworkOptions,
) {
	return await miscUtils.getFactoryWithDefault(
		PACKAGE_NETWORK_METADATA_CACHE,
		ident.identHash,
		async () => {
			const releases: Array<RepoReleaseMetadata["releases"][number]> = [];

			const headers: NonNullable<httpUtils.Options["headers"]> = {
				accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2026-03-10",
			};
			const auth = getAuthenticationHeader(configuration);
			if (auth) {
				headers["authorization"] = auth;
			}

			let page = 1;
			while (true) {
				const response = await httpUtils.request(
					`https://api.github.com/repos/${ident.scope!}/${ident.name}/releases?page=${page}`,
					null,
					{
						method: httpUtils.Method.GET,
						configuration,
						jsonResponse: true,
						headers,
					},
				);
				const body = response.body as typeof releases;

				if (
					cached &&
					page === 1 &&
					cached.lastModified === body[0].updated_at
				) {
					return cached;
				}

				releases.push(...response.body);
				if (![response.headers.link].flat().join("|").includes('rel="next"')) {
					break;
				}
				page++;
			}

			const result: CachedMetadata = {
				lastStoredAt: new Date().toISOString(),
				lastModified: releases[0]?.updated_at,
				metadata: {releases: releases.map(pickReleaseMetadata)},
			};

			// We don't need the cache in this process anymore (since we stored everything in both memory caches),
			// so we can run the part that writes the cache to disk in the background.
			Promise.resolve()
				.then(async () => {
					// We append the PID because it is guaranteed that this code is only run once per process for a given ident
					const cachedPathTemp =
						`${cachedPath}-${process.pid}.tmp` as PortablePath;

					await xfs.mkdirPromise(ppath.dirname(cachedPathTemp), {
						recursive: true,
					});
					await xfs.writeJsonPromise(cachedPathTemp, result, {compact: true});

					// Doing a rename is important to ensure the cache is atomic
					await xfs.renamePromise(cachedPathTemp, cachedPath);
				})
				.catch(() => {
					// It's not dramatic if the cache can't be written, so we just ignore the error
				});

			return result;
		},
	);
}

/**
 * Caches and returns the package metadata for the given ident.
 *
 * Note: This function only caches and returns specific fields from the metadata.
 * If you need other fields, use the uncached {@link get} or consider whether it would make more sense to extract
 * the fields from the on-disk packages using the linkers or from the fetch results using the fetchers.
 */
export async function getRepoMetadata(
	ident: Ident,
	{project}: {project: Project},
): Promise<RepoReleaseMetadata> {
	const {configuration} = project;

	const cachedPath = ppath.join(
		getMetadataFolder(configuration),
		toCacheFilename(ident),
	);

	let cached: CachedMetadata | null = null;

	// We bypass the on-disk cache for security reasons if the lockfile needs to be refreshed,
	// since most likely the user is trying to validate the metadata using hardened mode.
	if (!project.lockfileNeedsRefresh) {
		cached = await loadRepoReleaseMetadataFromDisk(ident, cachedPath);
	}

	return (
		await loadRepoReleaseMetadataFromNetwork(ident, {
			configuration,
			cached,
			cachedPath,
		})
	).metadata;
}

export async function getReleaseMetadata(
	ident: Ident,
	id: number | null,
	tag_name: string,
	{project}: {project: Project},
): Promise<ReleaseMetadata> {
	const {releases} = await getRepoMetadata(ident, {project});

	const release = id
		? releases.find((release) => release.id === id)
		: releases.find((release) => release.tag_name === tag_name);

	if (!release) {
		throw new Error(`Unable to find release ${tag_name} (id: ${id})`);
	}

	return release;
}

export async function getReleaseAsset(
	ident: Ident,
	id: number,
	{project}: {project: Project},
) {
	const {browser_download_url, content_type} = (await httpUtils.get(
		`https://api.github.com/repos/${ident.scope}/${ident.name}/releases/assets/${id}`,
		{configuration: project.configuration, jsonResponse: true},
	)) as {browser_download_url: string; content_type: string | null};

	const content = (await httpUtils.get(browser_download_url, {
		configuration: project.configuration,
		jsonResponse: false,
	})) as Buffer;

	return {content, content_type};
}

interface CachedMetadata {
	metadata: RepoReleaseMetadata;
	lastModified?: string;
	lastStoredAt: string;
}

const CACHED_FIELDS = [
	"name",
	"tag_name",
	"id",
	"created_at",
	"updated_at",

	"assets[].name",
	"assets[].id",
	"assets[].content_type",
] as const;

export interface ReleaseMetadata {
	name: string;
	tag_name: string;
	id: number;
	created_at: string;
	updated_at: string;

	assets: Array<{
		name: string;
		id: number;
		content_type?: string;
	}>;
}

export interface RepoReleaseMetadata {
	releases: Array<ReleaseMetadata>;
}

function pickReleaseMetadata({
	assets,
	created_at,
	id,
	name,
	tag_name,
	updated_at,
}: RepoReleaseMetadata["releases"][number]): RepoReleaseMetadata["releases"][number] {
	return {
		assets: assets.map(pickAssetMetadata),
		created_at,
		id,
		name,
		tag_name,
		updated_at,
	};
}

function pickAssetMetadata({
	id,
	name,
	content_type,
}: RepoReleaseMetadata["releases"][number]["assets"][number]): RepoReleaseMetadata["releases"][number]["assets"][number] {
	return {id, name, content_type};
}

/**
 * Used to invalidate the on-disk cache when the format changes.
 */
const CACHE_KEY = hashUtils.makeHash(`time`, ...CACHED_FIELDS).slice(0, 6);

function getMetadataFolder(configuration: Configuration) {
	return ppath.join(
		configuration.get(`globalFolder`),
		`metadata/github.com-releases/${CACHE_KEY}`,
	);
}

function getAuthenticationHeader(configuration: Configuration) {
	const token = configuration.get('githubRelease').get('token');
	return token ? `Bearer ${token}` : null;
}

type Libc = "glibc" | "musl";

export function extractAssetDependencies(
	ident: Ident,
	release: ReleaseMetadata,
	params: any,
): [string, Descriptor, NodeJS.Platform, NodeJS.Architecture, Libc | null][] {
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
		} else if (
			/(?:\b|_)(?:arm|armhf|armv[6-9](hf)?)(?:\b|_)/.test(asset.name)
		) {
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

		let name = `@${ident.scope}/${ident.name}-${platform}-${architecture}`;
		if (libc) {
			name += `-${libc}`;
		}

		const range = structUtils.makeRange({
			protocol: PROTOCOL_INTERNAL,
			selector: release.tag_name,
			source: null,
			params: {
				id: String(asset.id),
				binary: params.binary ?? ident.name,
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
