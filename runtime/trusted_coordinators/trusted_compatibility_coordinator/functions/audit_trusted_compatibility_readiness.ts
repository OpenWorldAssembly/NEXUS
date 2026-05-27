/**
 * File: audit_trusted_compatibility_readiness.ts
 * Description: Audits whether Trusted Compatibility can reach core registry and Definition descriptors.
 */

import {
  createAssemblyPacket,
} from '@core/packets/builders';
import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  compatibilityIssue,
  compatibilityTrace,
  inspectPacketForTrustedCompatibility,
  listCompatibilityAuditSummaries,
  preparePacketForTrustedWrite,
  resolveTrustedAdapterPathMetadata,
  resolveTrustedCompatibilityProfileValue,
  toTrustedCompatibilityStatus,
} from '../trusted_compatibility_internal.ts';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type AuditTrustedCompatibilityReadinessInput,
  type TrustedCompatibilityReadinessReport,
} from '../trusted_compatibility_types.ts';

export function auditTrustedCompatibilityReadiness(
  input: AuditTrustedCompatibilityReadinessInput = {}
): TrustedRuntimeCoordinatorResult<TrustedCompatibilityReadinessReport> {
  const contextMode = input.context_mode ?? 'debug_audit';
  const strictness = input.compatibility_strictness ?? 'advisory';
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  let coreRegistryAvailable = false;
  let definitionLookupAvailable = false;
  let readAdaptationAvailable = false;
  let writePreparationAvailable = false;
  let sameVersionPathAvailable = false;
  let missingPathReported = false;
  let checkedPacketTypeCount = 0;

  try {
    const summaries = listCompatibilityAuditSummaries();
    checkedPacketTypeCount = summaries.length;
    coreRegistryAvailable = summaries.length > 0;
  } catch (error) {
    issues.push(compatibilityIssue({
      severity: 'error',
      code: 'trusted_compatibility_registry_unavailable',
      path: 'core.schema.compatibility.registry',
      message: error instanceof Error ? error.message : 'Core compatibility registry is unavailable.',
    }));
  }

  const profile = resolveTrustedCompatibilityProfileValue({
    ...input,
    packet_type: 'Definition',
    context_mode: contextMode,
  });
  trace.push(...profile.trace);
  issues.push(...profile.issues.filter((issue) => issue.severity === 'error'));
  definitionLookupAvailable = Boolean(profile.value.definition_part_present);

  const packet = createAssemblyPacket({
    packet_id: 'nexus:element/trusted-compatibility-readiness',
    created_at: '2026-05-27T00:00:00.000Z',
    name: 'Trusted Compatibility Readiness',
    subtype: 'assembly',
    locality_label: 'Trusted Compatibility Readiness',
  });
  const read = inspectPacketForTrustedCompatibility({ packet });
  issues.push(...read.issues);
  readAdaptationAvailable = Boolean(read.inspected?.adapted_packet);

  const write = preparePacketForTrustedWrite({ packet });
  issues.push(...write.issues);
  writePreparationAvailable = Boolean(write.prepared?.prepared_packet);

  const sameVersionPath = resolveTrustedAdapterPathMetadata({
    packet_type: 'Element',
    source_schema_version: '1.0.0',
    target_schema_version: '1.0.0',
  });
  issues.push(...sameVersionPath.issues);
  sameVersionPathAvailable = sameVersionPath.value.path_found && sameVersionPath.value.same_version;

  const missingPath = resolveTrustedAdapterPathMetadata({
    packet_type: 'Element',
    source_schema_version: '0.0.0-readiness-missing',
    target_schema_version: '1.0.0',
  });
  missingPathReported = !missingPath.value.path_found && missingPath.issues.length > 0;

  const ready = coreRegistryAvailable &&
    definitionLookupAvailable &&
    readAdaptationAvailable &&
    writePreparationAvailable &&
    sameVersionPathAvailable &&
    missingPathReported &&
    issues.every((issue) => issue.severity !== 'error');

  trace.push(compatibilityTrace({
    step_id: 'compatibility.readiness.audit',
    status: ready ? 'ok' : 'partial',
    preset_ids: ['trusted.compatibility.readiness.v0'],
    notes: ready
      ? 'Trusted Compatibility core registry, read, write, path, and Definition seams are ready.'
      : 'Trusted Compatibility readiness has gaps.',
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_COMPATIBILITY_COORDINATOR_ID,
    coordinator_kind: 'compatibility',
    value: {
      report_kind: 'trusted.compatibility_readiness_report',
      mode: contextMode,
      ready,
      core_registry_available: coreRegistryAvailable,
      definition_lookup_available: definitionLookupAvailable,
      read_adaptation_available: readAdaptationAvailable,
      write_preparation_available: writePreparationAvailable,
      same_version_path_available: sameVersionPathAvailable,
      missing_path_reported: missingPathReported,
      checked_packet_type_count: checkedPacketTypeCount,
      blocking_issue_count: issues.filter((issue) => issue.severity === 'error').length,
      warning_count: issues.filter((issue) => issue.severity === 'warning').length,
    },
    issues,
    trace,
    status: ready ? 'ok' : toTrustedCompatibilityStatus(issues, strictness),
    mode: contextMode,
  });
}
