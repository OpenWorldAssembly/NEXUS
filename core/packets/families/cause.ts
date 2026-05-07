/**
 * File: families/cause.ts
 * Description: Family-owned build rules for canonical Cause packets.
 */

import type { CausePacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const causeBuildDefinition: PacketFamilyBuildDefinition<
  'Cause',
  CausePacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Cause packets require a title.');
    }
  },
  prepareEdges: (input) => [
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
    ...(input.module_refs ?? []).map((moduleRef) =>
      createPacketEdge('uses_module', moduleRef, {
        source_field: 'module_refs',
      })
    ),
  ],
  finalizeBody: (input) => ({
    type: 'cause',
    subtype: input.subtype,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status,
    purpose_markdown: input.purpose_markdown ?? null,
    policy_refs: input.policy_refs ?? [],
    template_refs: input.template_refs ?? [],
    module_refs: input.module_refs ?? [],
  }),
  prepareMetadataSummary: (input) =>
    input.summary ?? input.purpose_markdown ?? null,
};
