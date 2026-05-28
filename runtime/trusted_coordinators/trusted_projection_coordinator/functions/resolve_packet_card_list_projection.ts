/**
 * File: resolve_packet_card_list_projection.ts
 * Description: Projects preselected packet cards into UI-safe trusted card-list items without owning query selection.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { projectionTrace } from '../trusted_projection_internal.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type ResolveTrustedPacketCardListProjectionInput,
  type TrustedPacketCardListProjection,
} from '../trusted_projection_types.ts';
import { resolveTrustedPreferredSurface } from './resolve_preferred_surface.ts';

export function resolveTrustedPacketCardListProjection(
  input: ResolveTrustedPacketCardListProjectionInput
): TrustedRuntimeCoordinatorResult<TrustedPacketCardListProjection> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const sourceCards = [...input.cards];
  const items = sourceCards.map((card) => {
    const preferredSurface = resolveTrustedPreferredSurface({
      packet_type: card.type,
      node_element_id: input.node_element_id,
      context_mode: contextMode,
    }).value?.preferred_surface ?? null;

    return {
      item_kind: 'trusted.packet_card_projection_item' as const,
      packet_ref: card.packet,
      revision_ref: card.revision,
      packet_type: card.type,
      title: card.title,
      label: card.label,
      summary: card.summary,
      status: card.status,
      preferred_surface: preferredSurface,
      created_at: card.created_at,
      source_card: card,
    };
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    coordinator_kind: 'projection',
    value: {
      projection_kind: 'trusted.packet_card_list_projection',
      total_count: items.length,
      target_surface: input.target_surface ?? null,
      items,
      source_cards: sourceCards,
    },
    trace: [
      projectionTrace({
        step_id: 'projection.packet_card_list.resolve',
        preset_ids: ['trusted.projection.cards.v0'],
        notes: `Projected ${items.length} preselected packet card(s).`,
      }),
    ],
    mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
}
