/**
 * File: types/action.ts
 * Description: Type-owned build rules for canonical Action packets.
 */

import type { ActionPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const actionBuildDefinition: PacketTypeBuildDefinition<
  'Action',
  ActionPacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Action packets require a title.');
    }
  },
  prepareEdges: (input) => [
    ...(input.location_refs ?? []).map((locationRef) =>
      createPacketEdge('references', locationRef, {
        source_field: 'location_refs',
      })
    ),
    ...(input.action_refs ?? []).map((actionRef) =>
      createPacketEdge('references', actionRef, {
        source_field: 'action_refs',
      })
    ),
    ...(input.parent_action_ref
      ? [
          createPacketEdge('belongs_to', input.parent_action_ref, {
            source_field: 'parent_action_ref',
          }),
        ]
      : []),
    ...(input.child_action_refs ?? []).map((actionRef) =>
      createPacketEdge('references', actionRef, {
        source_field: 'child_action_refs',
      })
    ),
    ...(input.policy_refs ?? []).map((policyRef) =>
      createPacketEdge('governed_by', policyRef, {
        source_field: 'policy_refs',
      })
    ),
    ...(input.template_refs ?? []).map((templateRef) =>
      createPacketEdge('uses_template', templateRef, {
        source_field: 'template_refs',
      })
    ),
    ...(input.default_packet_set_refs ?? []).map((packetSetRef) =>
      createPacketEdge('depends_on', packetSetRef, {
        source_field: 'default_packet_set_refs',
      })
    ),
  ],
  finalizeBody: (input) => ({
    subtype: input.subtype,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status,
    objective_markdown: input.objective_markdown ?? null,
    location_refs: input.location_refs ?? [],
    action_refs: input.action_refs ?? [],
    parent_action_ref: input.parent_action_ref ?? null,
    child_action_refs: input.child_action_refs ?? [],
    policy_refs: input.policy_refs ?? [],
    template_refs: input.template_refs ?? [],
    default_packet_set_refs: input.default_packet_set_refs ?? [],
  }),
  prepareMetadataSummary: (input) =>
    input.summary ?? input.objective_markdown ?? null,
};
