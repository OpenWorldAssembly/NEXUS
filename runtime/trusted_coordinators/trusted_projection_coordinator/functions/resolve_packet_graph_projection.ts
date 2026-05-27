/**
 * File: resolve_packet_graph_projection.ts
 * Description: Resolves an archive-backed root packet projection plus archived graph edges.
 */

import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { projectionTrace } from '../trusted_projection_internal.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type ResolveTrustedPacketGraphProjectionInput,
  type TrustedPacketGraphProjection,
} from '../trusted_projection_types.ts';
import { resolveTrustedArchivedPacketProjection } from './resolve_archived_packet_projection.ts';

export async function resolveTrustedPacketGraphProjection(
  input: ResolveTrustedPacketGraphProjectionInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketGraphProjection>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const rootResult = await resolveTrustedArchivedPacketProjection({
    packet_store: input.packet_store,
    database_path: input.database_path,
    packet_ref: input.packet_ref,
    revision_ref: input.revision_ref,
    projection_key: input.projection_key,
    target_surface: input.target_surface,
    context: input.context,
    node_element_id: input.node_element_id,
    context_mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
  const edgeResult = await trustedArchiveCoordinator.queryEdges({
    packet_store: input.packet_store,
    database_path: input.database_path,
    packet_ref: input.packet_ref,
    query: input.edge_query,
    context_mode: contextMode,
  });
  issues.push(...rootResult.issues, ...edgeResult.issues);

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    coordinator_kind: 'projection',
    value: {
      projection_kind: 'trusted.packet_graph_projection',
      packet_ref: input.packet_ref,
      revision_ref: input.revision_ref ?? null,
      target_surface: input.target_surface ?? null,
      root_projection: rootResult.value,
      edge_count: edgeResult.value?.edge_count ?? 0,
      edges: edgeResult.value?.edges ?? [],
    },
    issues,
    trace: [
      ...rootResult.trace,
      ...edgeResult.trace,
      projectionTrace({
        step_id: 'projection.packet_graph.resolve',
        preset_ids: ['trusted.projection.graph.v0'],
        notes: `Projected graph neighborhood for ${input.packet_ref.packet_id}.`,
      }),
    ],
    mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
}
