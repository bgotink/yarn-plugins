import {
  Resolver,
  ResolveOptions,
  MinimalResolveOptions,
  DescriptorHash,
  Descriptor,
  Locator,
  Package,
} from '@yarnpkg/core';

import {resolveDescriptor} from './utils';

export const protocol = 'bucket:';

export class BucketResolver implements Resolver {
  supportsDescriptor(descriptor: Descriptor): boolean {
    return descriptor.range.startsWith(protocol);
  }

  supportsLocator(): boolean {
    return false;
  }

  shouldPersistResolution(): boolean {
    return false;
  }

  bindDescriptor(descriptor: Descriptor): Descriptor {
    return descriptor;
  }

  getResolutionDependencies(
    descriptor: Descriptor,
    opts: MinimalResolveOptions,
  ): Record<string, Descriptor> {
    return opts.resolver.getResolutionDependencies(
      resolveDescriptor(descriptor, opts).descriptor,
      opts,
    );
  }

  async getCandidates(
    descriptor: Descriptor,
    dependencies: Record<string, Package>,
    opts: ResolveOptions,
  ): Promise<Locator[]> {
    return opts.resolver.getCandidates(
      resolveDescriptor(descriptor, opts).descriptor,
      dependencies,
      opts,
    );
  }

  getSatisfying(
    descriptor: Descriptor,
    dependencies: Record<string, Package>,
    locators: Locator[],
    opts: ResolveOptions,
  ): Promise<{
    locators: Locator[];
    sorted: boolean;
  }> {
    return opts.resolver.getSatisfying(
      resolveDescriptor(descriptor, opts).descriptor,
      dependencies,
      locators,
      opts,
    );
  }

  async resolve(): Promise<Package> {
    throw new Error(
      "Assertion: locators shouldn't be handled by bucket: resolver",
    );
  }
}
