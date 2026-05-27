/**
 * File: audit_compatibility_coverage.ts
 * Description: Audits registry and Definition compatibility coverage across packet types.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  compatibilityIssue,
  compatibilityTrace,
  listCompatibilityAuditSummaries,
  parseTrustedPacketType,
  resolveTrustedAdapterPathMetadata,
  resolveTrustedCompatibilityProfileValue,
  toTrustedCompatibilityStatus,
} from '../trusted_compatibility_internal.ts';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type AuditTrustedCompatibilityCoverageInput,
  type TrustedCompatibilityCoverageAudit,
  type TrustedCompatibilityCoverageItem,
} from '../trusted_compatibility_types.ts';

export function auditTrustedCompatibilityCoverage(
  input: AuditTrustedCompatibilityCoverageInput = {}
): TrustedRuntimeCoordinatorResult<TrustedCompatibilityCoverageAudit> {
  const contextMode = input.context_mode ?? 'debug_audit';
  const strictness = input.compatibility_strictness ?? 'advisory';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const summaries = listCompatibilityAuditSummaries();
  const filters = input.packet_type_filters?.length
    ? new Set(input.packet_type_filters.map((packetType) => String(packetType)))
    : null;
  const checkedSummaries = summaries.filter((summary) => !filters || filters.has(summary.type));
  const unknownFilters = [...(filters ?? [])].filter(
    (packetType) => !summaries.some((summary) => summary.type === packetType)
  );

  for (const unknownFilter of unknownFilters) {
    const parsed = parseTrustedPacketType(unknownFilter);
    issues.push(...parsed.issues);
  }

  const items: TrustedCompatibilityCoverageItem[] = checkedSummaries.map((summary) => {
    const itemIssues: TrustedRuntimeCoordinatorIssue[] = [];
    const profile = resolveTrustedCompatibilityProfileValue({
      ...input,
      packet_type: summary.type,
      context_mode: contextMode,
    });
    trace.push(...profile.trace);
    itemIssues.push(...profile.issues.filter((issue) =>
      issue.code !== 'trusted_compatibility_definition_missing'
    ));

    if (!profile.value.definition_part_present) {
      itemIssues.push(compatibilityIssue({
        severity: 'warning',
        code: 'trusted_compatibility_definition_part_missing',
        path: `${summary.type}.packet_compatibility`,
        message: `No Definition packet_compatibility part is available for ${summary.type}.`,
      }));
    }

    if (profile.value.registry_definition_mismatches.length > 0) {
      for (const mismatch of profile.value.registry_definition_mismatches) {
        itemIssues.push(compatibilityIssue({
          severity: 'warning',
          code: 'trusted_compatibility_registry_definition_mismatch',
          path: `${summary.type}.compatibility`,
          message: mismatch,
        }));
      }
    }

    if (summary.support_level === 'current_only' && summary.has_legacy_versions) {
      itemIssues.push(compatibilityIssue({
        severity: 'warning',
        code: 'trusted_compatibility_current_only_has_legacy_versions',
        path: `${summary.type}.support_level`,
        message: `${summary.type} is marked current_only but has legacy schema versions registered.`,
      }));
    }

    if (summary.has_legacy_versions) {
      const legacyVersions = summary.supported_schema_versions.filter(
        (schemaVersion) => schemaVersion !== summary.current_schema_version
      );

      for (const legacyVersion of legacyVersions) {
        const adapterPath = resolveTrustedAdapterPathMetadata({
          packet_type: summary.type,
          source_schema_version: legacyVersion,
          target_schema_version: summary.current_schema_version,
        });

        if (!adapterPath.value.path_found) {
          itemIssues.push(...adapterPath.issues);
        }
      }
    }

    issues.push(...itemIssues);

    return {
      packet_type: summary.type,
      registry_present: true,
      definition_part_present: profile.value.definition_part_present,
      registry_current_schema_version: summary.current_schema_version,
      definition_current_schema_version: profile.value.definition_current_schema_version,
      supported_schema_versions: [...summary.supported_schema_versions],
      support_level: summary.support_level,
      write_target_policy: summary.write_target_policy,
      adapter_id_count: profile.value.adapter_ids.length,
      has_legacy_versions: summary.has_legacy_versions,
      has_write_preparation: summary.has_write_preparation,
      issues: itemIssues,
    };
  });

  const missingDefinitionPartCount = items.filter((item) => !item.definition_part_present).length;
  const mismatchCount = items.filter((item) => item.issues.some((issue) =>
    issue.code === 'trusted_compatibility_registry_definition_mismatch' ||
    issue.code === 'trusted_compatibility_definition_schema_mismatch'
  )).length;
  const readyPacketTypeCount = items.filter((item) => item.issues.every((issue) => issue.severity !== 'error')).length;

  trace.push(compatibilityTrace({
    step_id: 'compatibility.coverage.audit',
    status: issues.some((issue) => issue.severity === 'error') ? 'error' : issues.length > 0 ? 'partial' : 'ok',
    preset_ids: ['trusted.compatibility.coverage.v0'],
    notes: `Audited compatibility coverage for ${items.length} packet type(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_COMPATIBILITY_COORDINATOR_ID,
    coordinator_kind: 'compatibility',
    value: {
      report_kind: 'trusted.compatibility_coverage_audit',
      mode: contextMode,
      checked_packet_type_count: items.length,
      ready_packet_type_count: readyPacketTypeCount,
      missing_registry_count: unknownFilters.length,
      missing_definition_part_count: missingDefinitionPartCount,
      mismatch_count: mismatchCount,
      issue_count: issues.length,
      items,
    },
    issues,
    trace,
    status: toTrustedCompatibilityStatus(issues, strictness),
    mode: contextMode,
  });
}
