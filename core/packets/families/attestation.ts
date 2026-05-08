/**
 * File: families/attestation.ts
 * Description: Family-owned build rules for canonical Attestation packets.
 */

import type { AttestationPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const attestationBuildDefinition: PacketFamilyBuildDefinition<
  'Attestation',
  AttestationPacketInput
> = {
  validateBody: (input) => {
    if (!input.target_ref?.packet_id) {
      throw new Error('Attestation packets require target_ref.');
    }
  },
  prepareEdges: (input) => {
    const supportingRefs = input.supporting_refs ?? [];

    return [
      createPacketEdge('votes_on', input.target_ref, {
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
    type: 'attestation',
    subtype: input.subtype ?? input.attestation_kind ?? 'packet_signal',
    target_ref: input.target_ref,
    value: input.value,
    status: input.status ?? 'active',
    attestation_kind: input.attestation_kind ?? 'packet_signal',
    context_ref: input.context_ref ?? null,
    supporting_refs: input.supporting_refs ?? [],
    note: input.note ?? null,
    supersedes_ref: input.supersedes_ref ?? null,
  }),
  prepareMetadataSummary: (input) => input.note ?? null,
};
