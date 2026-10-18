import protobuf from 'protobufjs';
import type { Root } from 'protobufjs';
import protoBundle from './protoBundle.json' with { type: 'json' };

let cached: Root | undefined;

/**
 * Resolve the Presentation protobuf type from the pre-built JSON bundle.
 */
export function getProtoRoot(): Root {
  cached ??= protobuf.Root.fromJSON(
    protoBundle as Parameters<typeof protobuf.Root.fromJSON>[0]
  );
  return cached;
}
