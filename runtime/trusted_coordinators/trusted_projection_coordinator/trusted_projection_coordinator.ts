/**
 * File: trusted_projection_coordinator.ts
 * Description: Gated public Trusted Projection Coordinator surface for archive-backed UI read models.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedProjectionOperation } from './trusted_projection_registry.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type AuditTrustedProjectionReadinessInput,
  type ResolveTrustedArchivedPacketProjectionInput,
  type ResolveTrustedPacketGraphProjectionInput,
  type ResolveTrustedPacketCardListProjectionInput,
  type ResolveTrustedPacketListProjectionInput,
  type ResolveTrustedPacketProjectionInput,
  type ResolveTrustedPreferredSurfaceInput,
  type TrustedPacketCardListProjection,
  type TrustedPacketGraphProjection,
  type TrustedPacketListProjection,
  type TrustedPacketProjectionViewModel,
  type TrustedPreferredProjectionSurface,
  type TrustedProjectionReadinessReport,
} from './trusted_projection_types.ts';

function castResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<unknown>
): TrustedRuntimeCoordinatorResult<TValue> {
  return result as TrustedRuntimeCoordinatorResult<TValue>;
}

function castPromise<TValue>(
  result: Promise<TrustedRuntimeCoordinatorResult<unknown>>
): Promise<TrustedRuntimeCoordinatorResult<TValue>> {
  return result as Promise<TrustedRuntimeCoordinatorResult<TValue>>;
}

export const trustedProjectionCoordinator = {
  id: 'trusted_projection_coordinator.v0',

  resolvePacketProjection(
    input: ResolveTrustedPacketProjectionInput
  ): TrustedRuntimeCoordinatorResult<TrustedPacketProjectionViewModel> {
    return castResult(runTrustedProjectionOperation({
      operation: 'resolve_packet_projection',
      input,
    }) as TrustedRuntimeCoordinatorResult<unknown>);
  },

  resolveArchivedPacketProjection(
    input: ResolveTrustedArchivedPacketProjectionInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketProjectionViewModel>> {
    return castPromise(Promise.resolve(runTrustedProjectionOperation({
      operation: 'resolve_archived_packet_projection',
      input,
    })));
  },

  resolvePacketListProjection(
    input: ResolveTrustedPacketListProjectionInput = {}
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketListProjection>> {
    return castPromise(Promise.resolve(runTrustedProjectionOperation({
      operation: 'resolve_packet_list_projection',
      input,
    })));
  },


  resolvePacketCardListProjection(
    input: ResolveTrustedPacketCardListProjectionInput
  ): TrustedRuntimeCoordinatorResult<TrustedPacketCardListProjection> {
    return castResult(runTrustedProjectionOperation({
      operation: 'resolve_packet_card_list_projection',
      input,
    }) as TrustedRuntimeCoordinatorResult<unknown>);
  },

  resolvePacketGraphProjection(
    input: ResolveTrustedPacketGraphProjectionInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketGraphProjection>> {
    return castPromise(Promise.resolve(runTrustedProjectionOperation({
      operation: 'resolve_packet_graph_projection',
      input,
    })));
  },

  resolvePreferredSurface(
    input: ResolveTrustedPreferredSurfaceInput
  ): TrustedRuntimeCoordinatorResult<TrustedPreferredProjectionSurface> {
    return castResult(runTrustedProjectionOperation({
      operation: 'resolve_preferred_surface',
      input,
    }) as TrustedRuntimeCoordinatorResult<unknown>);
  },

  auditReadiness(
    input?: AuditTrustedProjectionReadinessInput
  ): TrustedRuntimeCoordinatorResult<TrustedProjectionReadinessReport> {
    return castResult(runTrustedProjectionOperation({
      operation: 'audit_readiness',
      input,
    }) as TrustedRuntimeCoordinatorResult<unknown>);
  },
} as const satisfies {
  id: typeof TRUSTED_PROJECTION_COORDINATOR_ID;
  resolvePacketProjection(input: ResolveTrustedPacketProjectionInput): TrustedRuntimeCoordinatorResult<TrustedPacketProjectionViewModel>;
  resolveArchivedPacketProjection(input: ResolveTrustedArchivedPacketProjectionInput): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketProjectionViewModel>>;
  resolvePacketListProjection(input?: ResolveTrustedPacketListProjectionInput): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketListProjection>>;
  resolvePacketCardListProjection(input: ResolveTrustedPacketCardListProjectionInput): TrustedRuntimeCoordinatorResult<TrustedPacketCardListProjection>;
  resolvePacketGraphProjection(input: ResolveTrustedPacketGraphProjectionInput): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketGraphProjection>>;
  resolvePreferredSurface(input: ResolveTrustedPreferredSurfaceInput): TrustedRuntimeCoordinatorResult<TrustedPreferredProjectionSurface>;
  auditReadiness(input?: AuditTrustedProjectionReadinessInput): TrustedRuntimeCoordinatorResult<TrustedProjectionReadinessReport>;
};
