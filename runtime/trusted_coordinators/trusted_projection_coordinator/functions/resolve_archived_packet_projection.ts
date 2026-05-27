/**
 * File: resolve_archived_packet_projection.ts
 * Description: Resolves a packet projection by reading packet material through Trusted Archive.
 */

import { parsePacketEnvelope } from '@core/schema/packet-schema';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { projectionIssue, projectionTrace } from '../trusted_projection_internal.ts';
import {
  TRUSTED_PROJECTION_COORDINATOR_ID,
  type ResolveTrustedArchivedPacketProjectionInput,
  type TrustedPacketProjectionViewModel,
} from '../trusted_projection_types.ts';
import { resolveTrustedPacketProjection } from './resolve_packet_projection.ts';

export async function resolveTrustedArchivedPacketProjection(
  input: ResolveTrustedArchivedPacketProjectionInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedPacketProjectionViewModel>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const archiveResult = await trustedArchiveCoordinator.readPacket({
    packet_store: input.packet_store,
    database_path: input.database_path,
    packet_ref: input.packet_ref,
    revision_ref: input.revision_ref,
    mode: 'adapted',
    context_mode: contextMode,
  });
  const issues: TrustedRuntimeCoordinatorIssue[] = [...archiveResult.issues];
  const trace = [...archiveResult.trace];

  if (!archiveResult.value?.packet) {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
      coordinator_kind: 'projection',
      value: null,
      issues: [
        ...issues,
        projectionIssue({
          severity: 'error',
          code: 'projection_archive_packet_missing',
          path: 'packet_ref.packet_id',
          message: `Cannot project missing archived packet ${input.packet_ref.packet_id}.`,
        }),
      ],
      trace,
      mode: contextMode,
      operation_id: input.operation_id,
      request_id: input.request_id,
    });
  }

  let packet;
  try {
    packet = parsePacketEnvelope(archiveResult.value.packet);
  } catch {
    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
      coordinator_kind: 'projection',
      value: null,
      issues: [
        ...issues,
        projectionIssue({
          severity: 'error',
          code: 'projection_archive_packet_invalid',
          path: 'archive.packet',
          message: `Archived packet ${input.packet_ref.packet_id} could not be parsed as a packet envelope.`,
        }),
      ],
      trace,
      mode: contextMode,
      operation_id: input.operation_id,
      request_id: input.request_id,
    });
  }

  const projectionResult = resolveTrustedPacketProjection({
    packet,
    revision_ref: archiveResult.value.revision_ref,
    projection_key: input.projection_key,
    target_surface: input.target_surface,
    context: input.context,
    context_mode: contextMode,
    node_element_id: input.node_element_id,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_PROJECTION_COORDINATOR_ID,
    coordinator_kind: 'projection',
    value: projectionResult.value,
    issues: [...issues, ...projectionResult.issues],
    trace: [
      ...trace,
      projectionTrace({
        step_id: 'projection.archive.read',
        preset_ids: ['trusted.projection.archive.v0'],
        notes: `Loaded archived packet ${input.packet_ref.packet_id} before projection.`,
      }),
      ...projectionResult.trace,
    ],
    mode: contextMode,
    operation_id: input.operation_id,
    request_id: input.request_id,
  });
}
