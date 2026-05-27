/**
 * File: plan_merge.ts
 * Description: Produces a shallow merge plan by comparing incoming packet material against the local archive.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  actionReason,
  chooseTrustedExchangeAction,
  exchangeIssue,
  exchangeTrace,
  normalizeTrustedExchangeBundle,
  resolveTrustedExchangeLocalStatus,
  toTrustedExchangeStatus,
} from '../trusted_exchange_internal.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type PlanTrustedMergeInput,
  type TrustedExchangeAction,
  type TrustedExchangeLocalStatus,
  type TrustedExchangeMergePlan,
} from '../trusted_exchange_types.ts';

function mergeActionFromLocalStatus(localStatus: TrustedExchangeLocalStatus, parsed: boolean): TrustedExchangeAction {
  if (!parsed) {
    return 'block_invalid';
  }

  if (localStatus === 'duplicate_revision') {
    return 'skip_duplicate';
  }

  if (localStatus === 'manual_conflict') {
    return 'manual_conflict';
  }

  if (localStatus === 'new_packet') {
    return 'accept_new_packet';
  }

  if (localStatus === 'new_revision') {
    return 'accept_new_revision';
  }

  return chooseTrustedExchangeAction({
    readable: parsed,
    verified: false,
    localStatus,
    compatibilityNeedsAck: false,
    verificationNeedsAck: false,
  });
}

export async function planTrustedMerge(
  input: PlanTrustedMergeInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeMergePlan>> {
  const contextMode = input.context_mode ?? 'import_preview';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const normalized = normalizeTrustedExchangeBundle(input.bundle);

  for (const blocker of normalized.blockers) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_merge_bundle_blocked',
      path: 'bundle',
      message: blocker,
    }));
  }

  for (const warning of normalized.warnings) {
    issues.push(exchangeIssue({
      severity: 'warning',
      code: 'trusted_exchange_merge_bundle_warning',
      path: 'bundle',
      message: warning,
    }));
  }

  const items = [];

  for (const entry of normalized.entries) {
    const local = await resolveTrustedExchangeLocalStatus({
      entry,
      context: input,
    });
    issues.push(...local.issues);
    trace.push(...local.trace);

    const action = mergeActionFromLocalStatus(local.localStatus, Boolean(entry.parsed_packet));
    items.push({
      entry_index: entry.entry_index,
      entry_id: entry.entry_id,
      packet_ref: entry.packet_ref,
      revision_ref: entry.revision_ref,
      action,
      local_status: local.localStatus,
      reason: actionReason(action),
    });
  }

  const blockers = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);

  trace.push(exchangeTrace({
    step_id: 'exchange.merge.plan',
    status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.exchange.merge_plan.v0'],
    notes: `Planned shallow merge classification for ${items.length} packet entr${items.length === 1 ? 'y' : 'ies'}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    value: {
      result_kind: 'trusted.exchange_merge_plan',
      packet_count: items.length,
      accept_new_packet_count: items.filter((item) => item.action === 'accept_new_packet').length,
      accept_new_revision_count: items.filter((item) => item.action === 'accept_new_revision').length,
      skip_duplicate_count: items.filter((item) => item.action === 'skip_duplicate').length,
      manual_conflict_count: items.filter((item) => item.action === 'manual_conflict').length,
      blocked_count: items.filter((item) => item.action === 'block_invalid' || item.action === 'block_unsupported').length,
      items,
      warnings,
      blockers,
    },
    issues,
    trace,
    status: toTrustedExchangeStatus(issues),
    mode: contextMode,
  });
}
