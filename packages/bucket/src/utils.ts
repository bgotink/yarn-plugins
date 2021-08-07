import {
  structUtils,
  Descriptor,
  Project,
  ReportError,
  MessageName,
} from '@yarnpkg/core';

interface Bucket {
  range: string;
  peerModifier?: string;
}

interface BucketManifest {
  buckets?: {
    [bucketName: string]: string | Bucket;
  };
}

export function resolveDescriptor(
  bucketDescriptor: Descriptor,
  opts: {project: Project},
): {descriptor: Descriptor; peerModifier?: string} {
  const {bucketName, modifier} = parseDescriptor(bucketDescriptor);
  const {topLevelWorkspace} = opts.project;

  const {buckets} = topLevelWorkspace.manifest.raw as BucketManifest;

  if (buckets == null || buckets[bucketName] == null) {
    throw new ReportError(
      MessageName.UNNAMED,
      `Bucket ${JSON.stringify(bucketName)} is not registered`,
    );
  }

  const bucketConfiguration = buckets[bucketName];
  let range;
  let peerModifier: string | undefined;
  if (typeof bucketConfiguration === 'string') {
    range = structUtils.parseRange(bucketConfiguration);
  } else {
    if (typeof bucketConfiguration.range !== 'string') {
      throw new ReportError(
        MessageName.UNNAMED,
        `Invalid configuration for bucket ${JSON.stringify(bucketName)}`,
      );
    }
    range = structUtils.parseRange(bucketConfiguration.range);
    peerModifier = ['~', '^'].includes(bucketConfiguration.peerModifier!)
      ? bucketConfiguration.peerModifier
      : undefined;
  }

  if (modifier) {
    range.selector = `${modifier}${range.selector}`;
  }

  if (range.protocol == null) {
    range.protocol = opts.project.configuration.get('defaultProtocol');
  }

  return {
    descriptor: structUtils.makeDescriptor(
      bucketDescriptor,
      structUtils.makeRange(range),
    ),
    peerModifier,
  };
}

function parseDescriptor(
  descriptor: Descriptor,
): {bucketName: string; modifier: string | null} {
  const {selector} = structUtils.parseRange(descriptor.range);

  let bucketName = selector;
  let modifier: string | null = null;

  if (bucketName.startsWith('^') || bucketName.startsWith('~')) {
    modifier = bucketName[0];
    bucketName = bucketName.slice(1);
  }

  return {bucketName, modifier};
}
