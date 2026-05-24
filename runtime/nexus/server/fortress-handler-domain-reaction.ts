/**
 * File: fortress-handler-domain-reaction.ts
 * Description: Reaction-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createReactionPrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<
  FortressPrepareHandlerMap,
  'preparePacketVoteReaction' | 'prepareReactionAttestation'
> {
  return {
    preparePacketVoteReaction: async ({ intent, actorPacket, actorKey }) =>
      handlers.preparePacketVoteReaction({
        intent: intent as Extract<MutationIntent, { kind: 'reaction.vote.set' }>,
        actorPacket,
        actorKey,
      }),
    prepareReactionAttestation: async ({ intent, actorPacket }) =>
      handlers.prepareReactionAttestation({
        intent: intent as Extract<MutationIntent, { kind: 'reaction.attestation.set' }>,
        actorPacket,
      }),
  };
}

export function createReactionFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<
  FortressFinalizeHandlerMap,
  'finalizePacketVoteReaction' | 'finalizeReactionAttestation'
> {
  return {
    finalizePacketVoteReaction: async ({ actorContext, signedPackets }) =>
      handlers.finalizePacketVoteReaction({
        actorContext,
        signedPackets: signedPackets as [PacketEnvelopeByType['Reaction']],
      }),
    finalizeReactionAttestation: async ({ storedTicket, actorContext, signedPackets }) =>
      handlers.finalizeReactionAttestation({
        storedTicket,
        actorContext,
        signedPackets,
      }),
  };
}
