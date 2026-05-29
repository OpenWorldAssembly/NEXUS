/**
 * File: reaction-finalize-response-adapter.ts
 * Description: Decorates trusted mutation finalize responses with reaction-specific derived-state payloads for API compatibility.
 */

import type { ReactionService } from '@core/contracts';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { TrustedDispatchFinalizedMutationResult } from '@runtime/trusted_coordinators/trusted_dispatch_coordinator/index.ts';

type ReactionFinalizeResponseAdapterInput = {
  finalized_mutation: TrustedDispatchFinalizedMutationResult;
  actor_packet: PacketEnvelopeByType['Element'];
  signed_packets: readonly unknown[];
  reaction_service?: Pick<ReactionService, 'syncDerivedState' | 'getTargetSummary'> | null;
};

type ReactionPacketCandidate = {
  header?: {
    type?: unknown;
  };
  body?: {
    target_ref?: {
      packet_id?: unknown;
    };
    status?: unknown;
    vote_value?: unknown;
  };
};

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' ? { ...(value as Record<string, unknown>) } : {};
}

function firstReactionPacketFromSignedPackets(
  packets: readonly unknown[]
): PacketEnvelopeByType['Reaction'] | null {
  for (const packet of packets) {
    if (!packet || typeof packet !== 'object') {
      continue;
    }

    const candidate = packet as ReactionPacketCandidate;
    if (
      candidate.header?.type === 'Reaction' &&
      typeof candidate.body?.target_ref?.packet_id === 'string'
    ) {
      return packet as PacketEnvelopeByType['Reaction'];
    }
  }

  return null;
}

export async function decorateReactionFinalizeResponse(
  input: ReactionFinalizeResponseAdapterInput
): Promise<TrustedDispatchFinalizedMutationResult> {
  if (input.finalized_mutation.kind !== 'reaction.vote.set') {
    return input.finalized_mutation;
  }

  const reactionPacket = firstReactionPacketFromSignedPackets(input.signed_packets);
  if (!reactionPacket) {
    return input.finalized_mutation;
  }

  const baseResult = asRecord(input.finalized_mutation.result);
  const targetPacketId = reactionPacket.body.target_ref.packet_id;
  const reactionValue = reactionPacket.body.status === 'active'
    ? reactionPacket.body.vote_value
    : null;

  if (!input.reaction_service) {
    return {
      ...input.finalized_mutation,
      result: {
        ...baseResult,
        target_packet_id: targetPacketId,
        value: reactionValue,
      },
    };
  }

  try {
    await input.reaction_service.syncDerivedState();
    const summary = await input.reaction_service.getTargetSummary({
      target_packet_id: targetPacketId,
      viewer_actor_key: `element:${input.actor_packet.header.packet_id}`,
    });

    return {
      ...input.finalized_mutation,
      result: {
        ...baseResult,
        target_packet_id: targetPacketId,
        value: reactionValue,
        summary,
      },
    };
  } catch {
    return {
      ...input.finalized_mutation,
      result: {
        ...baseResult,
        target_packet_id: targetPacketId,
        value: reactionValue,
      },
    };
  }
}
