/**
 * File: types/proposal.ts
 * Description: Type-owned build rules for canonical Proposal packets.
 */

import type { ProposalPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const proposalBuildDefinition: PacketTypeBuildDefinition<
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
    subtype: input.subtype,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status,
    decision_scope_refs: input.decision_scope_refs ?? [],
    related_policy_refs: input.related_policy_refs ?? [],
  }),
  prepareMetadataSummary: (input) => input.summary ?? null,
};
