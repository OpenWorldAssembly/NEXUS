/**
 * File: families/vote.ts
 * Description: Family-owned build rules for canonical Vote packets.
 */

import type { VotePacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const voteBuildDefinition: PacketFamilyBuildDefinition<'Vote', VotePacketInput> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Vote packets require a title.');
    }
  },
  prepareEdges: (input) => [
    createPacketEdge('votes_on', input.proposal_ref, {
      source_field: 'proposal_ref',
    }),
  ],
  finalizeBody: (input) => ({
    title: input.title,
    proposal_ref: input.proposal_ref,
    vote_method: input.vote_method,
    status: input.status,
    opened_at: input.opened_at ?? null,
    closes_at: input.closes_at ?? null,
  }),
};
