# GitHub release

This plugin adds a new `github-release:` protocol to Yarn, giving you the ability to install native packages directly from GitHub releases.

Here's an example: to install `mdbook`, which can be found in the repository `rust-lang/mdBook`, version 0.5.4:

```sh
yarn add --dev @rust-lang/mdbook@github-release:0.5.4
```

This makes use of the fact that GitHub repository names are case insensitive, and packages prefer a lowercase name.
Using the actual repository name also works, but it requires passing the `binary` parameter:

```sh
yarn add --dev @rust-lang/mdBook@github-release:0.5.4::binary=mdbook
```

The `binary` parameter is optional if there is only one binary in the package _and_ that binary is called exactly identical to the unscoped package name stored in the `package.json`.
That's why the binary was optional when using `@rust-lang/mdbook` but required when using `@rust-lang/mdBook`. \
The parameter can be passed multiple times if there are multiple binaries included in the release.

The only other supported parameter is `strip_components`, which maps onto the `--strip-components` parameter of the `tar` command, i.e. it strips off the first directories. It can be configured separately for tarballs and zips via  `strip_components_tar` and `strip_components_zip`.

## Supported releases

This plugin looks for a GitHub release attached to a tag with the requested version number.
Only valid SemVer tags are considered, others are ignored and cannot be installed. \
The plugin loops through all assets attached to the release and looks for `.tar.gz` and `.zip` files that contain both an OS name and an architecture.
For Linux, it also looks for which libc implementation a binary expects. \
Any release asset that doesn't contain both an OS marker and an architecture marker or that is a type other than `.zip` or `.tgz`/`.tar.gz` are silently ignored.

Supported operating systems:

| OS      | markers used to detect this OS |
|---------|--------------------------------|
| Windows | apple, darwin                  |
| macOS   | windows                        |
| Linux   | linux                          |

Supported architectures:

| Architecture | markers used to detect this architecture                 |
|--------------|----------------------------------------------------------|
| x86          | x86, ia32, 386, i386, i486, i586, i686, i786, i886, i986 |
| x64          | x86_64, x64, amd64                                       |
| ARM          | arm, armhf, armv6, armv6hf                               |
| ARM64        | arm64, aarch64                                           |

On Linux the following libc implementations are supported:

| Libc  | markers used to detect this libc |
|-------|----------------------------------|
| glibc | glibc, gnu                       |
| musl  | musl                             |

If no libc is detected, or if the plugin detects that there's only a download for musl, then the plugin assumes that this download is a statically linked binary that can be used regardless of the libc installed on the system.
