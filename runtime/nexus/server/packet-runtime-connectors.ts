/**
 * File: packet-runtime-connectors.ts
 * Description: Registry of runtime connectors enrolled in the packet-runtime master handler.
 */

import { preferenceElementInterfaceRuntimeConnector } from '@runtime/nexus/server/preference-runtime-connectors';
import {
  runPacketRuntimeMutation,
  type PacketRuntimeMutationInput,
  type PacketRuntimeMutationResult,
} from '@runtime/nexus/server/packet-runtime-master-handler';

export const PACKET_RUNTIME_CONNECTORS = [
  preferenceElementInterfaceRuntimeConnector,
] as const;

export function runRegisteredPacketRuntimeMutation<TResult = unknown>(
  input: Omit<PacketRuntimeMutationInput, 'connectors'>
): Promise<PacketRuntimeMutationResult<TResult>> {
  return runPacketRuntimeMutation({
    ...input,
    connectors: PACKET_RUNTIME_CONNECTORS,
  });
}
