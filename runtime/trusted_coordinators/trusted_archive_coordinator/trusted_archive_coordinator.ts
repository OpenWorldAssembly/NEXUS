/**
 * File: trusted_archive_coordinator.ts
 * Description: Gated public Trusted Archive Coordinator surface for packet-store writes, reads, and indexes.
 */

import type { PacketReadMode } from '@core/schema/packet-schema';
import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { runTrustedArchiveOperation } from './trusted_archive_registry.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type AuditTrustedArchiveReadinessInput,
  type ExportTrustedArchiveBundleInput,
  type QueryTrustedArchivedPacketsInput,
  type QueryTrustedArchiveEdgesInput,
  type ReadTrustedArchivedPacketInput,
  type ResolveTrustedArchivedRevisionInput,
  type StoreTrustedCertifiedPacketSetInput,
  type TrustedArchiveBundleExport,
  type TrustedArchiveEdgeResult,
  type TrustedArchiveQueryResult,
  type TrustedArchiveReadinessReport,
  type TrustedArchiveReadResult,
  type TrustedArchiveReceipt,
  type TrustedArchiveRevisionResolution,
} from './trusted_archive_types.ts';

function castPromise<TValue>(
  result: Promise<TrustedRuntimeCoordinatorResult<unknown>>
): Promise<TrustedRuntimeCoordinatorResult<TValue>> {
  return result as Promise<TrustedRuntimeCoordinatorResult<TValue>>;
}

export const trustedArchiveCoordinator = {
  id: 'trusted_archive_coordinator.v0',

  storeCertifiedPacketSet(
    input: StoreTrustedCertifiedPacketSetInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReceipt>> {
    return castPromise(runTrustedArchiveOperation({
      operation: 'store_certified_packet_set',
      input,
    }));
  },

  readPacket: <TMode extends PacketReadMode = 'adapted'>(
    input: ReadTrustedArchivedPacketInput<TMode>
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReadResult<TMode>>> =>
    castPromise(runTrustedArchiveOperation({
      operation: 'read_packet',
      input,
    })),

  queryPackets(
    input?: QueryTrustedArchivedPacketsInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveQueryResult>> {
    return castPromise(runTrustedArchiveOperation({
      operation: 'query_packets',
      input,
    }));
  },

  resolveRevision(
    input: ResolveTrustedArchivedRevisionInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveRevisionResolution>> {
    return castPromise(runTrustedArchiveOperation({
      operation: 'resolve_revision',
      input,
    }));
  },

  queryEdges(
    input: QueryTrustedArchiveEdgesInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveEdgeResult>> {
    return castPromise(runTrustedArchiveOperation({
      operation: 'query_edges',
      input,
    }));
  },

  exportBundle(
    input: ExportTrustedArchiveBundleInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveBundleExport>> {
    return castPromise(runTrustedArchiveOperation({
      operation: 'export_bundle',
      input,
    }));
  },

  auditReadiness(
    input?: AuditTrustedArchiveReadinessInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReadinessReport>> {
    return castPromise(runTrustedArchiveOperation({
      operation: 'audit_readiness',
      input,
    }));
  },
} as const satisfies {
  id: typeof TRUSTED_ARCHIVE_COORDINATOR_ID;
  storeCertifiedPacketSet(input: StoreTrustedCertifiedPacketSetInput): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReceipt>>;
  readPacket<TMode extends PacketReadMode = 'adapted'>(input: ReadTrustedArchivedPacketInput<TMode>): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReadResult<TMode>>>;
  queryPackets(input?: QueryTrustedArchivedPacketsInput): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveQueryResult>>;
  resolveRevision(input: ResolveTrustedArchivedRevisionInput): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveRevisionResolution>>;
  queryEdges(input: QueryTrustedArchiveEdgesInput): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveEdgeResult>>;
  exportBundle(input: ExportTrustedArchiveBundleInput): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveBundleExport>>;
  auditReadiness(input?: AuditTrustedArchiveReadinessInput): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReadinessReport>>;
};
