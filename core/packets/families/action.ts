/**
 * File: families/action.ts
 * Description: Family-owned build rules for canonical Action packets.
 */

import type { ActionPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const actionBuildDefinition: PacketFamilyBuildDefinition<
  'Action',
  ActionPacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Action packets require a title.');
    }
  },
  prepareEdges: (input) => [
    ...(input.cause_refs ?? []).map((causeRef) =>
      createPacketEdge('references', causeRef, {
        source_field: 'cause_refs',
      })
    ),
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
  ],
  finalizeBody: (input) => ({
    type: 'action',
    subtype: input.subtype,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status,
    objective_markdown: input.objective_markdown ?? null,
    cause_refs: input.cause_refs ?? [],
    location_refs: input.location_refs ?? [],
    action_refs: input.action_refs ?? [],
  }),
  prepareMetadataSummary: (input) =>
    input.summary ?? input.objective_markdown ?? null,
};
