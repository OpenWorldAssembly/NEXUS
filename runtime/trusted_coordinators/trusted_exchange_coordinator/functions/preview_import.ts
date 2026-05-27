/**
 * File: preview_import.ts
 * Description: Previews incoming packet material without committing imports.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { trustedCompatibilityCoordinator } from '@runtime/trusted_coordinators/trusted_compatibility_coordinator/index.ts';
import { trustedVerificationCoordinator } from '@runtime/trusted_coordinators/trusted_verification_coordinator/index.ts';
import {
  chooseTrustedExchangeAction,
  exchangeIssue,
  exchangeTrace,
  normalizeTrustedExchangeBundle,
  packetPreviewHasBlocker,
  packetPreviewHasConflict,
  resolveTrustedExchangeLocalStatus,
  toTrustedExchangeStatus,
} from '../trusted_exchange_internal.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type PreviewTrustedImportInput,
  type TrustedExchangeImportPreview,
  type TrustedExchangePacketPreview,
} from '../trusted_exchange_types.ts';

export async function previewTrustedImport(
  input: PreviewTrustedImportInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeImportPreview>> {
  const contextMode = input.context_mode ?? 'import_preview';
  const verificationMode = input.options?.verification_mode ?? 'advisory';
  const compatibilityStrictness = input.options?.compatibility_strictness ?? 'advisory';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const normalized = normalizeTrustedExchangeBundle(input.bundle);

  for (const blocker of normalized.blockers) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_bundle_blocked',
      path: 'bundle',
      message: blocker,
    }));
  }

  for (const warning of normalized.warnings) {
    issues.push(exchangeIssue({
      severity: 'warning',
      code: 'trusted_exchange_bundle_warning',
      path: 'bundle',
      message: warning,
    }));
  }

  const compatibilityReport = [];
  const packetPreviews: TrustedExchangePacketPreview[] = [];

  const verificationResult = await trustedVerificationCoordinator.verifyBundle({
    packet_store: input.packet_store,
    database_path: input.database_path,
    bundle: input.bundle,
    target_schema_version: input.options?.target_schema_version,
    verification_mode: verificationMode,
    context_mode: contextMode,
  });
  issues.push(...verificationResult.issues);
  trace.push(...verificationResult.trace);
  const verificationReport = verificationResult.value ?? null;

  for (const entry of normalized.entries) {
    const entryWarnings: string[] = [];
    const entryBlockers: string[] = [];
    let readable = false;

    if (entry.parse_error) {
      entryWarnings.push(entry.parse_error);
    }

    const compatibility = trustedCompatibilityCoordinator.adaptPacketForRead({
      packet: entry.packet,
      target_schema_version: input.options?.target_schema_version,
      compatibility_strictness: compatibilityStrictness,
      context_mode: contextMode,
    });
    issues.push(...compatibility.issues);
    trace.push(...compatibility.trace);

    if (compatibility.value) {
      compatibilityReport.push(compatibility.value);
      readable = Boolean(compatibility.value.adapted_packet && compatibility.value.compatibility.is_supported);
      if (compatibility.value.compatibility.is_lossy || compatibility.value.compatibility.requires_loss_acknowledgement) {
        entryWarnings.push('Compatibility adaptation may be lossy or requires acknowledgement.');
      }
    } else {
      entryBlockers.push('Compatibility read failed.');
    }

    const local = await resolveTrustedExchangeLocalStatus({
      entry,
      context: input,
    });
    issues.push(...local.issues);
    trace.push(...local.trace);

    const verificationPacket = verificationReport?.packet_results.find((result) =>
      result.entry_id === entry.entry_id ||
      (entry.packet_ref && result.packet_ref?.packet_id === entry.packet_ref.packet_id &&
        result.revision_ref?.revision_id === entry.revision_ref?.revision_id)
    ) ?? verificationReport?.packet_results[entry.entry_index] ?? null;
    const verified = verificationPacket?.overall_status === 'passed';

    if (verificationPacket?.overall_status === 'warning') {
      entryWarnings.push(...verificationPacket.warnings);
    }
    if (verificationPacket?.overall_status === 'blocked') {
      entryBlockers.push(...verificationPacket.blockers);
    }

    const recommendedAction = chooseTrustedExchangeAction({
      readable,
      verified,
      localStatus: local.localStatus,
      compatibilityNeedsAck: entryWarnings.some((warning) => warning.toLowerCase().includes('compatibility')),
      verificationNeedsAck: Boolean(verificationPacket && verificationPacket.overall_status === 'warning'),
    });

    packetPreviews.push({
      entry_index: entry.entry_index,
      entry_id: entry.entry_id,
      packet_ref: entry.packet_ref,
      revision_ref: entry.revision_ref,
      packet_type: entry.packet_type,
      declared_schema_version: entry.declared_schema_version,
      readable,
      verified,
      local_status: local.localStatus,
      recommended_action: recommendedAction,
      warnings: entryWarnings,
      blockers: entryBlockers,
    });
  }

  const warnings = issues
    .filter((issue) => issue.severity === 'warning')
    .map((issue) => issue.message);
  const blockers = issues
    .filter((issue) => issue.severity === 'error')
    .map((issue) => issue.message);
  const blockedCount = packetPreviews.filter(packetPreviewHasBlocker).length;
  const conflictCount = packetPreviews.filter(packetPreviewHasConflict).length;

  trace.push(exchangeTrace({
    step_id: 'exchange.import.preview',
    status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.exchange.import_preview.v0'],
    notes: `Previewed ${packetPreviews.length} incoming packet entr${packetPreviews.length === 1 ? 'y' : 'ies'}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    value: {
      result_kind: 'trusted.exchange_import_preview',
      source_label: input.source_label ?? null,
      source_shape: normalized.source_shape,
      packet_count: packetPreviews.length,
      readable_count: packetPreviews.filter((preview) => preview.readable).length,
      verified_count: packetPreviews.filter((preview) => preview.verified).length,
      new_packet_count: packetPreviews.filter((preview) => preview.local_status === 'new_packet').length,
      new_revision_count: packetPreviews.filter((preview) => preview.local_status === 'new_revision').length,
      duplicate_revision_count: packetPreviews.filter((preview) => preview.local_status === 'duplicate_revision').length,
      conflict_count: conflictCount,
      blocked_count: blockedCount,
      warnings,
      blockers,
      packet_previews: packetPreviews,
      verification_report: verificationReport,
      compatibility_report: compatibilityReport,
    },
    issues,
    trace,
    status: toTrustedExchangeStatus(issues),
    mode: contextMode,
  });
}
