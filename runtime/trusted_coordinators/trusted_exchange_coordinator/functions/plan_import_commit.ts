/**
 * File: plan_import_commit.ts
 * Description: Converts an import preview into a non-mutating commit plan.
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
import {
  actionReason,
  exchangeIssue,
  exchangeTrace,
  packetPreviewHasBlocker,
  packetPreviewHasConflict,
  previewActionToCommitAction,
  toTrustedExchangeStatus,
} from '../trusted_exchange_internal.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type PlanTrustedImportCommitInput,
  type TrustedExchangeImportCommitPlan,
} from '../trusted_exchange_types.ts';
import { previewTrustedImport } from './preview_import.ts';

export async function planTrustedImportCommit(
  input: PlanTrustedImportCommitInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportCommitPlan>> {
  const contextMode = input.context_mode ?? 'import_preview';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    operation_name: 'plan_import_commit',
    completion_policy: 'dry_run_only',
    mode: contextMode,
  });
  let preview = input.preview ?? null;

  if (!preview && input.bundle !== undefined) {
    const previewResult = await previewTrustedImport({
      packet_store: input.packet_store,
      database_path: input.database_path,
      source_label: input.source_label,
      bundle: input.bundle,
      options: input.options,
      context_mode: contextMode,
    });
    issues.push(...previewResult.issues);
    trace.push(...previewResult.trace);
    processChain = appendTrustedChildResult(processChain, previewResult, {
      stage_id: 'exchange.import.plan_commit.preview',
      operation_name: 'preview_import',
      notes: 'Generated import preview for commit planning.',
    });
    preview = previewResult.value;
  }

  if (!preview) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_import_preview_missing',
      path: 'preview',
      message: 'Trusted Exchange requires an import preview or bundle before planning an import commit.',
    }));
  }

  const items = (preview?.packet_previews ?? []).map((packetPreview) => {
    const action = previewActionToCommitAction(packetPreview.recommended_action);
    return {
      entry_index: packetPreview.entry_index,
      entry_id: packetPreview.entry_id,
      packet_ref: packetPreview.packet_ref,
      revision_ref: packetPreview.revision_ref,
      action,
      reason: actionReason(action),
    };
  });

  const requiredAcknowledgements = Array.from(new Set(items
    .filter((item) => item.action === 'needs_compatibility_acknowledgement' || item.action === 'needs_verification_acknowledgement')
    .map((item) => item.action)));

  const blockedCount = (preview?.packet_previews ?? []).filter(packetPreviewHasBlocker).length;
  const manualResolutionCount = (preview?.packet_previews ?? []).filter(packetPreviewHasConflict).length;

  trace.push(exchangeTrace({
    step_id: 'exchange.import.plan_commit',
    status: issues.some((issue) => issue.severity === 'error') ? 'error' : 'ok',
    preset_ids: ['trusted.exchange.import_commit_plan.v0'],
    notes: `Planned ${items.length} import commit item(s) without writing storage.`,
  }));
  processChain = appendTrustedProcessStage(
    processChain,
    completeTrustedProcessStage(
      startTrustedProcessStage({
        stage_id: 'exchange.import.plan_commit',
        coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
        coordinator_kind: 'exchange',
        operation_name: 'plan_import_commit',
        preset_ids: ['trusted.exchange.import_commit_plan.v0'],
        notes: `Planned ${items.length} import commit item(s) without writing storage.`,
      }),
      {
        status: issues.some((issue) => issue.severity === 'error') ? 'error' : 'ok',
        issues,
        artifacts: [{
          artifact_id: `exchange-import-plan:${items.length}`,
          artifact_kind: 'import_commit_plan',
          label: 'Import commit plan.',
          count: items.length,
          redacted: true,
        }],
        blocked_work: blockedCount > 0 || manualResolutionCount > 0
          ? [{
              work_id: 'exchange.import.commit',
              label: 'Import commit requires blocked/manual items to be resolved first.',
              reason_code: 'exchange.import_commit_blocked',
              count: blockedCount + manualResolutionCount,
            }]
          : [],
        skipped_work: items
          .filter((item) => item.action === 'skip_duplicate')
          .map((item) => ({
            work_id: item.entry_id,
            label: item.reason,
            packet_id: item.packet_ref?.packet_id ?? null,
            revision_id: item.revision_ref?.revision_id ?? null,
          })),
      }
    ),
    { issues }
  );

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    value: {
      result_kind: 'trusted.exchange_import_commit_plan',
      source_label: preview?.source_label ?? input.source_label ?? null,
      packet_count: items.length,
      import_revision_count: items.filter((item) => item.action === 'import_revision').length,
      skip_duplicate_count: items.filter((item) => item.action === 'skip_duplicate').length,
      manual_resolution_count: manualResolutionCount,
      blocked_count: blockedCount,
      required_acknowledgements: requiredAcknowledgements,
      items,
    },
    issues,
    trace,
    status: toTrustedExchangeStatus(issues),
    mode: contextMode,
    process_chain: completeTrustedProcessChain(processChain, { status: toTrustedExchangeStatus(issues) }),
  });
}
