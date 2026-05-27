/**
 * File: preview_rebundle.ts
 * Description: Normalizes packet material into a rebundle preview without writing storage.
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
  createRootRefsFromEntries,
  exchangeIssue,
  exchangeTrace,
  normalizeTrustedExchangeBundle,
  toTrustedExchangeStatus,
} from '../trusted_exchange_internal.ts';
import {
  TRUSTED_EXCHANGE_COORDINATOR_ID,
  type PreviewTrustedRebundleInput,
  type TrustedExchangeRebundlePreview,
} from '../trusted_exchange_types.ts';

export async function previewTrustedRebundle(
  input: PreviewTrustedRebundleInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeRebundlePreview>> {
  const contextMode = input.context_mode ?? 'import_preview';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const normalized = normalizeTrustedExchangeBundle(input.bundle);

  for (const blocker of normalized.blockers) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_rebundle_blocked',
      path: 'bundle',
      message: blocker,
    }));
  }

  for (const warning of normalized.warnings) {
    issues.push(exchangeIssue({
      severity: 'warning',
      code: 'trusted_exchange_rebundle_warning',
      path: 'bundle',
      message: warning,
    }));
  }

  let readableCount = 0;
  for (const entry of normalized.entries) {
    const compatibility = trustedCompatibilityCoordinator.adaptPacketForRead({
      packet: entry.packet,
      target_schema_version: input.options?.target_schema_version,
      compatibility_strictness: input.options?.compatibility_strictness ?? 'advisory',
      context_mode: contextMode,
    });
    issues.push(...compatibility.issues);
    trace.push(...compatibility.trace);
    if (compatibility.value?.adapted_packet) {
      readableCount += 1;
    }
  }

  const verificationResult = await trustedVerificationCoordinator.verifyBundle({
    packet_store: input.packet_store,
    database_path: input.database_path,
    bundle: input.bundle,
    target_schema_version: input.options?.target_schema_version,
    verification_mode: input.options?.verification_mode ?? 'advisory',
    context_mode: contextMode,
  });
  issues.push(...verificationResult.issues);
  trace.push(...verificationResult.trace);

  const blockers = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);
  const rootRefs = input.root_refs ?? createRootRefsFromEntries(normalized.entries);

  trace.push(exchangeTrace({
    step_id: 'exchange.rebundle.preview',
    status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.exchange.rebundle_preview.v0'],
    notes: `Prepared normalized rebundle preview for ${normalized.entries.length} packet entr${normalized.entries.length === 1 ? 'y' : 'ies'}.`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    value: {
      result_kind: 'trusted.exchange_rebundle_preview',
      source_label: input.source_label ?? null,
      source_shape: normalized.source_shape,
      packet_count: normalized.entries.length,
      normalized_bundle: {
        bundle_version: '0.1.0',
        purpose: input.purpose ?? 'exchange.rebundle.preview',
        root_refs: rootRefs,
        packets: normalized.entries.map((entry) => entry.packet),
      },
      manifest: {
        manifest_kind: 'trusted.exchange_rebundle_manifest',
        created_at: new Date().toISOString(),
        packet_count: normalized.entries.length,
        readable_count: readableCount,
        warning_count: warnings.length,
        blocker_count: blockers.length,
      },
      verification_report: verificationResult.value ?? null,
      warnings,
      blockers,
    },
    issues,
    trace,
    status: toTrustedExchangeStatus(issues),
    mode: contextMode,
  });
}
