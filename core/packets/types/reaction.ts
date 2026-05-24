/**
 * File: types/reaction.ts
 * Description: Type-owned build rules for canonical Reaction packets.
 */

import type { ReactionPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const reactionBuildDefinition: PacketTypeBuildDefinition<
  'Reaction',
  ReactionPacketInput
> = {
  validateBody: (input) => {
    if (!input.target_ref?.packet_id) {
      throw new Error('Reaction packets require target_ref.');
    }
  },
  prepareEdges: (input) => {
    const supportingRefs = input.supporting_refs ?? [];

    return [
      createPacketEdge('reacts_to', input.target_ref, {
        source_field: 'target_ref',
      }),
      ...(input.context_ref
        ? [
            createPacketEdge('belongs_to', input.context_ref, {
              source_field: 'context_ref',
            }),
          ]
        : []),
      ...supportingRefs.map((supportingRef) =>
        createPacketEdge('references', supportingRef, {
          source_field: 'supporting_refs',
        })
      ),
    ];
  },
  finalizeBody: (input) => ({
    subtype: input.subtype ?? 'reaction',
    target_ref: input.target_ref,
    status: input.status ?? 'active',
    vote_value: input.vote_value ?? null,
    attestation_value: input.attestation_value ?? null,
    emotion_ids: input.emotion_ids ?? [],
    context_ref: input.context_ref ?? null,
    supporting_refs: input.supporting_refs ?? [],
    note: input.note ?? null,
    supersedes_ref: input.supersedes_ref ?? null,
  }),
  prepareMetadataSummary: (input) => input.note ?? null,
};
