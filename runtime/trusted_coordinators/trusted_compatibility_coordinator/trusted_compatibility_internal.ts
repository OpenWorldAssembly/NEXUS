/**
 * File: trusted_compatibility_internal.ts
 * Description: Internal helpers for Trusted Compatibility Coordinator traces, issues, and core-result shaping.
 */

import {
  describePacketCompatibility,
  inspectPacketEnvelopeForTarget,
  listPacketCompatibilityAuditSummaries,
  PacketCompatibilityError,
  PacketTypeSchema,
  preparePacketEnvelopeForVersionedWrite,
  resolvePacketAdaptationPath,
  type PacketCompatibilityAuditSummary,
  type PacketCompatibilityReadResult,
  type PacketEnvelope,
  type PacketType,
  type PacketVersionedWritePreparation,
} from '@core/schema/packet-schema';
import type {
  PacketCompatibilityAdapterDescriptor,
  PacketCompatibilityPosture,
  PacketDefinitionPartDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import { trustedDefinitionCoordinator } from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import {
  createTrustedTraceEntry,
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorStatus,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  TRUSTED_COMPATIBILITY_COORDINATOR_ID,
  type BaseTrustedCompatibilityInput,
  type ResolveTrustedAdapterPathInput,
  type ResolveTrustedCompatibilityProfileInput,
  type TrustedAdapterPathResolution,
  type TrustedAdapterPathStep,
  type TrustedCompatibilityProfile,
  type TrustedCompatibilityStrictness,
  type TrustedPacketCompatibilityResolution,
} from './trusted_compatibility_types.ts';

export function compatibilityTrace(input: {
  step_id: string;
  status?: TrustedRuntimeCoordinatorStatus;
  preset_ids?: readonly string[];
  notes: string;
}): TrustedRuntimeCoordinatorTraceEntry {
  return createTrustedTraceEntry({
    coordinator_id: TRUSTED_COMPATIBILITY_COORDINATOR_ID,
    step_id: input.step_id,
    status: input.status ?? 'ok',
    preset_ids: input.preset_ids ?? ['trusted.compatibility.v0'],
    notes: input.notes,
  });
}

export function compatibilityIssue(input: TrustedRuntimeCoordinatorIssue): TrustedRuntimeCoordinatorIssue {
  return trustedIssue(input);
}

export function toTrustedCompatibilityStatus(
  issues: readonly TrustedRuntimeCoordinatorIssue[],
  strictness: TrustedCompatibilityStrictness = 'advisory'
): TrustedRuntimeCoordinatorStatus {
  if (issues.some((issue) => issue.severity === 'error')) {
    return strictness === 'strict' ? 'blocked' : 'error';
  }

  if (issues.some((issue) => issue.severity === 'warning')) {
    return 'partial';
  }

  return 'ok';
}

export function trustedCompatibilityExceptionIssue(input: {
  error: unknown;
  path: string;
  defaultCode: string;
  defaultMessage: string;
}): TrustedRuntimeCoordinatorIssue {
  if (input.error instanceof PacketCompatibilityError) {
    return compatibilityIssue({
      severity: 'warning',
      code: `trusted_compatibility_${input.error.code}`,
      path: input.path,
      message: input.error.message,
    });
  }

  return compatibilityIssue({
    severity: 'error',
    code: input.defaultCode,
    path: input.path,
    message: input.error instanceof Error ? input.error.message : input.defaultMessage,
  });
}

export function parseTrustedPacketType(input: PacketType | string): {
  packetType: PacketType | null;
  issues: TrustedRuntimeCoordinatorIssue[];
} {
  const parsed = PacketTypeSchema.safeParse(input);

  if (parsed.success) {
    return { packetType: parsed.data, issues: [] };
  }

  return {
    packetType: null,
    issues: [
      compatibilityIssue({
        severity: 'error',
        code: 'trusted_compatibility_unknown_packet_type',
        path: 'packet_type',
        message: `Unknown packet type ${String(input)}.`,
      }),
    ],
  };
}

function packetRefFromEnvelope(packet: PacketEnvelope): { packet_id: string } {
  return { packet_id: packet.header.packet_id };
}

function revisionRefFromEnvelope(packet: PacketEnvelope): { packet_id: string; revision_id: string } {
  return {
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  };
}

export function createCompatibilityResolutionFromRead(input: {
  inspected: PacketCompatibilityReadResult;
  issues: readonly TrustedRuntimeCoordinatorIssue[];
}): TrustedPacketCompatibilityResolution {
  const packet = input.inspected.adapted_packet;
  const issueCount = input.issues.length;
  const blockerCount = input.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = input.issues.filter((issue) => issue.severity === 'warning').length;

  return {
    result_kind: 'trusted.packet_compatibility_resolution',
    packet_ref: packetRefFromEnvelope(packet),
    revision_ref: revisionRefFromEnvelope(packet),
    packet_type: input.inspected.status.type,
    declared_schema_version: input.inspected.status.declared_schema_version,
    effective_source_schema_version: input.inspected.status.effective_source_schema_version,
    interpreted_as_legacy_profile: input.inspected.status.interpreted_as_legacy_profile,
    source_schema_version: input.inspected.status.source_schema_version,
    target_schema_version: input.inspected.status.target_schema_version,
    direction: input.inspected.status.direction,
    is_supported: true,
    is_current:
      input.inspected.status.source_schema_version === input.inspected.status.target_schema_version,
    is_exact: input.inspected.status.is_exact,
    is_lossy: input.inspected.status.is_lossy,
    writable_as_is: input.inspected.status.writable_as_is,
    requires_guarded_upgrade: input.inspected.status.requires_guarded_upgrade,
    requires_loss_acknowledgement: input.inspected.status.requires_loss_acknowledgement,
    supported_write_target: input.inspected.status.supported_write_target,
    changes: [...input.inspected.status.changes],
    losses: [...input.inspected.status.losses],
    issue_count: issueCount,
    blocker_count: blockerCount,
    warning_count: warningCount,
  };
}

export function createBlockedCompatibilityResolution(input: {
  issues: readonly TrustedRuntimeCoordinatorIssue[];
  packetType?: PacketType | string | null;
  declaredSchemaVersion?: string | null;
  targetSchemaVersion?: string | null;
}): TrustedPacketCompatibilityResolution {
  const issueCount = input.issues.length;
  const blockerCount = input.issues.filter((issue) => issue.severity === 'error').length;
  const warningCount = input.issues.filter((issue) => issue.severity === 'warning').length;

  return {
    result_kind: 'trusted.packet_compatibility_resolution',
    packet_ref: null,
    revision_ref: null,
    packet_type: input.packetType ?? null,
    declared_schema_version: input.declaredSchemaVersion ?? null,
    effective_source_schema_version: null,
    interpreted_as_legacy_profile: false,
    source_schema_version: null,
    target_schema_version: input.targetSchemaVersion ?? null,
    direction: 'unknown',
    is_supported: false,
    is_current: false,
    is_exact: false,
    is_lossy: false,
    writable_as_is: false,
    requires_guarded_upgrade: false,
    requires_loss_acknowledgement: false,
    supported_write_target: 'unknown',
    changes: [],
    losses: [],
    issue_count: issueCount,
    blocker_count: blockerCount,
    warning_count: warningCount,
  };
}

export function inspectPacketForTrustedCompatibility(input: {
  packet: unknown;
  target_schema_version?: string;
}): {
  inspected: PacketCompatibilityReadResult | null;
  issues: TrustedRuntimeCoordinatorIssue[];
} {
  try {
    return {
      inspected: inspectPacketEnvelopeForTarget(input.packet, {
        target_schema_version: input.target_schema_version,
      }),
      issues: [],
    };
  } catch (error) {
    return {
      inspected: null,
      issues: [
        trustedCompatibilityExceptionIssue({
          error,
          path: 'packet',
          defaultCode: 'trusted_compatibility_packet_inspection_failed',
          defaultMessage: 'Trusted Compatibility could not inspect the packet envelope.',
        }),
      ],
    };
  }
}

export function preparePacketForTrustedWrite(input: {
  packet: unknown;
  target_schema_version?: string;
}): {
  prepared: PacketVersionedWritePreparation | null;
  issues: TrustedRuntimeCoordinatorIssue[];
} {
  try {
    return {
      prepared: preparePacketEnvelopeForVersionedWrite(input.packet, {
        target_schema_version: input.target_schema_version,
      }),
      issues: [],
    };
  } catch (error) {
    return {
      prepared: null,
      issues: [
        trustedCompatibilityExceptionIssue({
          error,
          path: 'packet',
          defaultCode: 'trusted_compatibility_write_preparation_failed',
          defaultMessage: 'Trusted Compatibility could not prepare the packet for write.',
        }),
      ],
    };
  }
}

export function resolveTrustedAdapterPathMetadata(
  input: ResolveTrustedAdapterPathInput
): {
  value: TrustedAdapterPathResolution;
  issues: TrustedRuntimeCoordinatorIssue[];
} {
  const parsed = parseTrustedPacketType(input.packet_type);

  if (!parsed.packetType) {
    return {
      value: {
        result_kind: 'trusted.adapter_path_resolution',
        packet_type: input.packet_type,
        source_schema_version: input.source_schema_version,
        target_schema_version: input.target_schema_version,
        path_found: false,
        same_version: false,
        step_count: 0,
        steps: [],
      },
      issues: parsed.issues,
    };
  }

  if (input.source_schema_version === input.target_schema_version) {
    return {
      value: {
        result_kind: 'trusted.adapter_path_resolution',
        packet_type: parsed.packetType,
        source_schema_version: input.source_schema_version,
        target_schema_version: input.target_schema_version,
        path_found: true,
        same_version: true,
        step_count: 0,
        steps: [],
      },
      issues: [],
    };
  }

  try {
    const path = resolvePacketAdaptationPath({
      type: parsed.packetType,
      sourceSchemaVersion: input.source_schema_version,
      targetSchemaVersion: input.target_schema_version,
    });
    const steps: TrustedAdapterPathStep[] = path.map((step) => ({
      from_schema_version: step.from_schema_version,
      to_schema_version: step.to_schema_version,
      direction: step.direction,
    }));

    return {
      value: {
        result_kind: 'trusted.adapter_path_resolution',
        packet_type: parsed.packetType,
        source_schema_version: input.source_schema_version,
        target_schema_version: input.target_schema_version,
        path_found: true,
        same_version: false,
        step_count: steps.length,
        steps,
      },
      issues: [],
    };
  } catch (error) {
    return {
      value: {
        result_kind: 'trusted.adapter_path_resolution',
        packet_type: parsed.packetType,
        source_schema_version: input.source_schema_version,
        target_schema_version: input.target_schema_version,
        path_found: false,
        same_version: false,
        step_count: 0,
        steps: [],
      },
      issues: [
        trustedCompatibilityExceptionIssue({
          error,
          path: 'adapter_path',
          defaultCode: 'trusted_compatibility_adapter_path_failed',
          defaultMessage: 'Trusted Compatibility could not resolve the adapter path.',
        }),
      ],
    };
  }
}

function describeDefinitionCompatibility(input: {
  packetType: PacketType;
  context?: BaseTrustedCompatibilityInput;
}): {
  part: PacketDefinitionPartDescriptor | null;
  definitionCompatibility: PacketCompatibilityPosture | null;
  adapterDescriptors: PacketCompatibilityAdapterDescriptor[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
} {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  let part: PacketDefinitionPartDescriptor | null = null;
  let definitionCompatibility: PacketCompatibilityPosture | null = null;
  let adapterDescriptors: PacketCompatibilityAdapterDescriptor[] = [];

  const partResult = trustedDefinitionCoordinator.resolveCompatibilityDefinition({
    packet_type: input.packetType,
    context_mode: input.context?.context_mode ?? 'compatibility_read',
    node_element_id: input.context?.node_element_id,
    preferences: input.context?.preferences,
    include_quarantined: input.context?.include_quarantined,
  });
  issues.push(...partResult.issues);
  trace.push(...partResult.trace);
  part = partResult.value ?? null;

  const definitionResult = trustedDefinitionCoordinator.resolvePacketDefinition({
    packet_type: input.packetType,
    context_mode: input.context?.context_mode ?? 'compatibility_read',
    node_element_id: input.context?.node_element_id,
    preferences: input.context?.preferences,
    include_quarantined: input.context?.include_quarantined,
  });
  issues.push(...definitionResult.issues);
  trace.push(...definitionResult.trace);

  const definition = definitionResult.value as PacketTypeDefinition | null;
  definitionCompatibility = definition?.compatibility ?? null;
  adapterDescriptors = [...(definition?.compatibility_adapters ?? [])];

  return {
    part,
    definitionCompatibility,
    adapterDescriptors,
    issues,
    trace,
  };
}

export function resolveTrustedCompatibilityProfileValue(
  input: ResolveTrustedCompatibilityProfileInput
): {
  value: TrustedCompatibilityProfile;
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
} {
  const parsed = parseTrustedPacketType(input.packet_type);
  const issues = [...parsed.issues];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];

  if (!parsed.packetType) {
    return {
      value: {
        result_kind: 'trusted.compatibility_profile',
        packet_type: input.packet_type,
        current_schema_version: null,
        revision_mode: null,
        support_level: null,
        write_target_policy: null,
        supported_schema_versions: [],
        has_legacy_versions: false,
        has_write_preparation: false,
        definition_part: null,
        definition_part_present: false,
        definition_current_schema_version: null,
        definition_compatibility: null,
        adapter_ids: [],
        adapter_descriptors: [],
        supports_upcast: false,
        supports_downcast: false,
        loss_awareness: 'unknown',
        registry_definition_mismatches: [],
      },
      issues,
      trace,
    };
  }

  const registrySummary = getCompatibilityAuditSummary(parsed.packetType);
  const definition = describeDefinitionCompatibility({
    packetType: parsed.packetType,
    context: input,
  });
  issues.push(...definition.issues);
  trace.push(...definition.trace);

  const schemaVersion = input.schema_version ?? registrySummary.current_schema_version;
  const registryDescription = describePacketCompatibility(parsed.packetType, schemaVersion);
  const registryDefinitionMismatches: string[] = [];
  const definitionCurrentSchemaVersion = definition.definitionCompatibility?.current_schema_version ?? null;

  if (
    definitionCurrentSchemaVersion &&
    registrySummary.current_schema_version !== definitionCurrentSchemaVersion
  ) {
    registryDefinitionMismatches.push(
      `Registry current schema ${registrySummary.current_schema_version} does not match Definition current schema ${definitionCurrentSchemaVersion}.`
    );
    issues.push(compatibilityIssue({
      severity: 'warning',
      code: 'trusted_compatibility_definition_schema_mismatch',
      path: `${parsed.packetType}.current_schema_version`,
      message: registryDefinitionMismatches.at(-1) ?? 'Registry/Definition compatibility schema mismatch.',
    }));
  }

  if (!definition.part) {
    registryDefinitionMismatches.push('Definition packet_compatibility part is missing.');
  }

  return {
    value: {
      result_kind: 'trusted.compatibility_profile',
      packet_type: parsed.packetType,
      current_schema_version: registryDescription.current_schema_version,
      revision_mode: registryDescription.revision_mode,
      support_level: registrySummary.support_level,
      write_target_policy: registryDescription.write_target_policy,
      supported_schema_versions: [...registrySummary.supported_schema_versions],
      has_legacy_versions: registrySummary.has_legacy_versions,
      has_write_preparation: registrySummary.has_write_preparation,
      definition_part: definition.part,
      definition_part_present: Boolean(definition.part),
      definition_current_schema_version: definitionCurrentSchemaVersion,
      definition_compatibility: definition.definitionCompatibility,
      adapter_ids: definition.adapterDescriptors.map((adapter) => adapter.adapter_id),
      adapter_descriptors: definition.adapterDescriptors,
      supports_upcast: definition.definitionCompatibility?.supports_upcast ?? false,
      supports_downcast: definition.definitionCompatibility?.supports_downcast ?? false,
      loss_awareness: definition.definitionCompatibility?.loss_awareness ?? 'unknown',
      registry_definition_mismatches: registryDefinitionMismatches,
    },
    issues,
    trace,
  };
}

export function listCompatibilityAuditSummaries(): PacketCompatibilityAuditSummary[] {
  return listPacketCompatibilityAuditSummaries();
}

export function getCompatibilityAuditSummary(type: PacketType): PacketCompatibilityAuditSummary {
  return listPacketCompatibilityAuditSummaries().find((summary) => summary.type === type) ?? (() => {
    throw new PacketCompatibilityError({
      code: 'unsupported_schema_version',
      type,
      sourceSchemaVersion: 'unknown',
      targetSchemaVersion: 'unknown',
      message: `No compatibility audit summary was found for packet type ${type}.`,
    });
  })();
}
