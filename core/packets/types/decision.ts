/**
 * File: types/decision.ts
 * Description: Type-owned build rules for canonical Decision packets.
 */

import type { DecisionPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const decisionBuildDefinition: PacketTypeBuildDefinition<
  'Decision',
  DecisionPacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Decision packets require a title.');
    }
  },
  // Decision refs are currently query/schema-only links, so keep them as minimal
  // references until governance workflows establish a stronger domain edge contract.
  prepareEdges: (input) => [
    ...(input.proposal_ref
      ? [
          createPacketEdge('references', input.proposal_ref, {
            source_field: 'proposal_ref',
          }),
        ]
      : []),
    ...(input.vote_ref
      ? [
          createPacketEdge('references', input.vote_ref, {
            source_field: 'vote_ref',
          }),
        ]
      : []),
  ],
  finalizeBody: (input) => ({
    subtype: 'decision',
    title: input.title,
    summary: input.summary ?? null,
    outcome: input.outcome,
    proposal_ref: input.proposal_ref ?? null,
    vote_ref: input.vote_ref ?? null,
  }),
  prepareMetadataSummary: (input) => input.summary ?? null,
};
