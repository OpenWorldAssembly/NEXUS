/**
 * File: types/relation.ts
 * Description: Type-owned build rules for canonical Relation packets.
 */

import type { RelationPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';
import { RelationSubscriptionOptionsSchema } from '@core/schema/packet-schema';


function collectSubscriptionOptionRefs(
  options: RelationPacketInput['subscription_options']
) {
  if (!options) {
    return [];
  }

  return [
    ...(options.included_policy_refs ?? []),
    ...(options.excluded_policy_refs ?? []),
    ...(options.included_dependency_refs ?? []),
    ...(options.excluded_dependency_refs ?? []),
    ...(options.included_module_refs ?? []),
    ...(options.excluded_module_refs ?? []),
    ...(options.included_template_refs ?? []),
    ...(options.excluded_template_refs ?? []),
    ...(options.included_default_packet_set_refs ?? []),
    ...(options.excluded_default_packet_set_refs ?? []),
  ];
}

export const relationBuildDefinition: PacketTypeBuildDefinition<
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
    ...collectSubscriptionOptionRefs(input.subscription_options).map((subscriptionRef) =>
      createPacketEdge('references', subscriptionRef, {
        source_field: 'subscription_options',
      })
    ),
  ],
  finalizeBody: (input) => ({
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
    subscription_options: input.subscription_options
      ? RelationSubscriptionOptionsSchema.parse(input.subscription_options)
      : null,
  }),
  prepareMetadataSummary: (input) => input.note ?? null,
};
