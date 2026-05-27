/**
 * File: audit_trusted_archive_readiness.ts
 * Description: Audits whether Trusted Archive can reach the packet store and indexes.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { archiveIssue, archiveTrace, withTrustedArchiveStore } from '../trusted_archive_internal.ts';
import {
  TRUSTED_ARCHIVE_COORDINATOR_ID,
  type AuditTrustedArchiveReadinessInput,
  type TrustedArchiveReadinessReport,
} from '../trusted_archive_types.ts';

export async function auditTrustedArchiveReadiness(
  input: AuditTrustedArchiveReadinessInput = {}
): Promise<TrustedRuntimeCoordinatorResult<TrustedArchiveReadinessReport>> {
  const contextMode = input.context_mode ?? 'reseed';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  let databasePath: string | null = input.database_path ?? null;
  let packetCount = 0;
  let preferredPacketCount = 0;
  let searchRowCount = 0;

  try {
    await withTrustedArchiveStore(input, async (packetStore, activeDatabasePath) => {
      databasePath = activeDatabasePath;
      packetCount = 'listPacketIds' in packetStore && typeof packetStore.listPacketIds === 'function'
        ? (await packetStore.listPacketIds()).length
        : (await packetStore.listPreferredPackets()).length;
      preferredPacketCount = (await packetStore.listPreferredPackets()).length;
      searchRowCount = 'listSearchRows' in packetStore && typeof packetStore.listSearchRows === 'function'
        ? (await packetStore.listSearchRows()).length
        : preferredPacketCount;
    });
  } catch (error) {
    issues.push(archiveIssue({
      severity: 'error',
      code: 'trusted_archive_store_unavailable',
      path: 'packet_store',
      message: error instanceof Error
        ? error.message
        : 'Trusted Archive could not open the packet store.',
    }));
  }

  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const ready = blockingIssueCount === 0;

  trace.push(archiveTrace({
    step_id: 'archive.readiness.audit',
    status: ready ? 'ok' : 'error',
    preset_ids: ['trusted.archive_readiness.v0'],
    notes: ready
      ? `Trusted Archive can access ${preferredPacketCount} preferred packet(s).`
      : 'Trusted Archive packet-store access has blockers.',
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_ARCHIVE_COORDINATOR_ID,
    coordinator_kind: 'archive',
    value: {
      report_kind: 'trusted.archive_readiness_report',
      mode: contextMode,
      ready,
      database_path: databasePath,
      packet_count: packetCount,
      preferred_packet_count: preferredPacketCount,
      search_row_count: searchRowCount,
      blocking_issue_count: blockingIssueCount,
      warning_count: warningCount,
    },
    issues,
    trace,
    status: ready ? 'ok' : 'error',
    mode: contextMode,
  });
}
