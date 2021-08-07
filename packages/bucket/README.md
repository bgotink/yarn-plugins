# Yarn bucket plugin

A small plugin to help with managing "buckets" of packages, that is, many packages that always have the same version.

## What's the use case?

All angular packages use the same version number, and you'll always want to use the same version at every point in time. It's easy to e.g. forget to update `@angular/cdk`, or only update the angular-cli-related packages.

There are other similar examples, where you'd always want to use the same version of a package throughout your entire (mono-)repository.

## How does this work?

This plugin defines a `bucket:` protocol, to which you pass a name. The root package manifest has a `buckets` section which maps these bucket names onto actual version numbers.

```json5
{
  "peerDependencies": {
    "@angular/common": "*",
    "@angular/core": "*"
  },
  "devDependencies": {
    "@angular/common": "bucket:angular",
    "@angular/compiler": "bucket:angular",
    "@angular/core": "bucket:angular",
    "@angular/platform-browser-dynamic": "bucket:angular",
    "@angular/platform-browser": "bucket:angular"
  }
}

// and in the root package.json

{
  "buckets": {
    "angular": {
      "range": "12.2.0",
      "peerModifier": "^"
    }
  }
}
```

Updating to a newer angular version now only requires changing 1 version number, instead of having to update _all_ angular dependencies in every workspace in your project.

## Publishing packages with buckets

Descriptors for regular and development dependencies with the `bucket:` protocol will be rewritten during publishing. The published package will depend on the version range defined by the bucket directly.

Peer dependencies with a range of `*` that have a corresponding development dependency set to a bucket range, will get their range replaced with the bucket's version during packaging of the workspace. In the example above, the published package has peer dependencies on `@angular/core@^12.2.0` and `@angular/common@^12.2.0`.
This updated peer dependency defaults to a specific version, unless overriden by the `peerModifier` configured in the bucket or overridden by the peer dependency itself (`^*` always results in a `^` range, `~*` always results in a `~` range)

In other words, the `bucket:` ranges are never published. This implies it is not necessary for people who use your packages to also install this plugin.

## Status

This is a proof of concept. It is safe to use, as all bucket references are removed while publishing.
