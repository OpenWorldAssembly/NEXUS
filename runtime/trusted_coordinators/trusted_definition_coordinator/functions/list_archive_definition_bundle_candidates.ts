/**
 * File: list_archive_definition_bundle_candidates.ts
 * Description: Loads pinned or trusted stored Definition Bundle.packet_set candidates through Trusted Archive reads.
 */

import { getDefinedPacketTypeDefinition } from '@core/packets/packet-definition-manifest.ts';
import { createPacketRef } from '@core/packets/builders.ts';
import { BundleBodySchema } from '@core/packets/definitions/bundle.ts';
import {
  DefinitionBodySchema,
  type DefinitionBody,
} from '@core/packets/definitions/definition.ts';
import type {
  PacketDefinitionPartDescriptor,
  PacketDefinitionPartSubtype,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  parsePacketEnvelope,
  type PacketEnvelope,
  type PacketRef,
  type PacketRevisionRef,
} from '@core/schema/packet-schema';
import { SEEDED_DEFINITION_PROFILE_ID } from '@core/packets/packet-definition-seeds.ts';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { definitionTrace, trustTierForMode } from '../trusted_definition_internal.ts';
import type {
  ResolveTrustedDefinitionContextFromArchiveInput,
  TrustedDefinitionCandidate,
  TrustedDefinitionRuntimePreference,
  TrustedDefinitionSource,
  TrustedDefinitionSourceKind,
  TrustedDefinitionTrustMode,
} from '../trusted_definition_types.ts';

const STORED_PROFILE_TRUST_MODES = new Set<TrustedDefinitionTrustMode>([
  'pin',
  'prefer',
  'allow',
  'compatibility_only',
  'quarantine',
]);

const TRUST_MODE_SELECTION_WEIGHT: Record<TrustedDefinitionTrustMode, number> = {
  pin: 5,
  prefer: 4,
  allow: 3,
  compatibility_only: 2,
  quarantine: 1,
  ignore: 0,
};

function shouldReplaceSourcePreference(input: {
  current: TrustedDefinitionRuntimePreference;
  next: TrustedDefinitionRuntimePreference;
}): boolean {
  const currentWeight = TRUST_MODE_SELECTION_WEIGHT[input.current.trust_mode];
  const nextWeight = TRUST_MODE_SELECTION_WEIGHT[input.next.trust_mode];

  if (nextWeight !== currentWeight) {
    return nextWeight > currentWeight;
  }

  return input.next.priority > input.current.priority;
}

function shouldIncludePacketType(input: {
  packetType: string;
  packetTypeFilters?: readonly string[];
}): boolean {
  return !input.packetTypeFilters || input.packetTypeFilters.length === 0 || input.packetTypeFilters.includes(input.packetType);
}

function sourceKindForPreference(preference: TrustedDefinitionRuntimePreference): TrustedDefinitionSourceKind {
  if (preference.trust_mode === 'pin') {
    return 'pinned_bundle';
  }

  if (preference.trust_mode === 'allow' || preference.trust_mode === 'compatibility_only') {
    return 'local_packet_archive';
  }

  return 'imported_bundle';
}

function sourcePriorityForPreference(preference: TrustedDefinitionRuntimePreference): number {
  switch (preference.trust_mode) {
    case 'pin':
      return 560;
    case 'prefer':
      return 540;
    case 'allow':
      return 360;
    case 'compatibility_only':
      return 240;
    case 'quarantine':
      return 50;
    case 'ignore':
      return -1000;
  }
}

function packetIdForRef(ref: PacketRef | null | undefined): string | null {
  return ref?.packet_id ?? null;
}

function revisionIdForRef(ref: PacketRevisionRef | null | undefined): string | null {
  return ref?.revision_id ?? null;
}

function toPacketEnvelope(value: unknown): PacketEnvelope | null {
  try {
    return parsePacketEnvelope(value);
  } catch {
    return null;
  }
}

function referencesForStoredDefinitionBody(body: DefinitionBody): string[] {
  switch (body.subtype) {
    case 'packet_definition':
      return [
        ...body.required_parts.map((part) => part.part_id),
        ...body.optional_parts.map((part) => part.part_id),
      ];
    case 'packet_schema':
      return [body.schema_key, ...body.supported_subtypes];
    case 'packet_action_registry':
      return [...body.action_ids];
    case 'packet_builder_descriptor':
      return [...body.builder_ids];
    case 'packet_planner_descriptor':
      return [...body.planner_ids];
    case 'packet_projection_descriptor':
      return [...body.projection_keys];
    case 'packet_compatibility':
      return [...body.adapter_ids];
    case 'defaults_definition':
      return Object.keys(body.default_values);
    case 'dependencies_definition':
      return [
        ...body.required_refs.map((ref) => ref.packet_id),
        ...body.optional_refs.map((ref) => ref.packet_id),
        ...body.required_relation_subtypes,
        ...body.required_packet_types,
        ...body.required_definition_parts,
        ...body.required_runtime_capabilities,
      ];
  }
}

function toStoredDefinitionPartDescriptor(input: {
  partId: string;
  body: DefinitionBody;
}): PacketDefinitionPartDescriptor {
  const { partId, body } = input;

  return {
    part_id: partId,
    part_subtype: body.subtype as PacketDefinitionPartSubtype,
    defines_packet_type: body.defines_packet_type,
    defines_packet_subtype: body.defines_packet_subtype,
    schema_version: body.definition_version,
    availability: 'canonical',
    required: true,
    references: referencesForStoredDefinitionBody(body),
    covers_subtypes:
      body.subtype === 'packet_schema' ? [...body.supported_subtypes] : undefined,
    applies_to:
      body.subtype === 'defaults_definition' || body.subtype === 'dependencies_definition'
        ? body.applies_to
        : undefined,
    default_values:
      body.subtype === 'defaults_definition' ? body.default_values : undefined,
    default_merge_strategy:
      body.subtype === 'defaults_definition'
        ? body.default_merge_strategy
        : undefined,
    notes: body.summary,
  };
}

function sourceForPreference(input: {
  preference: TrustedDefinitionRuntimePreference;
  sourceId: string;
}): TrustedDefinitionSource {
  const { preference, sourceId } = input;

  return {
    source_id: sourceId,
    source_kind: sourceKindForPreference(preference),
    trust_tier: trustTierForMode(preference.trust_mode),
    priority: sourcePriorityForPreference(preference),
    verified: false,
    notes:
      preference.notes ??
      'Stored Definition Bundle.packet_set source selected by node/runtime definition profile preference.',
  };
}

function candidateIdForStoredDefinition(input: {
  sourceId: string;
  packetId: string;
  revisionId: string | null;
  packetType: string;
  partSubtype: string;
}): string {
  return [
    input.packetType,
    input.partSubtype,
    input.packetId,
    input.revisionId ?? 'preferred',
    input.sourceId,
    'stored_bundle',
  ].join('.');
}

function collectPreferredProfileSources(input: {
  preferences?: readonly TrustedDefinitionRuntimePreference[];
}): { sourceId: string; preference: TrustedDefinitionRuntimePreference }[] {
  const bySourceId = new Map<string, TrustedDefinitionRuntimePreference>();

  for (const preference of input.preferences ?? []) {
    if (!preference.source_id || preference.source_id === SEEDED_DEFINITION_PROFILE_ID) {
      continue;
    }

    if (!STORED_PROFILE_TRUST_MODES.has(preference.trust_mode)) {
      continue;
    }

    const current = bySourceId.get(preference.source_id);
    if (!current || shouldReplaceSourcePreference({ current, next: preference })) {
      bySourceId.set(preference.source_id, preference);
    }
  }

  return [...bySourceId.entries()].map(([sourceId, preference]) => ({ sourceId, preference }));
}

export async function listArchiveDefinitionBundleCandidates(
  input: ResolveTrustedDefinitionContextFromArchiveInput & {
    preferences?: readonly TrustedDefinitionRuntimePreference[];
  } = {}
): Promise<{
  candidates: TrustedDefinitionCandidate[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const trace: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const candidates: TrustedDefinitionCandidate[] = [];
  const sources = collectPreferredProfileSources({ preferences: input.preferences });
  const packetTypeFilters = input.packet_type_filters ? [...input.packet_type_filters] : [];

  if (sources.length === 0) {
    trace.push(
      definitionTrace({
        step_id: 'definition.candidates.archive_bundle.skipped',
        status: 'ok',
        notes:
          'No pinned or trusted stored definition profile refs were supplied, so archive-backed Definition candidates were not loaded.',
      })
    );

    return { candidates, issues, trace };
  }

  for (const source of sources) {
    const bundleRead = await trustedArchiveCoordinator.readPacket({
      packet_store: input.packet_store,
      database_path: input.database_path,
      packet_ref: createPacketRef(source.sourceId),
      revision_ref: null,
      mode: 'adapted',
      context_mode: input.context_mode,
    });

    issues.push(...bundleRead.issues);
    trace.push(...bundleRead.trace);

    const bundlePacket = toPacketEnvelope(bundleRead.value?.packet ?? null);
    if (!bundlePacket) {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'stored_definition_bundle_not_found',
          path: source.sourceId,
          message:
            'Trusted Definition could not read a pinned/trusted stored definition profile Bundle through Trusted Archive; the source was ignored and bootstrap fallback remains available.',
        })
      );
      continue;
    }

    if (bundlePacket.header.type !== 'Bundle') {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'stored_definition_profile_not_bundle',
          path: source.sourceId,
          message:
            'A pinned/trusted definition profile ref resolved to a non-Bundle packet and was ignored.',
        })
      );
      continue;
    }

    const parsedBundle = BundleBodySchema.safeParse(bundlePacket.body);
    if (!parsedBundle.success || parsedBundle.data.subtype !== 'packet_set') {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'stored_definition_bundle_kernel_validation_failed',
          path: source.sourceId,
          message:
            'A pinned/trusted definition profile Bundle failed Bundle.packet_set kernel validation and was ignored.',
        })
      );
      continue;
    }

    if (parsedBundle.data.status !== 'active') {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'stored_definition_bundle_inactive',
          path: source.sourceId,
          message:
            'A pinned/trusted definition profile Bundle is not active and was ignored.',
        })
      );
      continue;
    }

    const sourceDescriptor = sourceForPreference({
      preference: source.preference,
      sourceId: source.sourceId,
    });
    let loadedFromBundle = 0;

    for (const item of parsedBundle.data.items) {
      if (item.packet_type !== 'Definition' || !item.packet_ref) {
        continue;
      }

      const definitionRead = await trustedArchiveCoordinator.readPacket({
        packet_store: input.packet_store,
        database_path: input.database_path,
        packet_ref: item.packet_ref,
        revision_ref: item.revision_ref ?? null,
        mode: 'adapted',
        context_mode: input.context_mode,
      });

      issues.push(...definitionRead.issues);
      trace.push(...definitionRead.trace);

      const definitionPacket = toPacketEnvelope(definitionRead.value?.packet ?? null);
      const definitionPacketId = packetIdForRef(item.packet_ref) ?? 'unknown-definition-packet';
      const definitionRevisionId = revisionIdForRef(item.revision_ref);

      if (!definitionPacket) {
        issues.push(
          trustedIssue({
            severity: item.required ? 'warning' : 'info',
            code: 'stored_definition_part_missing',
            path: `${source.sourceId}:${definitionPacketId}`,
            message:
              'A stored definition profile Bundle referenced a Definition packet that Trusted Archive could not read; that Definition part was ignored.',
          })
        );
        continue;
      }

      if (definitionPacket.header.type !== 'Definition') {
        issues.push(
          trustedIssue({
            severity: 'warning',
            code: 'stored_definition_part_not_definition_packet',
            path: `${source.sourceId}:${definitionPacketId}`,
            message:
              'A stored definition profile Bundle item resolved to a non-Definition packet and was ignored.',
          })
        );
        continue;
      }

      const parsedDefinition = DefinitionBodySchema.safeParse(definitionPacket.body);
      if (!parsedDefinition.success || parsedDefinition.data.status !== 'active') {
        issues.push(
          trustedIssue({
            severity: 'warning',
            code: 'stored_definition_part_kernel_validation_failed',
            path: `${source.sourceId}:${definitionPacketId}`,
            message:
              'A stored Definition packet failed Definition kernel validation or was not active and was ignored.',
          })
        );
        continue;
      }

      const body = parsedDefinition.data;
      if (!shouldIncludePacketType({ packetType: body.defines_packet_type, packetTypeFilters })) {
        continue;
      }

      const bootstrapDefinition = getDefinedPacketTypeDefinition(body.defines_packet_type);
      if (!bootstrapDefinition) {
        issues.push(
          trustedIssue({
            severity: 'warning',
            code: 'stored_definition_part_without_bootstrap_snapshot',
            path: `${source.sourceId}:${definitionPacketId}`,
            message: `${definitionPacketId} defines ${body.defines_packet_type}, but no compiled bootstrap snapshot is available yet; the part was ignored for runtime candidate selection.`,
          })
        );
        continue;
      }

      const isCompatibility = body.subtype === 'packet_compatibility';
      candidates.push({
        candidate_id: candidateIdForStoredDefinition({
          sourceId: source.sourceId,
          packetId: definitionPacketId,
          revisionId: definitionRevisionId,
          packetType: body.defines_packet_type,
          partSubtype: body.subtype === 'packet_definition' ? 'packet_type_definition' : body.subtype,
        }),
        source: sourceDescriptor,
        defines_packet_type: body.defines_packet_type,
        defines_packet_subtype: body.defines_packet_subtype,
        part_subtype:
          body.subtype === 'packet_definition'
            ? 'packet_type_definition'
            : body.subtype,
        definition_version: body.definition_version,
        schema_version: body.definition_version,
        status: isCompatibility ? 'compatibility_candidate' : 'active_candidate',
        verification_status: 'verified',
        trust_status: isCompatibility ? 'compatibility_only' : sourceDescriptor.trust_tier,
        priority: isCompatibility ? 240 : sourceDescriptor.priority,
        compatibility_posture: isCompatibility ? 'compatibility_reader' : 'current_semantics',
        payload: {
          definition: body.subtype === 'packet_definition' ? bootstrapDefinition : undefined,
          part:
            body.subtype === 'packet_definition'
              ? undefined
              : toStoredDefinitionPartDescriptor({
                  partId: item.notes ?? definitionPacketId,
                  body,
                }),
          descriptor: {
            source: 'stored_definition_bundle',
            bundle_packet_ref: { packet_id: bundlePacket.header.packet_id },
            bundle_revision_ref: bundleRead.value?.revision_ref ?? null,
            definition_packet_ref: item.packet_ref,
            definition_revision_ref: item.revision_ref ?? null,
            stored_definition_body: body,
            compiled_snapshot_note:
              'Runtime payload still uses the compiled bootstrap PacketTypeDefinition snapshot while stored Definition parts mature into the complete active profile compiler.',
          },
        },
        issues: [],
      });
      loadedFromBundle += 1;
    }

    if (loadedFromBundle === 0) {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'stored_definition_bundle_empty_or_filtered',
          path: source.sourceId,
          message:
            'A pinned/trusted definition profile Bundle was valid, but no usable Definition candidates were loaded from it.',
        })
      );
    }
  }

  trace.push(
    definitionTrace({
      step_id: 'definition.candidates.archive_bundle.loaded',
      status: issues.some((issue) => issue.severity === 'error')
        ? 'error'
        : issues.some((issue) => issue.severity === 'warning')
          ? 'partial'
          : 'ok',
      notes: `Loaded ${candidates.length} archive-backed Definition candidate(s) from ${sources.length} pinned/trusted stored profile ref(s).`,
    })
  );

  return { candidates, issues, trace };
}
