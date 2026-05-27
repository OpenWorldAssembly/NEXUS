/**
 * File: resolve_packet_list_projection.ts
 * Description: Projects archive query cards into UI-safe packet list items.
 */

import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { projectionTrace } from '../trusted_projection_internal.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type ResolveTrustedPacketListProjectionInput,
  type TrustedPacketListProjection,
} from '../trusted_projection_types.ts';
import { resolveTrustedPreferredSurface } from './resolve_preferred_surface.ts';

export async function resolveTrustedPacketListProjection(
  input: ResolveTrustedPacketListProjectionInput = {}
): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketListProjection>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const archiveResult = await trustedArchiveCoordinator.queryPackets({
    packet_store: input.packet_store,
    database_path: input.database_path,
    packet_type: input.packet_type,
    text: input.text,
    authority_scope_packet_id: input.authority_scope_packet_id,
    limit: input.limit,
    offset: input.offset,
    context_mode: contextMode,
  });
  const cards = archiveResult.value?.packets ?? [];
  const items = cards.map((card) => {
    const preferredSurface = resolveTrustedPreferredSurface({
      packet_type: card.type,
      node_element_id: input.node_element_id,
      context_mode: contextMode,
    }).value?.preferred_surface ?? null;

    return {
      item_kind: 'trusted.packet_list_projection_item' as const,
      packet_ref: card.packet,
      revision_ref: card.revision,
      packet_type: card.type,
      title: card.title,
      label: card.label,
      summary: card.summary,
      status: card.status,
      preferred_surface: preferredSurface,
      created_at: card.created_at,
      archive_card: card,
    };
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    coordinator_kind: 'projection',
    value: {
      projection_kind: 'trusted.packet_list_projection',
      total_count: archiveResult.value?.total_count ?? 0,
      offset: archiveResult.value?.offset ?? 0,
      limit: archiveResult.value?.limit ?? input.limit ?? 50,
      target_surface: input.target_surface ?? null,
      items,
      archive_cards: cards,
    },
    issues: archiveResult.issues,
    trace: [
      ...archiveResult.trace,
      projectionTrace({
        step_id: 'projection.packet_list.resolve',
        preset_ids: ['trusted.projection.list.v0'],
        notes: `Projected ${items.length} archived packet list item(s).`,
      }),
    ],
    mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
}
