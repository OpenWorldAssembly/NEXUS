/**
 * File: families/proposal.ts
 * Description: Family-owned build rules for canonical Proposal packets.
 */

import type { ProposalPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const proposalBuildDefinition: PacketFamilyBuildDefinition<
  'Proposal',
  ProposalPacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Proposal packets require a title.');
    }
  },
  prepareEdges: (input) =>
    (input.related_policy_refs ?? []).map((policyRef) =>
      createPacketEdge('governed_by', policyRef, {
        source_field: 'related_policy_refs',
      })
    ),
  finalizeBody: (input) => ({
    title: input.title,
    summary: input.summary ?? null,
    proposal_kind: input.proposal_kind,
    status: input.status,
    decision_scope_refs: input.decision_scope_refs ?? [],
    related_policy_refs: input.related_policy_refs ?? [],
  }),
  prepareMetadataSummary: (input) => input.summary ?? null,
};
