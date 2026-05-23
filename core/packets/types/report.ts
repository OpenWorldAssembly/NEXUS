/**
 * File: types/report.ts
 * Description: Type-owned build rules for canonical Report packets.
 */

import type { ReportPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';

export const reportBuildDefinition: PacketTypeBuildDefinition<
  'Report',
  ReportPacketInput
> = {
  prepareEdges: (input) => [
    ...(input.target_ref
      ? [
          createPacketEdge('reports_on', input.target_ref, {
            source_field: 'target_ref',
          }),
        ]
      : []),
    ...(input.scope_ref
      ? [
          createPacketEdge('scoped_to', input.scope_ref, {
            source_field: 'scope_ref',
          }),
        ]
      : []),
    ...(input.supporting_refs ?? []).map((supportingRef) =>
      createPacketEdge('references', supportingRef, {
        source_field: 'supporting_refs',
      })
    ),
    ...(input.supersedes_ref
      ? [
          createPacketEdge('references', input.supersedes_ref, {
            source_field: 'supersedes_ref',
          }),
        ]
      : []),
  ],
  finalizeBody: (input) => ({
    subtype: input.subtype,
    status: input.status ?? 'active',
    target_ref: input.target_ref ?? null,
    scope_ref: input.scope_ref ?? null,
    summary_markdown: input.summary_markdown ?? null,
    report_markdown: input.report_markdown,
    supporting_refs: input.supporting_refs ?? [],
    supersedes_ref: input.supersedes_ref ?? null,
    report_data: input.report_data ?? {},
  }),
  prepareMetadataSummary: (input) =>
    input.summary_markdown ?? input.report_markdown,
};
