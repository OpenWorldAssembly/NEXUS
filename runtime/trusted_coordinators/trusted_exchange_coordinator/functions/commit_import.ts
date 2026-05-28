/**
 * File: commit_import.ts
 * Description: Commits an Exchange import plan through Trusted Archive bundle import.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import { exchangeIssue, exchangeTrace, toTrustedExchangeStatus } from '../trusted_exchange_internal.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type CommitTrustedImportInput,
  type TrustedExchangeImportCommit,
} from '../trusted_exchange_types.ts';
import { planTrustedImportCommit } from './plan_import_commit.ts';

export async function commitTrustedImport(
  input: CommitTrustedImportInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportCommit>> {
  const contextMode = input.context_mode ?? 'import_preview';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const planResult = await planTrustedImportCommit({
    packet_store: input.packet_store,
    database_path: input.database_path,
    source_label: input.source_label,
    preview: input.preview,
    bundle: input.bundle,
    options: input.options,
    context_mode: contextMode,
  });
  issues.push(...planResult.issues);
  trace.push(...planResult.trace);

  const plan = planResult.value;
  if (!plan || plan.blocked_count > 0 || plan.manual_resolution_count > 0) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_import_commit_blocked',
      path: 'plan',
      message: 'Trusted Exchange import commit requires a non-blocked import plan.',
    }));
  }

  let importResult = null;
  if (!issues.some((issue) => issue.severity === 'error')) {
    const archiveImportResult = await trustedArchiveCoordinator.importBundle({
      packet_store: input.packet_store,
      database_path: input.database_path,
      bundle: input.bundle,
      context_mode: contextMode,
    });
    issues.push(...archiveImportResult.issues);
    trace.push(...archiveImportResult.trace);
    importResult = archiveImportResult.value;
  }

  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);
  const blockers = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);

  trace.push(exchangeTrace({
    step_id: 'exchange.import.commit',
    status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.exchange.import_commit.v0'],
    notes: `Committed ${importResult?.revision_count ?? 0} imported revision(s) through Trusted Archive.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    value: {
      result_kind: 'trusted.exchange_import_commit',
      source_label: input.source_label ?? plan?.source_label ?? null,
      import_result: importResult,
      plan,
      imported_revision_count: importResult?.revision_count ?? 0,
      skipped_duplicate_count: plan?.skip_duplicate_count ?? 0,
      warnings,
      blockers,
    },
    issues,
    trace,
    status: toTrustedExchangeStatus(issues),
    mode: contextMode,
  });
}
