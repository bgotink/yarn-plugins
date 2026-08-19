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
} from "@yarnpkg/core";
import {type Filename, type PortablePath, ppath, xfs} from "@yarnpkg/fslib";

import {PROTOCOL} from "./types.js";

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
			const auth = await getAuthenticationHeader(configuration);
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
	{cache, project}: {cache?: Cache; project: Project},
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

		// If in offline mode, we change the metadata to pretend that the only versions available
		// on the registry are the ones currently stored in our cache. This is to avoid the resolver
		// to try to resolve to a version that we wouldn't be able to download.
		if (cached && configuration.get(`enableOfflineMode`)) {
			const copy = structuredClone(cached.metadata);

			if (cache) {
				copy.releases = copy.releases.filter((release) => {
					const locator = structUtils.makeLocator(
						ident,
						structUtils.makeRange({
							protocol: PROTOCOL,
							selector: release.tag_name,
							source: null,
							params: {id: String(release.id)},
						}),
					);
					const mirrorPath = cache.getLocatorMirrorPath(locator);

					return mirrorPath && xfs.existsSync(mirrorPath);
				});
			}

			return copy;
		}
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
	{cache, project}: {cache?: Cache; project: Project},
): Promise<ReleaseMetadata> {
	const {releases} = await getRepoMetadata(ident, {cache, project});

	const release = id
		? releases.find((release) => release.id === id)
		: releases.find((release) => release.tag_name === tag_name);

	if (!release) {
		throw new Error(`Unable to find release ${tag_name} (id: ${id})`);
	}

	return release;
}

export async function getReleaseAsset(ident: Ident, id: number, { project }: { project: Project}) {
	const {browser_download_url, content_type} = await httpUtils.get(
		`https://api.github.com/repos/${ident.scope}/${ident.name}/releases/assets/${id}`,
		{configuration: project.configuration, jsonResponse: true}
	) as { browser_download_url: string; content_type: string | null; }

	const content = await httpUtils.get(browser_download_url, { configuration: project.configuration, jsonResponse: false }) as Buffer;

	return { content, content_type };
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

async function getAuthenticationHeader(configuration: Configuration) {
	// TODO support github token
	return null;
}
