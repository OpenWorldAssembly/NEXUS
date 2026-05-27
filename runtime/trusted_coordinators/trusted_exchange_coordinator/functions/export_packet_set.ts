/**
 * File: export_packet_set.ts
 * Description: Exports packet sets through Trusted Archive and wraps the low-level bundle in an Exchange manifest.
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
  type ExportTrustedPacketSetInput,
  type TrustedExchangeExportPacketSet,
} from '../trusted_exchange_types.ts';

function bundleByteCount(bytes: Uint8Array | null | undefined): number {
  return bytes?.byteLength ?? 0;
}

export async function exportTrustedPacketSet(
  input: ExportTrustedPacketSetInput
): Promise<TrustedRuntimeCoordinatorResult<TrustedExchangeExportPacketSet>> {
  const contextMode = input.context_mode ?? 'normal_runtime';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const optionIds = Object.entries(input.options ?? {})
    .filter(([, enabled]) => Boolean(enabled))
    .map(([key]) => key);

  if (optionIds.length > 0) {
    issues.push(exchangeIssue({
      severity: 'warning',
      code: 'trusted_exchange_export_options_not_expanded_yet',
      path: 'options',
      message: 'Trusted Exchange Pass A records export expansion options but still delegates root-ref export to Archive.',
    }));
  }

  let bundle = null;
  try {
    const exportResult = await trustedArchiveCoordinator.exportBundle({
      packet_store: input.packet_store,
      database_path: input.database_path,
      packet_refs: input.root_refs,
      context_mode: contextMode,
    });
    issues.push(...exportResult.issues);
    trace.push(...exportResult.trace);
    bundle = exportResult.value;
  } catch (error) {
    issues.push(exchangeIssue({
      severity: 'error',
      code: 'trusted_exchange_export_failed',
      path: 'root_refs',
      message: error instanceof Error
        ? error.message
        : 'Trusted Exchange could not export the requested packet set through Archive.',
    }));
  }

  const packetCount = bundle?.packet_count ?? 0;
  const revisionCount = bundle?.revision_count ?? 0;
  const blockers = issues.filter((issue) => issue.severity === 'error').map((issue) => issue.message);
  const warnings = issues.filter((issue) => issue.severity === 'warning').map((issue) => issue.message);

  trace.push(exchangeTrace({
    step_id: 'exchange.export.packet_set',
    status: blockers.length > 0 ? 'error' : warnings.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.exchange.export_packet_set.v0'],
    notes: `Prepared Exchange export wrapper for ${revisionCount} revision(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_EXCHANGE_COORDINATOR_ID,
    coordinator_kind: 'exchange',
    value: {
      result_kind: 'trusted.exchange_export_packet_set',
      root_refs: [...input.root_refs],
      packet_count: packetCount,
      revision_count: revisionCount,
      bundle,
      manifest: {
        manifest_kind: 'trusted.exchange_export_manifest',
        exported_at: new Date().toISOString(),
        root_refs: [...input.root_refs],
        requested_option_ids: optionIds,
        packet_count: packetCount,
        revision_count: revisionCount,
        bundle_byte_count: bundleByteCount(bundle?.bytes),
      },
      warnings,
      blockers,
    },
    issues,
    trace,
    status: toTrustedExchangeStatus(issues),
    mode: contextMode,
  });
}
