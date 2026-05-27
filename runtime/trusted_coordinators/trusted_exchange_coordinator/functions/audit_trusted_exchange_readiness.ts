/**
 * File: audit_trusted_exchange_readiness.ts
 * Description: Audits Trusted Exchange dependency seams and local packet movement readiness.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import { trustedCompatibilityCoordinator } from '@runtime/trusted_coordinators/trusted_compatibility_coordinator/index.ts';
import { trustedVerificationCoordinator } from '@runtime/trusted_coordinators/trusted_verification_coordinator/index.ts';
import { createAssemblyPacket } from '@core/packets/builders';
import {
  exchangeIssue,
  exchangeTrace,
  normalizeTrustedExchangeBundle,
  toTrustedExchangeStatus,
} from '../trusted_exchange_internal.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type AuditTrustedExchangeReadinessInput,
  type TrustedExchangeReadinessReport,
} from '../trusted_exchange_types.ts';

export async function auditTrustedExchangeReadiness(
  input: AuditTrustedExchangeReadinessInput = {}
): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeReadinessReport>> {
  const contextMode = input.context_mode ?? 'debug_audit';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const samplePacket = createAssemblyPacket({
    packet_id: 'nexus:element/exchange-readiness-sample',
    created_at: '2026-05-27T00:00:00.000Z',
    name: 'Exchange readiness sample',
    subtype: 'assembly',
    locality_label: 'Exchange readiness sample',
  });

  const compatibility = trustedCompatibilityCoordinator.auditReadiness({
    context_mode: contextMode,
  });
  issues.push(...compatibility.issues);
  trace.push(...compatibility.trace);

  const verification = trustedVerificationCoordinator.auditReadiness({
    context_mode: contextMode,
  });
  issues.push(...verification.issues);
  trace.push(...verification.trace);

  let archiveReady = false;
  try {
    const archive = await trustedArchiveCoordinator.auditReadiness({
      packet_store: input.packet_store,
      database_path: input.database_path,
      context_mode: contextMode,
    });
    archiveReady = archive.value?.ready ?? false;
    issues.push(...archive.issues);
    trace.push(...archive.trace);
  } catch (error) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_archive_audit_failed',
      path: 'archive',
      message: error instanceof Error
        ? error.message
        : 'Trusted Exchange could not audit the Archive seam.',
    }));
  }

  const normalization = normalizeTrustedExchangeBundle({ packets: [samplePacket] });
  const bundleNormalizationReady = normalization.packet_count === 1 && normalization.entries[0]?.parsed_packet !== null;
  const mergePlanningReady = bundleNormalizationReady && Boolean(samplePacket.header.revision_id);

  if (!bundleNormalizationReady) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_bundle_normalization_unavailable',
      path: 'bundle',
      message: 'Trusted Exchange could not normalize a sample bundle.',
    }));
  }

  const compatibilityReady = compatibility.value?.ready ?? false;
  const verificationReady = verification.value?.ready ?? false;
  const blockingIssueCount = issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = issues.filter((issue) => issue.severity === 'warning').length;
  const ready = compatibilityReady && verificationReady && archiveReady && bundleNormalizationReady && mergePlanningReady && blockingIssueCount === 0;

  trace.push(exchangeTrace({
    step_id: 'exchange.readiness.audit',
    status: ready ? 'ok' : blockingIssueCount > 0 ? 'error' : 'partial',
    preset_ids: ['trusted.exchange_readiness.v0'],
    notes: ready
      ? 'Trusted Exchange dependency seams are reachable.'
      : 'Trusted Exchange dependency seam readiness has blockers or warnings.',
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    value: {
      report_kind: 'trusted.exchange_readiness_report',
      mode: contextMode,
      ready,
      compatibility_ready: compatibilityReady,
      verification_ready: verificationReady,
      archive_ready: archiveReady,
      bundle_normalization_ready: bundleNormalizationReady,
      merge_planning_ready: mergePlanningReady,
      blocking_issue_count: blockingIssueCount,
      warning_count: warningCount,
    },
    issues,
    trace,
    status: toTrustedExchangeStatus(issues),
    mode: contextMode,
  });
}
