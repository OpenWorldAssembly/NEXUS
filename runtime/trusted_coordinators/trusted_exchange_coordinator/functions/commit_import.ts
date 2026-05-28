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
import {
  appendTrustedChildResult,
  appendTrustedProcessStage,
  completeTrustedProcessChain,
  completeTrustedProcessStage,
  createTrustedProcessChain,
  startTrustedProcessStage,
} from '@runtime/trusted_coordinators/trusted_process.ts';
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
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    operation_name: 'commit_import',
    completion_policy: 'preserve_partial',
    mode: contextMode,
  });
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
  processChain = appendTrustedChildResult(processChain, planResult, {
    stage_id: 'exchange.import.plan_commit.child',
    operation_name: 'plan_import_commit',
    notes: 'Planned import commit before archive write.',
  });

  const plan = planResult.value;
  if (!plan || plan.blocked_count > 0 || plan.manual_resolution_count > 0) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_import_commit_blocked',
      path: 'plan',
      message: 'Trusted Exchange import commit requires a non-blocked import plan.',
    }));
  }
  if (!plan || plan.blocked_count > 0 || plan.manual_resolution_count > 0) {
    processChain = appendTrustedProcessStage(
      processChain,
      completeTrustedProcessStage(
        startTrustedProcessStage({
          stage_id: 'exchange.import.commit.preflight',
          coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
          coordinator_kind: 'exchange',
          operation_name: 'preflight_import_commit',
          preset_ids: ['trusted.exchange.import_commit.v0'],
          notes: 'Checked import commit plan before Archive import.',
        }),
        {
          status: 'blocked',
          issues,
          blocked_work: [{
            work_id: 'archive.bundle.import',
            label: 'Archive import was not attempted because the Exchange plan was blocked.',
            reason_code: 'exchange.import_commit_blocked',
            count: plan?.packet_count ?? null,
          }],
        }
      ),
      { issues }
    );
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
    processChain = appendTrustedChildResult(processChain, archiveImportResult, {
      stage_id: 'exchange.import.commit.archive_import',
      operation_name: 'archive_import_bundle',
      notes: 'Committed import through Trusted Archive.',
    });
  }

  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);
  const blockers = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);

  trace.push(exchangeTrace({
    step_id: 'exchange.import.commit',
    status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.exchange.import_commit.v0'],
    notes: `Committed ${importResult?.revision_count ?? 0} imported revision(s) through Trusted Archive.`,
  }));
  processChain = appendTrustedProcessStage(
    processChain,
    completeTrustedProcessStage(
      startTrustedProcessStage({
        stage_id: 'exchange.import.commit',
        coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
        coordinator_kind: 'exchange',
        operation_name: 'commit_import',
        preset_ids: ['trusted.exchange.import_commit.v0'],
        notes: `Committed ${importResult?.revision_count ?? 0} imported revision(s) through Trusted Archive.`,
      }),
      {
        status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
        issues,
        completed_work: importResult
          ? [{
              work_id: 'exchange.import.commit',
              label: 'Committed bundle import through Exchange.',
              count: importResult.revision_count,
            }]
          : [],
        blocked_work: importResult
          ? []
          : [{
              work_id: 'exchange.import.commit',
              label: 'Import commit did not write archive revisions.',
              reason_code: blockers[0] ? 'exchange.import_commit_blocked' : 'exchange.import_preview_missing',
              count: plan?.packet_count ?? null,
            }],
      }
    ),
    { issues }
  );

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
    process_chain: completeTrustedProcessChain(processChain, { status: toTrustedExchangeStatus(issues) }),
  });
}
