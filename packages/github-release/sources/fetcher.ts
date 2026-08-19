import {
	MessageName,
	ReportError,
	structUtils,
	tgzUtils,
	type Fetcher,
	type FetchOptions,
	type FetchResult,
	type Locator,
} from "@yarnpkg/core";
import {PortablePath, ppath, xfs, JailFS} from "@yarnpkg/fslib";
import {ZipFS} from "@yarnpkg/libzip";

import * as githubHttpUtils from "./github-http-utils.js";
import {PROTOCOL, PROTOCOL_INTERNAL} from "./types.js";

const bin = `\
#!/usr/bin/env node
import {execFileSync} from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

import pkg from "./package.json" with {type: "json"};

let dependencyName = \`\${pkg.name}-\${process.platform}-\${process.arch}\`;

if (!pkg.optionalDependencies[dependencyName] && process.platform === "linux") {
	let header;
  try {
    header = fs.readFileSync("/usr/bin/ldd");
  } catch {}

  let libc;
  if (header) {
    if (header && (header.includes("GLIBC") || header.includes("GNU libc") || header.includes("GNU C Library")))
      libc = "glibc";
    if (header && header.includes("musl")) {
      libc = "musl";
    }
  }

  if (!libc) {
	  const report = process.report?.getReport() ?? {};
	  const sharedObjects = report.sharedObjects ?? [];

	  // Matches the first group if libc, second group if musl
	  const libcRegExp = /\\/(?:(ld-linux-|[^/]+-linux-gnu\\/)|(libc.musl-|ld-musl-))/;

		for (const entry of sharedObjects) {
	    const match = entry.match(libcRegExp);
	    if (!match) {
	     continue;
			}

	    if (match[1])
	      libc = "glibc";
	    if (match[2])
	      libc = "musl";

			break;
		}
  }

  if (!libc) {
  	process.stderr.write("Assertion failed: Expected the libc variant to have been detected\\n");
		process.exit(1);
  }

  dependencyName += \`-\${libc}\`;
}

if (!pkg.optionalDependencies[dependencyName]) {
	process.stderr.write("Unsupported platform\\n");
	process.exit(1);
}

const self = import.meta.filename;
let binaryName;
for (const [n, p] of Object.entries(pkg.bin)) {
	if (path.join(import.meta.dirname, p) === self) {
		binaryName = n;
	}
}

if (!binaryName) {
	console.error("Assertion Error: failed to find binary name\\n");
	process.exit(1);
}

const platformPkgUrl = import.meta.resolve(\`\${dependencyName}/package.json\`);
const {default: platformPkg} = await import(platformPkgUrl, {with: {type: "json"}});

const binaryPath = platformPkg?.bin?.[binaryName];
if (!binaryPath) {
	console.error("Assertion Error: failed to find binary path\\n");
	process.exit(1);
}

const resolvedBinaryPath = path.join(path.dirname(fileURLToPath(platformPkgUrl)), binaryPath);

execFileSync(resolvedBinaryPath, process.argv.slice(2), {
	stdio: 'inherit',
});
`;

export class GitHubReleaseFetcher implements Fetcher {
	supports(locator: Locator): boolean {
		return locator.reference.startsWith(PROTOCOL);
	}

	getLocalPath(): PortablePath | null {
		return null;
	}

	async fetch(locator: Locator, opts: FetchOptions): Promise<FetchResult> {
		const range = structUtils.parseRange(locator.reference);
		const {binary, id} = range.params!;

		const release = await githubHttpUtils.getReleaseMetadata(
			locator,
			parseInt(id as string),
			range.selector,
			opts,
		);

		const tmpFolder = await xfs.mktempPromise();
		const packageFs = new JailFS(tmpFolder);

		const prefixPath = structUtils.getIdentVendorPath(locator);
		const pkgName = structUtils.stringifyIdent(locator);

		await packageFs.mkdirPromise(prefixPath, {recursive: true});
		await packageFs.writeJsonPromise(
			`${prefixPath}/package.json` as PortablePath,
			{
				name: pkgName,
				type: "module",
				bin: Object.fromEntries(
					[binary ?? locator.name]
						.flat()
						.map((name, index) => [
							ppath.basename(name as PortablePath),
							`./bin-${index}.js`,
						]),
				),
				optionalDependencies: Object.fromEntries(
					githubHttpUtils
						.extractAssetDependencies(locator, release, range.params)
						.map(([name, descriptor]) => [name, descriptor.range]),
				),
			},
		);

		await Promise.all(
			Array.from(Array.isArray(binary) ? binary : {length: 1}, (_, i) =>
				packageFs.writeFilePromise(
					`${prefixPath}/bin-${i}.js` as PortablePath,
					bin,
				),
			),
		);

		return {
			packageFs,
			prefixPath,
			// No checksums, otherwise every time the bin.js script changes
			// this would cause invalid checksums
			checksum: null,
		};
	}
}

export class GitHubReleaseAssetFetcher implements Fetcher {
	supports(locator: Locator): boolean {
		return locator.reference.startsWith(PROTOCOL_INTERNAL);
	}

	getLocalPath(): PortablePath | null {
		return null;
	}

	async fetch(locator: Locator, opts: FetchOptions): Promise<FetchResult> {
		const expectedChecksum = opts.checksums.get(locator.locatorHash) || null;

		const [packageFs, releaseFs, checksum] =
			await opts.cache.fetchPackageFromCache(locator, expectedChecksum, {
				onHit: () => opts.report.reportCacheHit(locator),
				onMiss: () =>
					opts.report.reportCacheMiss(
						locator,
						`${structUtils.prettyLocator(opts.project.configuration, locator)} can't be found in the cache and will be fetched from the remote registry`,
					),
				loader: () => this.#fetchFromNetwork(locator, opts),
				...opts.cacheOptions,
			});

		return {
			packageFs,
			releaseFs,
			prefixPath: structUtils.getIdentVendorPath(locator),
			checksum,
		};
	}

	async #fetchFromNetwork(
		locator: Locator,
		opts: FetchOptions,
	): Promise<ZipFS> {
		const range = structUtils.parseRange(locator.reference);
		const {id, strip_components, binary, platform, architecture, libc} =
			range.params!;

		const suffix = libc
			? `-${platform}-${architecture}-${libc}`
			: `-${platform}-${architecture}`;
		const repoName = structUtils.makeIdent(
			locator.scope,
			locator.name.slice(0, -suffix.length),
		);

		const {content, content_type} = await githubHttpUtils.getReleaseAsset(
			repoName,
			parseInt(id as string),
			opts,
		);

		const stripComponents =
			typeof strip_components === "string"
				? parseInt(strip_components)
				: undefined;

		const prefixPath = structUtils.getIdentVendorPath(locator);
		let packageFs;
		switch (content_type) {
			case "":

			case "application/gzip":
			case "application/x-gtar":
				packageFs = await tgzUtils.convertToZip(content, {
					configuration: opts.project.configuration,
					prefixPath,
					stripComponents,
				});
				break;
			case "application/zip":
				const originalPackageFs = new ZipFS(content);

				let originalPath = PortablePath.root;
				if (stripComponents) {
					for (let i = 0; i < stripComponents; i++) {
						const entries =
							await originalPackageFs.readdirPromise(originalPath);
						if (entries.length !== 1) {
							throw new ReportError(
								MessageName.UNNAMED,
								`Invalid strip_components value ${stripComponents}, found ${entries.length} entries in ${originalPath} but expected to find 1`,
							);
						}

						originalPath = ppath.join(originalPath, entries[0]);
					}
				}

				packageFs = new ZipFS(null);
				await packageFs.copyPromise(prefixPath, originalPath, {
					baseFs: originalPackageFs,
					stableSort: true,
					stableTime: true,
				});

				originalPackageFs.discardAndClose();

				break;
			default:
				throw new Error(`Unexpected content type ${content_type}`);
		}

		const extension =
			typeof platform === "string" && platform === "win32" ? ".exe" : "";

		await packageFs.writeJsonPromise(
			`${prefixPath}/package.json` as PortablePath,
			{
				name: structUtils.stringifyIdent(locator),
				version: range.selector,
				preferUnplugged: true,

				bin: Object.fromEntries(
					[binary!]
						.flat()
						.map((b) => [
							ppath.basename(b as PortablePath),
							`.${ppath.resolve(PortablePath.root, b)}${extension}`,
						]),
				),

				os: [platform!].flat(),
				cpu: [architecture].flat(),
				libc: libc ? [libc].flat() : undefined,
			},
		);

		return packageFs;
	}
}
