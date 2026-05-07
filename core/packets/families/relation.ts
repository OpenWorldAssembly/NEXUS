/**
 * File: families/relation.ts
 * Description: Family-owned build rules for canonical Relation packets.
 */

import type { RelationPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const relationBuildDefinition: PacketFamilyBuildDefinition<
  'Relation',
  RelationPacketInput
> = {
  validateBody: (input) => {
    if (!input.subject_ref?.packet_id) {
      throw new Error('Relation packets require subject_ref.');
    }

    if (!input.target_ref?.packet_id) {
      throw new Error('Relation packets require target_ref.');
    }
  },
  prepareEdges: (input) => [
    createPacketEdge('belongs_to', input.subject_ref, {
      source_field: 'subject_ref',
    }),
    createPacketEdge('references', input.target_ref, {
      source_field: 'target_ref',
    }),
    ...(input.scope_ref
      ? [
          createPacketEdge('scoped_to', input.scope_ref, {
            source_field: 'scope_ref',
          }),
        ]
      : []),
    ...(input.policy_ref
      ? [
          createPacketEdge('governed_by', input.policy_ref, {
            source_field: 'policy_ref',
          }),
        ]
      : []),
    ...(input.terms_ref
      ? [
          createPacketEdge('references', input.terms_ref, {
            source_field: 'terms_ref',
          }),
        ]
      : []),
    ...(input.supporting_refs ?? []).map((supportingRef) =>
      createPacketEdge('references', supportingRef, {
        source_field: 'supporting_refs',
      })
    ),
  ],
  finalizeBody: (input) => ({
    type: 'relation',
    subtype: input.subtype,
    subject_ref: input.subject_ref,
    target_ref: input.target_ref,
    scope_ref: input.scope_ref ?? null,
    status: input.status ?? 'active',
    policy_ref: input.policy_ref ?? null,
    terms_ref: input.terms_ref ?? null,
    supporting_refs: input.supporting_refs ?? [],
    note: input.note ?? null,
    effective_from: input.effective_from ?? null,
    effective_until: input.effective_until ?? null,
  }),
  prepareMetadataSummary: (input) => input.note ?? null,
};
