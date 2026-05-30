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
import {
  createTrustedExchangeArchiveBundle,
  exchangeIssue,
  exchangeTrace,
  keyTrustedExchangeEntries,
  normalizeTrustedExchangeBundle,
  toTrustedExchangeStatus,
} from '../trusted_exchange_internal.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type CommitTrustedImportInput,
  type TrustedExchangeImportCommit,
  type TrustedExchangeImportCommitPlan,
  type TrustedExchangeImportCommitPlanItem,
  type TrustedExchangePacketEntry,
} from '../trusted_exchange_types.ts';
import type { TrustedArchivePreferredHeadSnapshot } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import { planTrustedImportCommit } from './plan_import_commit.ts';

function itemRequiresAcknowledgement(item: TrustedExchangeImportCommitPlanItem): boolean {
  return item.required_acknowledgements.length > 0;
}

function itemIsCommitAccepted(input: {
  item: TrustedExchangeImportCommitPlanItem;
  acceptedAcknowledgements: Set<string>;
}): boolean {
  if (input.item.action === 'import_revision') {
    return true;
  }

  if (!itemRequiresAcknowledgement(input.item)) {
    return false;
  }

  return input.item.required_acknowledgements.every((acknowledgement) =>
    input.acceptedAcknowledgements.has(acknowledgement)
  );
}

function findEntryForPlanItem(input: {
  item: TrustedExchangeImportCommitPlanItem;
  keyedEntries: Map<string, TrustedExchangePacketEntry>;
  entries: readonly TrustedExchangePacketEntry[];
}): TrustedExchangePacketEntry | null {
  if (input.item.normalized_key) {
    return input.keyedEntries.get(input.item.normalized_key) ?? null;
  }

  return input.entries.find((entry) => entry.entry_index === input.item.entry_index) ?? null;
}

async function resolveImportedRevisionKeys(input: {
  entries: readonly TrustedExchangePacketEntry[];
  packet_store: CommitTrustedImportInput['packet_store'];
  database_path: CommitTrustedImportInput['database_path'];
  context_mode: CommitTrustedImportInput['context_mode'];
}): Promise<{
  resolvedKeys: string[];
  missingKeys: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}> {
  const resolvedKeys: string[] = [];
  const missingKeys: string[] = [];
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];

  for (const entry of input.entries) {
    if (!entry.packet_ref || !entry.revision_ref || !entry.normalized_key) {
      continue;
    }

    const resolution = await trustedArchiveCoordinator.resolveRevision({
      packet_store: input.packet_store,
      database_path: input.database_path,
      packet_ref: entry.packet_ref,
      revision_id: entry.revision_ref.revision_id,
      context_mode: input.context_mode ?? 'import_preview',
    });
    issues.push(...resolution.issues.filter((issue) => issue.code !== 'trusted_archive_revision_not_found'));
    trace.push(...resolution.trace);

    if (resolution.value?.resolved_revision) {
      resolvedKeys.push(entry.normalized_key);
    } else {
      missingKeys.push(entry.normalized_key);
    }
  }

  return { resolvedKeys, missingKeys, issues, trace };
}

async function snapshotPreferredHeads(input: {
  entries: readonly TrustedExchangePacketEntry[];
  packet_store: CommitTrustedImportInput['packet_store'];
  database_path: CommitTrustedImportInput['database_path'];
  context_mode: CommitTrustedImportInput['context_mode'];
}): Promise<{
  snapshots: TrustedArchivePreferredHeadSnapshot[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}> {
  const packetIds = Array.from(new Set(
    input.entries
      .map((entry) => entry.packet_ref?.packet_id ?? null)
      .filter((packetId): packetId is string => Boolean(packetId))
  ));
  const snapshots: TrustedArchivePreferredHeadSnapshot[] = [];
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];

  for (const packetId of packetIds) {
    const resolution = await trustedArchiveCoordinator.resolveRevision({
      packet_store: input.packet_store,
      database_path: input.database_path,
      packet_ref: { packet_id: packetId },
      context_mode: input.context_mode ?? 'import_preview',
    });
    issues.push(...resolution.issues.filter((issue) => issue.code !== 'trusted_archive_revision_not_found'));
    trace.push(...resolution.trace);
    snapshots.push({
      packet_id: packetId,
      preferred_revision_id: resolution.value?.preferred_revision?.revision_id ?? null,
      head_revision_ids: resolution.value?.heads.head_revisions.map(
        (revision) => revision.revision_id
      ) ?? [],
    });
  }

  return { snapshots, issues, trace };
}

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
  let planResult: Awaited<ReturnType<typeof planTrustedImportCommit>> | null = null;
  let plan: TrustedExchangeImportCommitPlan | null = input.plan ?? null;

  if (!plan) {
    planResult = await planTrustedImportCommit({
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
    plan = planResult.value;
  }

  const acceptedAcknowledgements = new Set(input.accepted_acknowledgements ?? []);
  const normalized = normalizeTrustedExchangeBundle(input.bundle);
  const normalizedIssues = [
    ...normalized.blockers.map((blocker) => exchangeIssue({
      severity: 'error' as const,
      code: 'trusted_exchange_bundle_blocked',
      path: 'bundle',
      message: blocker,
    })),
    ...normalized.warnings.map((warning) => exchangeIssue({
      severity: 'warning' as const,
      code: 'trusted_exchange_bundle_warning',
      path: 'bundle',
      message: warning,
    })),
  ];
  issues.push(...normalizedIssues);
  const keyedEntries = keyTrustedExchangeEntries(normalized.entries);

  if (!plan) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_import_plan_missing',
      path: 'plan',
      message: 'Trusted Exchange requires an import plan before committing an import.',
    }));
  }

  const missingAcknowledgements = Array.from(new Set((plan?.items ?? [])
    .flatMap((item) => item.required_acknowledgements)
    .filter((acknowledgement) => !acceptedAcknowledgements.has(acknowledgement))));

  for (const acknowledgement of missingAcknowledgements) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_import_acknowledgement_missing',
      path: 'accepted_acknowledgements',
      message: `Import commit requires acknowledgement: ${acknowledgement}.`,
    }));
  }

  if (plan && (plan.blocked_count > 0 || plan.manual_resolution_count > 0)) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_import_commit_blocked',
      path: 'plan',
      message: 'Trusted Exchange import commit requires a non-blocked import plan.',
    }));
  }

  const acceptedItems = (plan?.items ?? []).filter((item) =>
    itemIsCommitAccepted({ item, acceptedAcknowledgements })
  );
  const skippedRevisionKeys = (plan?.items ?? [])
    .filter((item) => item.action === 'skip_duplicate')
    .map((item) => item.normalized_key)
    .filter((key): key is string => Boolean(key));
  const acceptedEntries: TrustedExchangePacketEntry[] = [];

  for (const item of acceptedItems) {
    const entry = findEntryForPlanItem({ item, keyedEntries, entries: normalized.entries });
    if (!entry || !entry.normalized_key) {
      issues.push(exchangeIssue({
        severity: 'error',
        code: 'trusted_exchange_import_plan_entry_missing',
        path: `plan.items.${item.entry_index}`,
        message: `Import plan item ${item.entry_id} was accepted, but its normalized packet entry could not be found in the commit bundle.`,
      }));
      continue;
    }

    acceptedEntries.push(entry);
  }

  if (issues.some((issue) => issue.severity === 'error')) {
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

  let importResult: TrustedExchangeImportCommit['import_result'] = null;
  let importedRevisionKeys: string[] = [];
  let missingArchiveKeys: string[] = [];
  let repairedPreferredPacketCount = 0;
  let restoredPreferredPacketCount = 0;
  let divergedPacketCount = 0;
  const unexpectedArchiveKeys: string[] = [];
  const acceptedRevisionKeys = acceptedEntries
    .map((entry) => entry.normalized_key)
    .filter((key): key is string => Boolean(key));

  if (!issues.some((issue) => issue.severity === 'error') && acceptedEntries.length > 0) {
    const preferredSnapshots = await snapshotPreferredHeads({
      entries: acceptedEntries,
      packet_store: input.packet_store,
      database_path: input.database_path,
      context_mode: contextMode,
    });
    issues.push(...preferredSnapshots.issues);
    trace.push(...preferredSnapshots.trace);

    const narrowedBundle = createTrustedExchangeArchiveBundle(acceptedEntries);
    try {
      const archiveImportResult = await trustedArchiveCoordinator.importBundle({
        packet_store: input.packet_store,
        database_path: input.database_path,
        bundle: narrowedBundle,
        context_mode: contextMode,
      });
      issues.push(...archiveImportResult.issues);
      trace.push(...archiveImportResult.trace);
      importResult = archiveImportResult.value;
      processChain = appendTrustedChildResult(processChain, archiveImportResult, {
        stage_id: 'exchange.import.commit.archive_import',
        operation_name: 'archive_import_bundle',
        notes: 'Committed Exchange-accepted revisions through Trusted Archive.',
      });
    } catch (error) {
      issues.push(exchangeIssue({
        severity: 'error',
        code: 'trusted_exchange_archive_import_failed',
        path: 'archive_import',
        message: error instanceof Error
          ? error.message
          : 'Archive import failed during Exchange commit.',
      }));
    }

    const resolved = importResult
      ? await resolveImportedRevisionKeys({
          entries: acceptedEntries,
          packet_store: input.packet_store,
          database_path: input.database_path,
          context_mode: contextMode,
        })
      : { resolvedKeys: [], missingKeys: acceptedRevisionKeys, issues: [], trace: [] };
    issues.push(...resolved.issues);
    trace.push(...resolved.trace);
    importedRevisionKeys = resolved.resolvedKeys;
    missingArchiveKeys = resolved.missingKeys;

    if (importResult && importResult.revision_count > acceptedEntries.length) {
      unexpectedArchiveKeys.push(`archive_reported_${importResult.revision_count}_imports_for_${acceptedEntries.length}_planned_revisions`);
      issues.push(exchangeIssue({
        severity: 'error',
        code: 'trusted_exchange_archive_import_unexpected_count',
        path: 'archive_import',
        message: `Archive reported ${importResult.revision_count} imported revision(s), but Exchange only accepted ${acceptedEntries.length}.`,
      }));
    }

    if (missingArchiveKeys.length > 0) {
      issues.push(exchangeIssue({
        severity: 'error',
        code: 'trusted_exchange_archive_import_missing_revision',
        path: 'archive_import',
        message: `Archive import did not resolve ${missingArchiveKeys.length} planned revision(s) after commit.`,
      }));
    }

    if (importResult) {
      const preferredRepair = await trustedArchiveCoordinator.repairPreferredHeadsAfterImport({
        packet_store: input.packet_store,
        database_path: input.database_path,
        packet_ids: Array.from(new Set(acceptedEntries
          .map((entry) => entry.packet_ref?.packet_id ?? null)
          .filter((packetId): packetId is string => Boolean(packetId)))),
        snapshots: preferredSnapshots.snapshots,
        context_mode: contextMode,
      });
      issues.push(...preferredRepair.issues);
      trace.push(...preferredRepair.trace);
      repairedPreferredPacketCount = preferredRepair.value?.repaired_packet_count ?? 0;
      restoredPreferredPacketCount = preferredRepair.value?.restored_preferred_packet_count ?? 0;
      divergedPacketCount = preferredRepair.value?.diverged_packet_count ?? 0;
      processChain = appendTrustedChildResult(processChain, preferredRepair, {
        stage_id: 'exchange.import.commit.archive_preferred_head_repair',
        operation_name: 'repair_preferred_heads_after_import',
        notes: 'Asked Trusted Archive to reconcile preferred heads after import.',
      });
    }

    if (importResult && importResult.revision_count < acceptedEntries.length && missingArchiveKeys.length === 0) {
      issues.push(exchangeIssue({
        severity: 'warning',
        code: 'trusted_exchange_archive_import_skipped_planned_revision',
        path: 'archive_import',
        message: 'Archive imported fewer revisions than Exchange accepted, but all accepted revision keys now resolve locally. They may have been duplicates by commit time.',
      }));
    }
  }

  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);
  const blockers = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);

  trace.push(exchangeTrace({
    step_id: 'exchange.import.commit',
    status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.exchange.import_commit.v0'],
    notes: `Committed ${importResult?.revision_count ?? 0} imported revision(s) through Trusted Archive from ${acceptedEntries.length} Exchange-accepted revision(s).`,
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
              label: 'Committed Exchange-accepted bundle import through Archive.',
              count: importResult.revision_count,
            }]
          : acceptedEntries.length === 0 && blockers.length === 0
            ? [{
                work_id: 'exchange.import.commit',
                label: 'Import commit had no new Exchange-accepted revisions to archive.',
                count: 0,
              }]
            : [],
        blocked_work: blockers.length > 0
          ? [{
              work_id: 'exchange.import.commit',
              label: 'Import commit did not write archive revisions.',
              reason_code: 'exchange.import_commit_blocked',
              count: plan?.packet_count ?? null,
            }]
          : [],
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
      planned_import_count: acceptedRevisionKeys.length,
      archived_import_count: importResult?.revision_count ?? 0,
      skipped_count: skippedRevisionKeys.length,
      blocked_count: plan?.blocked_count ?? 0,
      imported_revision_keys: importedRevisionKeys,
      skipped_revision_keys: skippedRevisionKeys,
      unexpected_archive_keys: unexpectedArchiveKeys,
      missing_archive_keys: missingArchiveKeys,
      repaired_preferred_packet_count: repairedPreferredPacketCount,
      restored_preferred_packet_count: restoredPreferredPacketCount,
      diverged_packet_count: divergedPacketCount,
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
