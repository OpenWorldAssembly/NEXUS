/**
 * File: fortress-handler-domain-attestation.ts
 * Description: Attestation-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createAttestationPrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<FortressPrepareHandlerMap, 'preparePacketSignal'> {
  return {
    preparePacketSignal: async ({ intent, actorPacket, actorKey }) =>
      handlers.preparePacketSignal({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'attestation.packet_signal.set' }
        >,
        actorPacket,
        actorKey,
      }),
  };
}

export function createAttestationFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<FortressFinalizeHandlerMap, 'finalizePacketSignal'> {
  return {
    finalizePacketSignal: async ({ actorContext, signedPackets }) =>
      handlers.finalizePacketSignal({
        actorContext,
        signedPackets: signedPackets as [PacketEnvelopeByType['Attestation']],
      }),
  };
}
