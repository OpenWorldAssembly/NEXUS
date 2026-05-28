/**
 * File: trusted_projection_registry.ts
 * Description: Internal operation registry for the Trusted Projection Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { auditTrustedProjectionReadiness } from './functions/audit_trusted_projection_readiness.ts';
import { resolveTrustedArchivedPacketProjection } from './functions/resolve_archived_packet_projection.ts';
import { resolveTrustedPacketGraphProjection } from './functions/resolve_packet_graph_projection.ts';
import { resolveTrustedPacketCardListProjection } from './functions/resolve_packet_card_list_projection.ts';
import { resolveTrustedPacketListProjection } from './functions/resolve_packet_list_projection.ts';
import { resolveTrustedPacketProjection } from './functions/resolve_packet_projection.ts';
import { resolveTrustedPreferredSurface } from './functions/resolve_preferred_surface.ts';
import type { TrustedProjectionCoordinatorRequest } from './trusted_projection_types.ts';

export type TrustedProjectionRegistryResult =
  | TrustedRuntimeCoordinatorResult<unknown>
  | Promise<TrustedRuntimeCoordinatorResult<unknown>>;

type TrustedProjectionHandler = (
  request: TrustedProjectionCoordinatorRequest
) => TrustedProjectionRegistryResult;

const TRUSTED_PROJECTION_REGISTRY: Record<TrustedProjectionCoordinatorRequest['operation'], TrustedProjectionHandler> = {
  resolve_packet_projection: (request) => {
    if (request.operation !== 'resolve_packet_projection') {
      throw new Error('Invalid Trusted Projection operation dispatch.');
    }
    return resolveTrustedPacketProjection(request.input);
  },
  resolve_archived_packet_projection: (request) => {
    if (request.operation !== 'resolve_archived_packet_projection') {
      throw new Error('Invalid Trusted Projection operation dispatch.');
    }
    return resolveTrustedArchivedPacketProjection(request.input);
  },
  resolve_packet_list_projection: (request) => {
    if (request.operation !== 'resolve_packet_list_projection') {
      throw new Error('Invalid Trusted Projection operation dispatch.');
    }
    return resolveTrustedPacketListProjection(request.input);
  },
  resolve_packet_card_list_projection: (request) => {
    if (request.operation !== 'resolve_packet_card_list_projection') {
      throw new Error('Invalid Trusted Projection operation dispatch.');
    }
    return resolveTrustedPacketCardListProjection(request.input);
  },
  resolve_packet_graph_projection: (request) => {
    if (request.operation !== 'resolve_packet_graph_projection') {
      throw new Error('Invalid Trusted Projection operation dispatch.');
    }
    return resolveTrustedPacketGraphProjection(request.input);
  },
  resolve_preferred_surface: (request) => {
    if (request.operation !== 'resolve_preferred_surface') {
      throw new Error('Invalid Trusted Projection operation dispatch.');
    }
    return resolveTrustedPreferredSurface(request.input);
  },
  audit_readiness: (request) => {
    if (request.operation !== 'audit_readiness') {
      throw new Error('Invalid Trusted Projection operation dispatch.');
    }
    return auditTrustedProjectionReadiness(request.input);
  },
};

export function runTrustedProjectionOperation(
  request: TrustedProjectionCoordinatorRequest
): TrustedProjectionRegistryResult {
  return TRUSTED_PROJECTION_REGISTRY[request.operation](request);
}
