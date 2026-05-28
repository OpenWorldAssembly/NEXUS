/**
 * File: trusted_archive_registry.ts
 * Description: Internal operation registry for the Trusted Archive Coordinator.
 */

import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { auditTrustedArchiveReadiness } from './functions/audit_trusted_archive_readiness.ts';
import { exportTrustedArchiveBundle } from './functions/export_archive_bundle.ts';
import { importTrustedArchiveBundle } from './functions/import_archive_bundle.ts';
import { queryTrustedArchiveEdges } from './functions/query_packet_edges.ts';
import { queryTrustedArchivedPackets } from './functions/query_archived_packets.ts';
import { readTrustedArchivedPacket } from './functions/read_archived_packet.ts';
import { resolveTrustedArchivedRevision } from './functions/resolve_archived_revision.ts';
import { storeTrustedCertifiedPacketSet } from './functions/store_certified_packet_set.ts';
import type { TrustedArchiveCoordinatorRequest } from './trusted_archive_types.ts';

type TrustedArchiveHandler = (request: TrustedArchiveCoordinatorRequest) => Promise<TrustedRuntimeCoordinatorResult<unknown>>;

const TRUSTED_ARCHIVE_REGISTRY: Record<TrustedArchiveCoordinatorRequest['operation'], TrustedArchiveHandler> = {
  store_certified_packet_set: (request) => {
    if (request.operation !== 'store_certified_packet_set') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return storeTrustedCertifiedPacketSet(request.input);
  },
  read_packet: (request) => {
    if (request.operation !== 'read_packet') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return readTrustedArchivedPacket(request.input);
  },
  query_packets: (request) => {
    if (request.operation !== 'query_packets') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return queryTrustedArchivedPackets(request.input);
  },
  resolve_revision: (request) => {
    if (request.operation !== 'resolve_revision') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return resolveTrustedArchivedRevision(request.input);
  },
  query_edges: (request) => {
    if (request.operation !== 'query_edges') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return queryTrustedArchiveEdges(request.input);
  },
  export_bundle: (request) => {
    if (request.operation !== 'export_bundle') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return exportTrustedArchiveBundle(request.input);
  },
  import_bundle: (request) => {
    if (request.operation !== 'import_bundle') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return importTrustedArchiveBundle(request.input);
  },
  audit_readiness: (request) => {
    if (request.operation !== 'audit_readiness') {
      throw new Error('Invalid Trusted Archive operation dispatch.');
    }
    return auditTrustedArchiveReadiness(request.input);
  },
};

export function runTrustedArchiveOperation(
  request: TrustedArchiveCoordinatorRequest
): Promise<TrustedRuntimeCoordinatorResult<unknown>> {
  return TRUSTED_ARCHIVE_REGISTRY[request.operation](request);
}
