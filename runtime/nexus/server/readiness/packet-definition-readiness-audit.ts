/**
 * File: packet-definition-readiness-audit.ts
 * Description: Static readiness ledger for packet definition coverage before reseed work.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  buildDefinitionPacketSeedCandidates,
} from '@core/packets/packet-definition-seeds.ts';
import {
  listPacketDefinitionParts,
  listDefinedPacketTypeDefinitions,
} from '@core/packets/packet-definition-manifest.ts';
import type {
  PacketDefinitionPartDescriptor,
  PacketDefinitionPartSubtype,
  PacketProjectionDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';

export type PacketDefinitionReadinessLayer =
  | 'nexus_core'
  | 'owa_domain'
  | 'carrier';

export type PacketDefinitionReadinessBucket =
  | 'runtime_ready'
  | 'definition_partial'
  | 'projection_incomplete'
  | 'write_incomplete'
  | 'compatibility_missing'
  | 'seed_ready'
  | 'legacy_candidate'
  | 'needs_decision';

export type PacketDefinitionReadinessFindingSeverity = 'error' | 'warning' | 'info';

export type PacketDefinitionReadinessFinding = {
  severity: PacketDefinitionReadinessFindingSeverity;
  packet_type: string;
  code: string;
  message: string;
};

export type PacketDefinitionReadinessEntry = {
  packet_type: string;
  layer: PacketDefinitionReadinessLayer;
  source_file: string;
  source_style: 'generic_factory' | 'native_definition';
  definition_status: 'canonical' | 'active' | 'deprecated' | 'legacy_bridge' | 'unknown';
  schema_version: string | null;
  buckets: PacketDefinitionReadinessBucket[];
  descriptor_counts: {
    actions: number;
    builders: number;
    planners: number;
    mutations: number;
    workflow_plans: number;
    compatibility_adapters: number;
    projections: number;
    indexes: number;
    definition_parts: number;
  };
  coverage: {
    schema: boolean;
    defaults: boolean;
    storage: boolean;
    revision: boolean;
    actions: boolean;
    builders: boolean;
    planners: boolean;
    policy: boolean;
    projection: boolean;
    rich_projection_metadata: boolean;
    indexing: boolean;
    compatibility: boolean;
    bundling: boolean;
    fixtures: boolean;
    definition_parts: boolean;
    dependencies: boolean;
    runtime_ready_write: boolean;
    seed_material: boolean;
  };
  notes: string[];
  next_step: string;
};

export type PacketDefinitionSubtypeCompletenessStatus =
  | 'ready'
  | 'acceptable_minimal'
  | 'blocked';

export type PacketDefinitionSubtypeCompletenessIssue = {
  code:
    | 'missing_required_part'
    | 'weak_defaults'
    | 'weak_projection'
    | 'seed_mismatch'
    | 'fallback_mismatch';
  severity: 'error' | 'warning' | 'info';
  message: string;
};

export type PacketDefinitionSubtypeCompletenessEntry = {
  packet_type: string;
  packet_subtype: string | null;
  status: PacketDefinitionSubtypeCompletenessStatus;
  required_part_ids: Partial<Record<PacketDefinitionPartSubtype, string[]>>;
  default_part_ids: string[];
  projection_part_ids: string[];
  projection_keys: string[];
  seed_part_ids: string[];
  issues: PacketDefinitionSubtypeCompletenessIssue[];
  notes: string[];
};

export type PacketDefinitionReadinessAuditReport = {
  report_kind: 'packet.definition_readiness_audit';
  status: 'pass' | 'warn' | 'fail';
  scanned_files: string[];
  checked_packet_types: string[];
  bucket_counts: Record<PacketDefinitionReadinessBucket, number>;
  layer_counts: Record<PacketDefinitionReadinessLayer, number>;
  entries: PacketDefinitionReadinessEntry[];
  subtype_entries: PacketDefinitionSubtypeCompletenessEntry[];
  findings: PacketDefinitionReadinessFinding[];
};

const MANIFEST_FILE = 'core/packets/packet-definition-manifest.ts';
const GENERIC_SOURCE_FILE = 'core/packets/definitions/generic-type.ts';

const NATIVE_SOURCE_FILES: Record<string, string> = {
  Bundle: 'core/packets/definitions/bundle.ts',
  Definition: 'core/packets/definitions/definition.ts',
  Preference: 'core/packets/definitions/preference.ts',
  Discussion: 'core/packets/definitions/discussion.ts',
};

const NEXUS_CORE_PACKET_TYPES = new Set([
  'Bundle',
  'Claim',
  'Definition',
  'Element',
  'Location',
  'Policy',
  'Preference',
  'Reaction',
  'Relation',
  'Report',
  'Role',
]);

const OWA_DOMAIN_PACKET_TYPES = new Set([
  'Action',
  'Decision',
  'Discussion',
  'Proposal',
]);

const REQUIRED_DEFINITION_PARTS = [
  'packet_definition',
  'packet_schema',
  'packet_action_registry',
  'packet_builder_descriptor',
  'packet_planner_descriptor',
  'packet_projection_descriptor',
  'packet_compatibility',
  'defaults_definition',
  'dependencies_definition',
] as const;

const ALL_BUCKETS: PacketDefinitionReadinessBucket[] = [
  'runtime_ready',
  'definition_partial',
  'projection_incomplete',
  'write_incomplete',
  'compatibility_missing',
  'seed_ready',
  'legacy_candidate',
  'needs_decision',
];

const ALL_LAYERS: PacketDefinitionReadinessLayer[] = [
  'nexus_core',
  'owa_domain',
  'carrier',
];

function repoPath(path: string): string {
  return join(process.cwd(), path);
}

function readRepoFile(path: string): string {
  const absolutePath = repoPath(path);

  if (!existsSync(absolutePath)) {
    return '';
  }

  return readFileSync(absolutePath, 'utf8');
}

function countMatches(source: string, pattern: RegExp): number {
  return Array.from(source.matchAll(pattern)).length;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function listManifestPacketTypes(manifestSource: string): string[] {
  const objectMatch = manifestSource.match(/export const PACKET_TYPE_DEFINITIONS = \{([\s\S]*?)\} as const/s);
  const source = objectMatch?.[1] ?? '';
  const packetTypes: string[] = [];

  for (const match of source.matchAll(/^\s{2}([A-Z][A-Za-z0-9]+):\s+[a-z][A-Za-z0-9]+PacketDefinition,/gm)) {
    packetTypes.push(match[1]);
  }

  return uniqueSorted(packetTypes);
}

function listGenericFactoryPacketTypes(genericSource: string): string[] {
  const configMatch = genericSource.match(/const GENERIC_TYPE_CONFIGS = \[([\s\S]*?)\] as const/s);
  const source = configMatch?.[1] ?? '';
  const packetTypes: string[] = [];

  for (const match of source.matchAll(/type:\s*'([A-Z][A-Za-z0-9]+)'/g)) {
    packetTypes.push(match[1]);
  }

  return uniqueSorted(packetTypes);
}

function resolveLayer(packetType: string): PacketDefinitionReadinessLayer {
  if (packetType === 'Bundle') {
    return 'carrier';
  }

  if (OWA_DOMAIN_PACKET_TYPES.has(packetType)) {
    return 'owa_domain';
  }

  if (NEXUS_CORE_PACKET_TYPES.has(packetType)) {
    return 'nexus_core';
  }

  return 'owa_domain';
}

function extractDefinitionStatus(source: string): PacketDefinitionReadinessEntry['definition_status'] {
  const match = source.match(/definition_status:\s*'([^']+)'/);
  const status = match?.[1] ?? 'unknown';

  if (
    status === 'canonical' ||
    status === 'active' ||
    status === 'deprecated' ||
    status === 'legacy_bridge'
  ) {
    return status;
  }

  return 'unknown';
}

function extractSchemaVersion(source: string): string | null {
  return (
    source.match(/current_schema_version:\s*'([^']+)'/)?.[1] ??
    source.match(/const schemaVersion = ([^;]+);/)?.[1]?.trim() ??
    null
  );
}

function includesAllRequiredDefinitionParts(source: string): boolean {
  return REQUIRED_DEFINITION_PARTS.every((partSubtype) =>
    source.includes(`part_subtype: '${partSubtype}'`) ||
    source.includes(`'${partSubtype}'`)
  );
}

function createGenericDescriptorCounts(): PacketDefinitionReadinessEntry['descriptor_counts'] {
  return {
    actions: 4,
    builders: 1,
    planners: 2,
    mutations: 1,
    workflow_plans: 0,
    compatibility_adapters: 1,
    projections: 2,
    indexes: 1,
    definition_parts: 9,
  };
}

function createNativeDescriptorCounts(input: {
  source: string;
  packetType: string;
}): PacketDefinitionReadinessEntry['descriptor_counts'] {
  const genericCounts = input.packetType === 'Discussion'
    ? createGenericDescriptorCounts()
    : null;

  return {
    actions: (genericCounts?.actions ?? 0) + countMatches(input.source, /action_id:\s*'/g),
    builders: (genericCounts?.builders ?? 0) + countMatches(input.source, /builder_id:\s*'/g),
    planners: (genericCounts?.planners ?? 0) + countMatches(input.source, /planner_id:\s*'/g),
    mutations: (genericCounts?.mutations ?? 0) + countMatches(input.source, /mutation_intent:\s*'/g),
    workflow_plans: (genericCounts?.workflow_plans ?? 0) + countMatches(input.source, /workflow_plan_id:\s*'/g),
    compatibility_adapters: (genericCounts?.compatibility_adapters ?? 0) + countMatches(input.source, /adapter_id:\s*'/g),
    projections: (genericCounts?.projections ?? 0) + countMatches(input.source, /projection_key:\s*'/g),
    indexes: (genericCounts?.indexes ?? 0) + countMatches(input.source, /index_key:\s*'/g),
    definition_parts: (genericCounts?.definition_parts ?? 0) + countMatches(input.source, /part_id:\s*'/g),
  };
}

function hasRuntimeReadyWriteCoverage(input: {
  source: string;
  sourceStyle: PacketDefinitionReadinessEntry['source_style'];
  packetType: string;
}): boolean {
  if (input.sourceStyle === 'generic_factory') {
    return true;
  }

  if (input.packetType === 'Preference') {
    return (
      input.source.includes("builder_id: 'preference.element.body.v0'") &&
      input.source.includes("planner_id: 'preference.element.latest_active_revision.v0'") &&
      input.source.includes("availability: 'runtime_ready'")
    );
  }

  if (input.packetType === 'Discussion') {
    return (
      input.source.includes('genericDiscussionPacketDefinition') &&
      input.source.includes("discussion.reply.create") &&
      input.source.includes("availability: 'runtime_ready'")
    );
  }

  return false;
}

function createCoverage(input: {
  packetType: string;
  source: string;
  sourceStyle: PacketDefinitionReadinessEntry['source_style'];
  counts: PacketDefinitionReadinessEntry['descriptor_counts'];
}): PacketDefinitionReadinessEntry['coverage'] {
  const isGeneric = input.sourceStyle === 'generic_factory';
  const inheritsGenericBase = isGeneric || input.packetType === 'Discussion';
  const hasRequiredParts = inheritsGenericBase || includesAllRequiredDefinitionParts(input.source);
  const richProjectionMetadata =
    inheritsGenericBase ||
    input.source.includes('field_descriptors') ||
    input.source.includes('layout: {');
  const runtimeReadyWrite = hasRuntimeReadyWriteCoverage(input);

  return {
    schema:
      inheritsGenericBase ||
      input.source.includes('body_schema:') ||
      input.source.includes('BodySchema'),
    defaults:
      hasRequiredParts && input.source.includes("defaults_definition"),
    storage:
      inheritsGenericBase || input.source.includes('storage_class:'),
    revision:
      inheritsGenericBase || input.source.includes('revision_behavior:'),
    actions: input.counts.actions > 0 || isGeneric,
    builders: input.counts.builders > 0 || isGeneric,
    planners: input.counts.planners > 0 || isGeneric,
    policy:
      isGeneric ||
      input.source.includes('policy_action_id') ||
      input.source.includes('policy_action_ids'),
    projection: input.counts.projections > 0 || isGeneric,
    rich_projection_metadata: richProjectionMetadata,
    indexing: input.counts.indexes > 0 || inheritsGenericBase,
    compatibility:
      input.counts.compatibility_adapters > 0 ||
      input.source.includes('compatibility:') ||
      inheritsGenericBase,
    bundling:
      input.packetType === 'Bundle' ||
      input.source.includes('bundle') ||
      input.source.includes('Bundle'),
    fixtures: input.source.includes('fixtures:'),
    definition_parts: hasRequiredParts,
    dependencies:
      hasRequiredParts && input.source.includes("dependencies_definition"),
    runtime_ready_write: runtimeReadyWrite,
    seed_material:
      hasRequiredParts &&
      input.source.includes("defaults_definition") &&
      input.source.includes("dependencies_definition"),
  };
}

function hasCoreDefinitionGaps(coverage: PacketDefinitionReadinessEntry['coverage']): boolean {
  return !(
    coverage.schema &&
    coverage.defaults &&
    coverage.storage &&
    coverage.revision &&
    coverage.actions &&
    coverage.builders &&
    coverage.planners &&
    coverage.policy &&
    coverage.projection &&
    coverage.indexing &&
    coverage.compatibility &&
    coverage.definition_parts &&
    coverage.dependencies
  );
}

function hasResolvedOwaDomainDefaults(input: {
  packetType: string;
  source: string;
}): boolean {
  if (input.packetType === 'Discussion') {
    return (
      input.source.includes('discussion.defaults_definition.element_surface_recipe.v0') &&
      input.source.includes('ELEMENT_DISCUSSION_DEFAULT_PROFILES')
    );
  }

  if (
    input.packetType === 'Action' ||
    input.packetType === 'Decision' ||
    input.packetType === 'Proposal'
  ) {
    return (
      input.source.includes('createOwaDomainDefaultValues') &&
      input.source.includes('@core/packets/defaults/owa-domain-defaults')
    );
  }

  return false;
}

function createBuckets(input: {
  packetType: string;
  layer: PacketDefinitionReadinessLayer;
  definitionStatus: PacketDefinitionReadinessEntry['definition_status'];
  sourceStyle: PacketDefinitionReadinessEntry['source_style'];
  coverage: PacketDefinitionReadinessEntry['coverage'];
  owaDomainDefaultsResolved: boolean;
}): PacketDefinitionReadinessBucket[] {
  const buckets = new Set<PacketDefinitionReadinessBucket>();

  if (!hasCoreDefinitionGaps(input.coverage)) {
    buckets.add('seed_ready');
  }

  if (
    input.coverage.runtime_ready_write &&
    input.coverage.projection &&
    input.coverage.rich_projection_metadata &&
    input.coverage.seed_material
  ) {
    buckets.add('runtime_ready');
  }

  if (hasCoreDefinitionGaps(input.coverage)) {
    buckets.add('definition_partial');
  }

  if (!input.coverage.projection || !input.coverage.rich_projection_metadata) {
    buckets.add('projection_incomplete');
  }

  if (!input.coverage.runtime_ready_write) {
    buckets.add('write_incomplete');
  }

  if (!input.coverage.compatibility) {
    buckets.add('compatibility_missing');
  }

  if (input.definitionStatus === 'deprecated' || input.definitionStatus === 'legacy_bridge') {
    buckets.add('legacy_candidate');
  }

  if (input.layer === 'owa_domain' && !input.owaDomainDefaultsResolved) {
    buckets.add('needs_decision');
  }

  return [...buckets].sort((left, right) => ALL_BUCKETS.indexOf(left) - ALL_BUCKETS.indexOf(right));
}

function createNotes(input: {
  packetType: string;
  layer: PacketDefinitionReadinessLayer;
  sourceStyle: PacketDefinitionReadinessEntry['source_style'];
  buckets: readonly PacketDefinitionReadinessBucket[];
  coverage: PacketDefinitionReadinessEntry['coverage'];
  owaDomainDefaultsResolved: boolean;
}): string[] {
  const notes: string[] = [];

  if (input.sourceStyle === 'generic_factory') {
    notes.push('Uses the generic factory-backed definition pattern with runtime-ready generic descriptors.');
  } else {
    notes.push('Uses a native hand-authored definition file.');
  }

  if (input.coverage.seed_material) {
    notes.push('Has packet_definition_parts with defaults and dependencies, so it can feed the Definition seed profile.');
  }

  if (input.buckets.includes('write_incomplete')) {
    notes.push('Write descriptors are canonical/static but not yet marked as runtime-ready generic execution.');
  }

  if (input.buckets.includes('projection_incomplete')) {
    notes.push('Projection exists only as minimal/bootstrap metadata or is missing rich field/layout hints.');
  }

  if (input.packetType === 'Discussion') {
    notes.push('Discussion has a native overlay for aggregate workspace/feed/thread/composer projection descriptors while preserving the generic base definition.');
  } else if (input.layer === 'owa_domain' && input.owaDomainDefaultsResolved) {
    notes.push('Generic packet-family definition is present and OWA-specific default/seed semantics are explicitly recorded for the reseed pass.');
  } else if (input.layer === 'owa_domain') {
    notes.push('Generic packet-family definition is present; OWA-specific defaults and seed semantics still need product/domain decisions.');
  }

  if (input.packetType === 'Preference') {
    notes.push('Preference.element is the current pilot for definition-backed runtime revision/projection behavior.');
  }

  return notes;
}

function createNextStep(input: {
  packetType: string;
  layer: PacketDefinitionReadinessLayer;
  buckets: readonly PacketDefinitionReadinessBucket[];
  owaDomainDefaultsResolved: boolean;
}): string {
  if (input.buckets.includes('definition_partial')) {
    return 'Fill missing manifest sections before treating this definition as reseed-ready.';
  }

  if (input.packetType === 'Preference') {
    return 'Use Preference.element as the pilot pattern when upgrading the next definition-backed runtime pathway.';
  }

  if (input.packetType === 'Discussion') {
    return input.owaDomainDefaultsResolved
      ? 'Use the packetized element discussion surface recipe when building the reseed packet set.'
      : 'Promote default discussion surface recipes into definition/reseed material before the big reseed.';
  }

  if (input.layer === 'owa_domain') {
    return input.owaDomainDefaultsResolved
      ? 'Use the recorded OWA default semantics when building reseed fixtures and default packet sets.'
      : 'Decide the OWA default packets/policies for this generic family before reseed.';
  }

  if (input.buckets.includes('projection_incomplete')) {
    return 'Add field/layout projection metadata only if this packet family needs packet-agnostic UI projection before reseed.';
  }

  if (input.buckets.includes('write_incomplete')) {
    return 'Keep as canonical seed/transport definition unless a live generic write path is actually needed.';
  }

  return 'No immediate structural action; keep this definition aligned while reseed sources are built.';
}

function createEntry(input: {
  packetType: string;
  genericPacketTypes: ReadonlySet<string>;
}): PacketDefinitionReadinessEntry {
  const sourceStyle: PacketDefinitionReadinessEntry['source_style'] =
    NATIVE_SOURCE_FILES[input.packetType] !== undefined
      ? 'native_definition'
      : input.genericPacketTypes.has(input.packetType)
        ? 'generic_factory'
        : 'native_definition';
  const sourceFile = sourceStyle === 'generic_factory'
    ? GENERIC_SOURCE_FILE
    : NATIVE_SOURCE_FILES[input.packetType] ?? GENERIC_SOURCE_FILE;
  const source = readRepoFile(sourceFile);
  const layer = resolveLayer(input.packetType);
  const definitionStatus = sourceStyle === 'generic_factory' || input.packetType === 'Discussion'
    ? 'canonical'
    : extractDefinitionStatus(source);
  const schemaVersion = sourceStyle === 'generic_factory' || input.packetType === 'Discussion'
    ? 'registry.current_schema_version'
    : extractSchemaVersion(source);
  const counts = sourceStyle === 'generic_factory'
    ? createGenericDescriptorCounts()
    : createNativeDescriptorCounts({ source, packetType: input.packetType });
  const coverage = createCoverage({
    packetType: input.packetType,
    source,
    sourceStyle,
    counts,
  });
  const owaDomainDefaultsResolved = hasResolvedOwaDomainDefaults({
    packetType: input.packetType,
    source,
  });
  const buckets = createBuckets({
    packetType: input.packetType,
    layer,
    definitionStatus,
    sourceStyle,
    coverage,
    owaDomainDefaultsResolved,
  });

  return {
    packet_type: input.packetType,
    layer,
    source_file: sourceFile,
    source_style: sourceStyle,
    definition_status: definitionStatus,
    schema_version: schemaVersion,
    buckets,
    descriptor_counts: counts,
    coverage,
    notes: createNotes({
      packetType: input.packetType,
      layer,
      sourceStyle,
      buckets,
      coverage,
      owaDomainDefaultsResolved,
    }),
    next_step: createNextStep({
      packetType: input.packetType,
      layer,
      buckets,
      owaDomainDefaultsResolved,
    }),
  };
}

function createFindingCounts(
  findings: readonly PacketDefinitionReadinessFinding[]
): Record<PacketDefinitionReadinessFindingSeverity, number> {
  return findings.reduce<Record<PacketDefinitionReadinessFindingSeverity, number>>(
    (counts, finding) => ({
      ...counts,
      [finding.severity]: counts[finding.severity] + 1,
    }),
    { error: 0, warning: 0, info: 0 }
  );
}

function isDefinitionWidePart(part: PacketDefinitionPartDescriptor): boolean {
  return part.defines_packet_subtype === null || part.part_subtype !== 'defaults_definition';
}

function partAppliesToSubtype(
  part: PacketDefinitionPartDescriptor,
  packetSubtype: string
): boolean {
  return (
    part.defines_packet_subtype === packetSubtype ||
    part.applies_to?.packet_subtype === packetSubtype ||
    part.covers_subtypes?.includes(packetSubtype) ||
    isDefinitionWidePart(part)
  );
}

function createRequiredPartIds(input: {
  parts: readonly PacketDefinitionPartDescriptor[];
  packetSubtype: string;
}): Partial<Record<PacketDefinitionPartSubtype, string[]>> {
  return REQUIRED_DEFINITION_PARTS.reduce<
    Partial<Record<PacketDefinitionPartSubtype, string[]>>
  >((partIds, partSubtype) => {
    const matchingParts = input.parts.filter(
      (part) =>
        part.part_subtype === partSubtype &&
        partAppliesToSubtype(part, input.packetSubtype)
    );

    return {
      ...partIds,
      [partSubtype]: matchingParts.map((part) => part.part_id),
    };
  }, {});
}

function findSubtypeDefaults(input: {
  parts: readonly PacketDefinitionPartDescriptor[];
  packetType: string;
  packetSubtype: string;
}): PacketDefinitionPartDescriptor[] {
  return input.parts.filter(
    (part) =>
      part.part_subtype === 'defaults_definition' &&
      part.defines_packet_type === input.packetType &&
      (part.defines_packet_subtype === input.packetSubtype ||
        part.applies_to?.packet_subtype === input.packetSubtype ||
        (part.defines_packet_subtype === null &&
          part.applies_to?.packet_subtype === null))
  );
}

function defaultPartHasUsefulSemantics(
  part: PacketDefinitionPartDescriptor,
  packetSubtype: string
): boolean {
  const defaultValues = part.default_values ?? {};
  const keys = Object.keys(defaultValues);

  if (keys.length === 0) {
    return false;
  }

  if (
    part.applies_to?.packet_subtype &&
    part.applies_to.packet_subtype !== packetSubtype
  ) {
    return false;
  }

  if (
    typeof defaultValues.subtype === 'string' &&
    defaultValues.subtype !== packetSubtype
  ) {
    return false;
  }

  return true;
}

function findProjectionParts(input: {
  parts: readonly PacketDefinitionPartDescriptor[];
  packetType: string;
  packetSubtype: string;
}): PacketDefinitionPartDescriptor[] {
  return input.parts.filter(
    (part) =>
      part.part_subtype === 'packet_projection_descriptor' &&
      part.defines_packet_type === input.packetType &&
      partAppliesToSubtype(part, input.packetSubtype)
  );
}

function findProjectionDescriptors(input: {
  definition: PacketTypeDefinition;
  projectionParts: readonly PacketDefinitionPartDescriptor[];
}): PacketProjectionDescriptor[] {
  const referencedKeys = new Set(
    input.projectionParts.flatMap((part) => part.references ?? [])
  );

  if (referencedKeys.size === 0) {
    return [...input.definition.projections];
  }

  return input.definition.projections.filter((projection) =>
    referencedKeys.has(projection.projection_key)
  );
}

function projectionDescriptorsAreRich(
  projections: readonly PacketProjectionDescriptor[]
): boolean {
  return projections.some(
    (projection) =>
      (projection.field_descriptors?.length ?? 0) > 0 &&
      projection.layout !== undefined
  );
}

function isAcceptableMinimalProjection(input: {
  packetType: string;
  projections: readonly PacketProjectionDescriptor[];
}): boolean {
  return (
    (input.packetType === 'Bundle' || input.packetType === 'Definition') &&
    input.projections.length > 0
  );
}

function isCarrierOnlyBundleSubtype(input: {
  packetType: string;
  packetSubtype: string;
}): boolean {
  return (
    input.packetType === 'Bundle' &&
    input.packetSubtype !== 'packet_set'
  );
}

function createSeedCandidateMap() {
  return new Map(
    buildDefinitionPacketSeedCandidates().map((candidate) => [
      candidate.part_id,
      candidate,
    ])
  );
}

function createSubtypeCompletenessEntries(): PacketDefinitionSubtypeCompletenessEntry[] {
  const seedCandidateMap = createSeedCandidateMap();

  return listDefinedPacketTypeDefinitions().flatMap((definition) => {
    const parts = listPacketDefinitionParts(definition);

    return definition.declared_subtypes.map((packetSubtype) => {
      const carrierOnlyBundleSubtype = isCarrierOnlyBundleSubtype({
        packetType: definition.packet_type,
        packetSubtype,
      });
      const requiredPartIds = createRequiredPartIds({
        parts,
        packetSubtype,
      });
      const defaultParts = findSubtypeDefaults({
        parts,
        packetType: definition.packet_type,
        packetSubtype,
      });
      const projectionParts = findProjectionParts({
        parts,
        packetType: definition.packet_type,
        packetSubtype,
      });
      const projectionDescriptors = findProjectionDescriptors({
        definition,
        projectionParts,
      });
      const applicableParts = parts.filter((part) =>
        partAppliesToSubtype(part, packetSubtype)
      );
      const issues: PacketDefinitionSubtypeCompletenessIssue[] = [];

      if (carrierOnlyBundleSubtype) {
        issues.push({
          code: 'missing_required_part',
          severity: 'info',
          message: `${definition.packet_type}.${packetSubtype} is a declared carrier label, not a separately seeded semantic Definition profile.`,
        });
      } else {
        for (const partSubtype of REQUIRED_DEFINITION_PARTS) {
          if ((requiredPartIds[partSubtype]?.length ?? 0) === 0) {
            issues.push({
              code: 'missing_required_part',
              severity: 'error',
              message: `${definition.packet_type}.${packetSubtype} is missing ${partSubtype} coverage.`,
            });
          }
        }
      }

      if (!carrierOnlyBundleSubtype &&
        (defaultParts.length === 0 ||
          !defaultParts.some((part) =>
            defaultPartHasUsefulSemantics(part, packetSubtype)
          ))
      ) {
        issues.push({
          code: 'weak_defaults',
          severity: 'error',
          message: `${definition.packet_type}.${packetSubtype} does not have a parseable subtype default-definition part with useful default values.`,
        });
      }

      if (projectionParts.length === 0 || projectionDescriptors.length === 0) {
        issues.push({
          code: 'weak_projection',
          severity: 'error',
          message: `${definition.packet_type}.${packetSubtype} is missing projection descriptor coverage.`,
        });
      } else if (!projectionDescriptorsAreRich(projectionDescriptors)) {
        const acceptableMinimal = isAcceptableMinimalProjection({
          packetType: definition.packet_type,
          projections: projectionDescriptors,
        });

        issues.push({
          code: 'weak_projection',
          severity: acceptableMinimal ? 'info' : 'warning',
          message: acceptableMinimal
            ? `${definition.packet_type}.${packetSubtype} intentionally keeps minimal carrier/bootstrap projection metadata.`
            : `${definition.packet_type}.${packetSubtype} projection descriptors are present but lack field/layout metadata.`,
        });
      }

      for (const part of applicableParts) {
        const seedCandidate = seedCandidateMap.get(part.part_id);

        if (!seedCandidate) {
          issues.push({
            code: 'seed_mismatch',
            severity: 'error',
            message: `${definition.packet_type}.${packetSubtype} definition part ${part.part_id} has no generated Definition seed packet.`,
          });
          continue;
        }

        const seedBody = seedCandidate.body_candidate.body;

        if (
          seedBody.defines_packet_type !== part.defines_packet_type ||
          seedBody.defines_packet_subtype !== part.defines_packet_subtype ||
          seedBody.definition_version !== part.schema_version ||
          seedBody.subtype !== part.part_subtype
        ) {
          issues.push({
            code: 'fallback_mismatch',
            severity: 'error',
            message: `${part.part_id} TypeScript fallback descriptor does not match generated Definition seed identity fields.`,
          });
        }
      }

      const blockingIssues = issues.filter((issue) => issue.severity === 'error');
      const warningIssues = issues.filter((issue) => issue.severity === 'warning');
      const infoIssues = issues.filter((issue) => issue.severity === 'info');
      const status: PacketDefinitionSubtypeCompletenessStatus =
        blockingIssues.length > 0
          ? 'blocked'
          : warningIssues.length > 0 || infoIssues.length > 0
            ? 'acceptable_minimal'
            : 'ready';

      return {
        packet_type: definition.packet_type,
        packet_subtype: packetSubtype,
        status,
        required_part_ids: requiredPartIds,
        default_part_ids: defaultParts.map((part) => part.part_id),
        projection_part_ids: projectionParts.map((part) => part.part_id),
        projection_keys: projectionDescriptors.map(
          (projection) => projection.projection_key
        ),
        seed_part_ids: applicableParts
          .filter((part) => seedCandidateMap.has(part.part_id))
          .map((part) => part.part_id),
        issues,
        notes:
          status === 'acceptable_minimal'
            ? ['Projection is intentionally minimal or not yet rich enough for generic UI projection.']
            : [],
      };
    });
  });
}

function createFindings(input: {
  entries: readonly PacketDefinitionReadinessEntry[];
  subtypeEntries: readonly PacketDefinitionSubtypeCompletenessEntry[];
}): PacketDefinitionReadinessFinding[] {
  const findings: PacketDefinitionReadinessFinding[] = [];

  for (const entry of input.entries) {
    if (entry.buckets.includes('definition_partial')) {
      findings.push({
        severity: 'error',
        packet_type: entry.packet_type,
        code: 'definition_partial',
        message: `${entry.packet_type} is missing one or more required manifest sections.`,
      });
    }

    if (entry.buckets.includes('compatibility_missing')) {
      findings.push({
        severity: 'error',
        packet_type: entry.packet_type,
        code: 'compatibility_missing',
        message: `${entry.packet_type} is missing compatibility posture or adapter metadata.`,
      });
    }

    if (entry.buckets.includes('projection_incomplete')) {
      findings.push({
        severity: 'info',
        packet_type: entry.packet_type,
        code: 'projection_incomplete',
        message: `${entry.packet_type} has minimal/bootstrap projection metadata rather than rich field/layout projection hints.`,
      });
    }

    if (entry.buckets.includes('write_incomplete')) {
      findings.push({
        severity: 'info',
        packet_type: entry.packet_type,
        code: 'write_incomplete',
        message: `${entry.packet_type} is not marked as runtime-ready for generic write execution.`,
      });
    }

    if (entry.buckets.includes('needs_decision')) {
      findings.push({
        severity: entry.packet_type === 'Discussion' ? 'info' : 'warning',
        packet_type: entry.packet_type,
        code: entry.packet_type === 'Discussion'
          ? 'owa_domain_projection_overlay_ready'
          : 'owa_domain_defaults_need_decision',
        message: entry.packet_type === 'Discussion'
          ? 'Discussion has a native aggregate projection overlay; remaining OWA decisions are default surface recipes, not core/runtime seams.'
          : `${entry.packet_type} has generic definition coverage, but OWA-specific default/seed semantics still need an explicit decision before reseed.`,
      });
    }
  }

  for (const subtypeEntry of input.subtypeEntries) {
    for (const issue of subtypeEntry.issues) {
      findings.push({
        severity: issue.severity,
        packet_type: subtypeEntry.packet_type,
        code: `subtype_${issue.code}`,
        message: `${subtypeEntry.packet_type}.${subtypeEntry.packet_subtype}: ${issue.message}`,
      });
    }
  }

  return findings;
}

function countBuckets(entries: readonly PacketDefinitionReadinessEntry[]): Record<PacketDefinitionReadinessBucket, number> {
  return entries.reduce<Record<PacketDefinitionReadinessBucket, number>>(
    (counts, entry) => {
      for (const bucket of entry.buckets) {
        counts[bucket] += 1;
      }

      return counts;
    },
    Object.fromEntries(ALL_BUCKETS.map((bucket) => [bucket, 0])) as Record<PacketDefinitionReadinessBucket, number>
  );
}

function countLayers(entries: readonly PacketDefinitionReadinessEntry[]): Record<PacketDefinitionReadinessLayer, number> {
  return entries.reduce<Record<PacketDefinitionReadinessLayer, number>>(
    (counts, entry) => ({
      ...counts,
      [entry.layer]: counts[entry.layer] + 1,
    }),
    Object.fromEntries(ALL_LAYERS.map((layer) => [layer, 0])) as Record<PacketDefinitionReadinessLayer, number>
  );
}

export function createPacketDefinitionReadinessAuditReport(): PacketDefinitionReadinessAuditReport {
  const manifestSource = readRepoFile(MANIFEST_FILE);
  const genericSource = readRepoFile(GENERIC_SOURCE_FILE);
  const packetTypes = listManifestPacketTypes(manifestSource);
  const genericPacketTypes = new Set(listGenericFactoryPacketTypes(genericSource));
  const entries = packetTypes.map((packetType) => createEntry({
    packetType,
    genericPacketTypes,
  }));
  const subtypeEntries = createSubtypeCompletenessEntries();
  const findings = createFindings({ entries, subtypeEntries });
  const findingCounts = createFindingCounts(findings);
  const scannedFiles = uniqueSorted([
    MANIFEST_FILE,
    GENERIC_SOURCE_FILE,
    ...Object.values(NATIVE_SOURCE_FILES),
  ]);

  return {
    report_kind: 'packet.definition_readiness_audit',
    status: findingCounts.error > 0 ? 'fail' : findingCounts.warning > 0 ? 'warn' : 'pass',
    scanned_files: scannedFiles,
    checked_packet_types: entries.map((entry) => entry.packet_type),
    bucket_counts: countBuckets(entries),
    layer_counts: countLayers(entries),
    entries,
    subtype_entries: subtypeEntries,
    findings,
  };
}
