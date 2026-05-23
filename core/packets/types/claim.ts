/**
 * File: types/claim.ts
 * Description: Type-owned build rules for canonical Claim packets.
 */

import type { ClaimPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

function resolveRelationAssertion(input: ClaimPacketInput) {
  if (input.relation_assertion) {
    return {
      subtype: input.relation_assertion.subtype,
      subject_ref: input.relation_assertion.subject_ref,
      target_ref: input.relation_assertion.target_ref,
      scope_ref: input.relation_assertion.scope_ref ?? null,
    };
  }

  return null;
}

export const claimBuildDefinition: PacketTypeBuildDefinition<
  'Claim',
  ClaimPacketInput
> = {
  validateBody: (input) => {
    if (!input.target_ref?.packet_id) {
      throw new Error('Claim packets require target_ref.');
    }

    const relationAssertion = resolveRelationAssertion(input);

    if (
      input.subtype === 'relation_assertion' ||
      input.relation_assertion
    ) {
      if (!relationAssertion?.subject_ref?.packet_id) {
        throw new Error('Relation assertion Claims require subject_ref.');
      }

      if (!relationAssertion.target_ref?.packet_id) {
        throw new Error('Relation assertion Claims require target_ref.');
      }
    }
  },
  prepareEdges: (input) => {
    const relationAssertion = resolveRelationAssertion(input);
    const supportingRefs = input.supporting_refs ?? [];

    return [
      ...(input.subject_ref ?? relationAssertion?.subject_ref
        ? [
            createPacketEdge(
              'belongs_to',
              input.subject_ref ?? relationAssertion!.subject_ref,
              {
                source_field: 'subject_ref',
              }
            ),
          ]
        : []),
      createPacketEdge('references', input.target_ref, {
        source_field: 'target_ref',
      }),
      ...(input.scope_ref ?? relationAssertion?.scope_ref
        ? [
            createPacketEdge(
              'scoped_to',
              input.scope_ref ?? relationAssertion?.scope_ref!,
              {
                source_field: 'scope_ref',
              }
            ),
          ]
        : []),
      ...(relationAssertion &&
      input.target_ref.packet_id !== relationAssertion.target_ref.packet_id
        ? [
            createPacketEdge('references', relationAssertion.target_ref, {
              source_field: 'relation_assertion.target_ref',
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
  finalizeBody: (input) => {
    const relationAssertion = resolveRelationAssertion(input);
    const resolvedSubtype =
      input.subtype ??
      (relationAssertion ? 'relation_assertion' : null) ??
      'analysis';

    return {
      subtype: resolvedSubtype,
      target_ref: input.target_ref,
      subject_ref: input.subject_ref ?? relationAssertion?.subject_ref ?? null,
      scope_ref: input.scope_ref ?? relationAssertion?.scope_ref ?? null,
      status: input.status ?? 'active',
      claim_markdown: input.claim_markdown ?? input.note ?? null,
      supporting_refs: input.supporting_refs ?? [],
      relation_assertion: relationAssertion,
      note: input.note ?? null,
    };
  },
  prepareMetadataSummary: (input) => input.claim_markdown ?? input.note ?? null,
};
