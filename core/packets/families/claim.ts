/**
 * File: families/claim.ts
 * Description: Family-owned build rules for canonical Claim packets.
 */

import type { ClaimPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const claimBuildDefinition: PacketFamilyBuildDefinition<
  'Claim',
  ClaimPacketInput
> = {
  validateBody: (input) => {
    if (!input.subject_ref?.packet_id) {
      throw new Error('Claim packets require subject_ref.');
    }

    if (!input.target_ref?.packet_id) {
      throw new Error('Claim packets require target_ref.');
    }

    if (!input.scope_ref?.packet_id) {
      throw new Error('Claim packets require scope_ref.');
    }
  },
  prepareEdges: (input) => [
    createPacketEdge('belongs_to', input.subject_ref, {
      source_field: 'subject_ref',
    }),
    createPacketEdge('references', input.target_ref, {
      source_field: 'target_ref',
    }),
    createPacketEdge('scoped_to', input.scope_ref, {
      source_field: 'scope_ref',
    }),
  ],
  finalizeBody: (input) => ({
    claim_kind: input.claim_kind,
    subject_ref: input.subject_ref,
    target_ref: input.target_ref,
    scope_ref: input.scope_ref,
    status: input.status ?? 'active',
    note: input.note ?? null,
  }),
  prepareMetadataSummary: (input) => input.note ?? null,
};
