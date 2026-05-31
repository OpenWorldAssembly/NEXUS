/**
 * File: definition-bootstrap-profile-inspection.ts
 * Description: Static inspection of Definition kernel, packetized definition seed material, and stored-profile readiness.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type DefinitionBootstrapProfileInspectionArea =
  | 'hardcoded_definition_kernel'
  | 'stored_definition_packet_material'
  | 'definition_bundle_profile'
  | 'active_definition_source_resolution'
  | 'archive_backed_definition_loading'
  | 'node_profile_selection'
  | 'definition_component_model'
  | 'typescript_manifest_role'
  | 'runtime_execution_boundary';

export type DefinitionBootstrapProfileInspectionStatus =
  | 'aligned'
  | 'mostly_aligned'
  | 'transitional'
  | 'missing';

export type DefinitionBootstrapProfileFindingSeverity = 'error' | 'warning' | 'info';

export type DefinitionBootstrapProfileFinding = {
  severity: DefinitionBootstrapProfileFindingSeverity;
  area: DefinitionBootstrapProfileInspectionArea;
  code: string;
  message: string;
};

export type DefinitionBootstrapProfileInspectionEntry = {
  area: DefinitionBootstrapProfileInspectionArea;
  status: DefinitionBootstrapProfileInspectionStatus;
  source_files: string[];
  evidence: string[];
  next_step: string;
};

export type DefinitionBootstrapProfileInspectionReport = {
  report_kind: 'packet.definition_bootstrap_profile_inspection';
  status: 'pass' | 'warn' | 'fail';
  design_locked: {
    kernel_authority: 'core_native_definition_packet_schema';
    definition_authority_target: 'stored_definition_packets';
    profile_carrier: 'bundle_packet_set';
    executable_authority: 'trusted_local_runtime_capabilities';
    selection_authority_target: 'node_scope_defaults_preferences_policies';
  };
  scanned_files: string[];
  counts: {
    definition_subtypes: number;
    required_definition_parts: number;
    trusted_definition_source_kinds: number;
    trusted_definition_trust_tiers: number;
    generated_definition_seed_helpers: number;
  };
  entries: DefinitionBootstrapProfileInspectionEntry[];
  findings: DefinitionBootstrapProfileFinding[];
};

const SOURCE_FILES = [
  'core/packets/definitions/definition.ts',
  'core/packets/definitions/definition-bootstrap.ts',
  'core/packets/packet-definition-manifest.ts',
  'core/packets/packet-definition-seeds.ts',
  'core/packets/seeds.ts',
  'runtime/trusted_coordinators/trusted_definition_coordinator/trusted_definition_types.ts',
  'runtime/trusted_coordinators/trusted_definition_coordinator/functions/list_trusted_definition_candidates.ts',
  'runtime/trusted_coordinators/trusted_definition_coordinator/functions/list_seeded_definition_bundle_candidates.ts',
  'runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_definition_context.ts',
  'runtime/trusted_coordinators/trusted_definition_coordinator/functions/normalize_packet_backed_definition_preferences.ts',
  'runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_packet_definition.ts',
  'runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_definition_part.ts',
  'docs/implementation-guide/packet-definition-manifest-rd.md',
] as const;

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

function hasAll(source: string, fragments: readonly string[]): boolean {
  return fragments.every((fragment) => source.includes(fragment));
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function createEntry(
  input: DefinitionBootstrapProfileInspectionEntry
): DefinitionBootstrapProfileInspectionEntry {
  return {
    ...input,
    source_files: uniqueSorted(input.source_files),
  };
}

function statusFromFindings(
  findings: readonly DefinitionBootstrapProfileFinding[]
): DefinitionBootstrapProfileInspectionReport['status'] {
  if (findings.some((finding) => finding.severity === 'error')) {
    return 'fail';
  }

  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'warn';
  }

  return 'pass';
}

export function createDefinitionBootstrapProfileInspectionReport(): DefinitionBootstrapProfileInspectionReport {
  const sources = Object.fromEntries(
    SOURCE_FILES.map((filePath) => [filePath, readRepoFile(filePath)])
  ) as Record<(typeof SOURCE_FILES)[number], string>;

  const definitionKernel = sources['core/packets/definitions/definition.ts'];
  const definitionBootstrap = sources['core/packets/definitions/definition-bootstrap.ts'];
  const manifest = sources['core/packets/packet-definition-manifest.ts'];
  const definitionSeeds = sources['core/packets/packet-definition-seeds.ts'];
  const seeds = sources['core/packets/seeds.ts'];
  const trustedTypes = sources['runtime/trusted_coordinators/trusted_definition_coordinator/trusted_definition_types.ts'];
  const candidateListing = sources['runtime/trusted_coordinators/trusted_definition_coordinator/functions/list_trusted_definition_candidates.ts'];
  const seededBundleCandidateListing = sources['runtime/trusted_coordinators/trusted_definition_coordinator/functions/list_seeded_definition_bundle_candidates.ts'];
  const contextResolver = sources['runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_definition_context.ts'];
  const packetBackedPreferenceNormalizer = sources['runtime/trusted_coordinators/trusted_definition_coordinator/functions/normalize_packet_backed_definition_preferences.ts'];
  const packetResolver = sources['runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_packet_definition.ts'];
  const partResolver = sources['runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_definition_part.ts'];
  const packetDefinitionDoc = sources['docs/implementation-guide/packet-definition-manifest-rd.md'];

  const definitionSubtypesMatch = definitionKernel.match(/export const DEFINITION_PACKET_SUBTYPES = \[([\s\S]*?)\] as const;/s);
  const definitionSubtypesSource = definitionSubtypesMatch?.[1] ?? '';
  const requiredPartsMatch = definitionBootstrap.match(/export const REQUIRED_PACKET_DEFINITION_PARTS = \[([\s\S]*?)\] as const/s);
  const requiredPartsSource = requiredPartsMatch?.[1] ?? '';

  const counts = {
    definition_subtypes: countMatches(definitionSubtypesSource, /'[^']+'/g),
    required_definition_parts: countMatches(requiredPartsSource, /'[^']+'/g),
    trusted_definition_source_kinds: countMatches(
      trustedTypes.match(/export type TrustedDefinitionSourceKind =([\s\S]*?);/s)?.[1] ?? '',
      /'[^']+'/g
    ),
    trusted_definition_trust_tiers: countMatches(
      trustedTypes.match(/export type TrustedDefinitionTrustTier =([\s\S]*?);/s)?.[1] ?? '',
      /'[^']+'/g
    ),
    generated_definition_seed_helpers: countMatches(definitionSeeds, /export function buildDefinition|export function resolveSeeded|export function auditSeeded/g),
  };

  const entries: DefinitionBootstrapProfileInspectionEntry[] = [
    createEntry({
      area: 'hardcoded_definition_kernel',
      status: hasAll(definitionKernel, [
        'DefinitionBodySchema',
        'DEFINITION_PACKET_SUBTYPES',
        'definitionPacketDefinition',
        'bootstrap_mode',
        'core_native_v0',
      ])
        ? 'aligned'
        : 'missing',
      source_files: [
        'core/packets/definitions/definition.ts',
        'core/packets/definitions/definition-bootstrap.ts',
      ],
      evidence: [
        `${counts.definition_subtypes} Definition packet subtype(s) are declared in the hardcoded kernel.`,
        `${counts.required_definition_parts} required Definition part subtype(s) are listed for bootstrap resolution.`,
        'Definition v0 explicitly records core_native_v0 bootstrap mode for the Definition packet itself.',
      ],
      next_step:
        'Keep this kernel small and stable; add new Definition subtypes only when stored profiles need an actual missing component class.',
    }),
    createEntry({
      area: 'stored_definition_packet_material',
      status: hasAll(definitionSeeds, [
        'buildDefinitionPacketSeedEnvelopes',
        'createDefinitionPacket',
        'DefinitionBody',
        'SeededPacketDefinitionProfile',
        'auditSeededPacketDefinitionProfile',
      ])
        ? 'aligned'
        : 'transitional',
      source_files: ['core/packets/packet-definition-seeds.ts', 'core/packets/seeds.ts'],
      evidence: [
        'Active manifest parts can already be materialized as schema-validated Definition packet envelopes.',
        seeds.includes('DEFINITION_PROFILE_SEED_PACKETS')
          ? 'Definition profile seed packets are included in CANONICAL_SEED_PACKETS.'
          : 'Definition profile seed packets are not yet included in canonical seed packets.',
      ],
      next_step:
        'Treat generated Definition packet material as the reseed bridge; do not make TypeScript descriptors the long-term semantic source of truth.',
    }),
    createEntry({
      area: 'definition_bundle_profile',
      status: hasAll(definitionSeeds, [
        'buildDefinitionBundlePacketSetCandidate',
        'packet_set',
        'definition_revision_refs',
        'SEEDED_DEFINITION_PROFILE_ID',
        'SEEDED_DEFINITION_BUNDLE_PACKET_ID',
      ])
        ? 'aligned'
        : 'transitional',
      source_files: ['core/packets/packet-definition-seeds.ts'],
      evidence: [
        'One Bundle.packet_set candidate groups active Definition part refs into a definition profile inventory.',
        'The bundle stores manifest digest and profile metadata for reseed verification.',
      ],
      next_step:
        'Next stored-profile work should read the active definition profile from local archive / pinned Bundle packets after reseed material exists in the packet store.',
    }),
    createEntry({
      area: 'active_definition_source_resolution',
      status: hasAll(trustedTypes, [
        'TrustedDefinitionSourceKind',
        'local_packet_archive',
        'imported_bundle',
        'pinned_bundle',
        'TrustedDefinitionRuntimePreference',
      ]) && hasAll(contextResolver, [
        'rankTrustedDefinitionCandidates',
        'auditTrustedDefinitionConflicts',
        'preferences_used',
      ])
        ? 'mostly_aligned'
        : 'transitional',
      source_files: [
        'runtime/trusted_coordinators/trusted_definition_coordinator/trusted_definition_types.ts',
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_definition_context.ts',
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/normalize_packet_backed_definition_preferences.ts',
      ],
      evidence: [
        `${counts.trusted_definition_source_kinds} trusted definition source kind(s) and ${counts.trusted_definition_trust_tiers} trust tier(s) exist in the coordinator contract.`,
        'Candidate ranking, conflict audit, compatibility candidates, ignored candidates, and caller-provided preferences are modeled.',
        seededBundleCandidateListing.includes('listSeededDefinitionBundleCandidates')
          ? 'Seeded Bundle.packet_set material now participates in Trusted Definition candidate listing.'
          : 'Seeded Bundle.packet_set material does not yet participate in Trusted Definition candidate listing.',
      ],
      next_step:
        'Promote source resolution from bootstrap/caller-provided candidates to archive-backed definition profile loading when reseed material is ready.',
    }),
    createEntry({
      area: 'archive_backed_definition_loading',
      status: hasAll(candidateListing + seededBundleCandidateListing, [
        'listSeededDefinitionBundleCandidates',
        'resolveSeededPacketDefinitionProfile',
        'DefinitionBodySchema.safeParse',
        'BundleBodySchema.safeParse',
        "source_kind: 'seeded_bundle'",
      ])
        ? 'mostly_aligned'
        : 'transitional',
      source_files: [
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/list_trusted_definition_candidates.ts',
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/list_seeded_definition_bundle_candidates.ts',
      ],
      evidence: [
        candidateListing.includes('listSeededDefinitionBundleCandidates')
          ? 'Trusted Definition candidate listing now includes seeded Bundle.packet_set candidates before bootstrap fallback candidates.'
          : 'Candidate listing has not yet enrolled seeded Bundle.packet_set candidates.',
        seededBundleCandidateListing.includes('DefinitionBodySchema.safeParse') && seededBundleCandidateListing.includes('BundleBodySchema.safeParse')
          ? 'Seeded Definition and Bundle packets are kernel-validated before becoming candidates.'
          : 'Seeded Definition and Bundle packets are not yet kernel-validated by the coordinator.',
        candidateListing.includes('listDefinedPacketTypeDefinitions()')
          ? 'The TypeScript bootstrap manifest remains the safe fallback and compiled runtime snapshot.'
          : 'Candidate listing no longer relies on the TypeScript bootstrap manifest as a fallback source.',
        candidateListing.includes('input.candidates')
          ? 'Caller-provided candidates remain supported, so future archive/import candidates still have an insertion seam.'
          : 'Caller-provided candidates are not yet supported.',
      ],
      next_step:
        'Next, replace the seeded-profile helper with real local archive / pinned bundle loading after reseed material exists in the packet store.',
    }),
    createEntry({
      area: 'node_profile_selection',
      status: hasAll(trustedTypes, [
        'node_element_id',
        'scope_packet_id',
        'TrustedDefinitionRuntimePreference',
        'TrustedDefinitionProfilePreferencePacket',
        'definition_profile_preference_packets',
        'trust_mode',
        'priority',
      ]) && hasAll(contextResolver + packetBackedPreferenceNormalizer, [
        'normalizePacketBackedDefinitionPreferences',
        'definition_profile_preferences',
        'BundleBodySchema.safeParse',
      ])
        ? 'mostly_aligned'
        : 'transitional',
      source_files: [
        'runtime/trusted_coordinators/trusted_definition_coordinator/trusted_definition_types.ts',
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_definition_context.ts',
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/normalize_packet_backed_definition_preferences.ts',
      ],
      evidence: [
        'Definition context carries node_element_id, scope_packet_id, runtime preferences, and packet-backed preference carriers.',
        packetBackedPreferenceNormalizer.includes('definition_profile_preferences')
          ? 'Bundle packet-backed definition profile preference descriptors are normalized into TrustedDefinitionRuntimePreference before candidate ranking.'
          : 'Profile selection preferences are caller-provided metadata today; they are not yet loaded from packet-backed carriers.',
      ],
      next_step:
        'Next, connect local archive/pinned profile search to this packet-backed preference-carrier seam after reseed material is stored.',
    }),
    createEntry({
      area: 'definition_component_model',
      status: hasAll(definitionKernel, [
        'packet_action_registry',
        'packet_builder_descriptor',
        'packet_planner_descriptor',
        'packet_projection_descriptor',
        'packet_compatibility',
        'defaults_definition',
        'dependencies_definition',
      ])
        ? 'mostly_aligned'
        : 'transitional',
      source_files: ['core/packets/definitions/definition.ts'],
      evidence: [
        'Current Definition components cover schema, actions, builders, planners, projections, compatibility, defaults, and dependencies.',
        definitionKernel.includes('policy_definition')
          ? 'A dedicated policy_definition component already exists.'
          : 'Policy semantics currently live through Policy packets and dependency/policy descriptors rather than a dedicated Definition subtype.',
      ],
      next_step:
        'Before Discussion projection work, decide whether policy/action/surface variants need new Definition subtypes or remain descriptors inside existing components.',
    }),
    createEntry({
      area: 'typescript_manifest_role',
      status: manifest.includes('PACKET_TYPE_DEFINITIONS') && packetResolver.includes('payload.definition')
        ? 'transitional'
        : 'mostly_aligned',
      source_files: [
        'core/packets/packet-definition-manifest.ts',
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_packet_definition.ts',
        'runtime/trusted_coordinators/trusted_definition_coordinator/functions/resolve_trusted_definition_part.ts',
      ],
      evidence: [
        'PACKET_TYPE_DEFINITIONS remains the active local manifest source for runtime definition resolution.',
        packetResolver.includes('payload.definition') && partResolver.includes('payload.part')
          ? 'Trusted Definition still resolves local PacketTypeDefinition/part descriptor payloads, not stored Definition packet bodies.'
          : 'Trusted Definition no longer resolves local descriptor payloads directly.',
      ],
      next_step:
        'Recast TypeScript definitions as bootstrap/compiler snapshots after stored Definition profile resolution exists.',
    }),
    createEntry({
      area: 'runtime_execution_boundary',
      status: hasAll(packetDefinitionDoc, [
        'trusted local code',
        'imported definition packets do not execute',
      ]) || hasAll(packetDefinitionDoc, [
        'trusted-local',
        'must never execute',
      ])
        ? 'aligned'
        : 'transitional',
      source_files: [
        'docs/implementation-guide/packet-definition-manifest-rd.md',
        'runtime/trusted_coordinators/trusted_definition_coordinator/trusted_definition_types.ts',
      ],
      evidence: [
        'Existing docs preserve the safety boundary: Definition packets describe behavior; trusted local runtime capabilities execute behavior.',
        'Coordinator source/trust tiers model core seed, pinned/preferred node material, imports, compatibility-only candidates, quarantine, and ignored candidates.',
      ],
      next_step:
        'Keep imported definitions descriptive. Local runtimes may support or ignore declared builders/planners/projections based on trusted capability allowlists.',
    }),
  ];

  const findings: DefinitionBootstrapProfileFinding[] = [];

  if (entries.find((entry) => entry.area === 'archive_backed_definition_loading')?.status !== 'mostly_aligned') {
    findings.push({
      severity: 'warning',
      area: 'archive_backed_definition_loading',
      code: 'stored_definition_candidate_loader_incomplete',
      message:
        'Trusted Definition has not yet completed seeded Bundle.packet_set candidate loading and kernel validation inside the existing coordinator path.',
    });
  } else {
    findings.push({
      severity: 'info',
      area: 'archive_backed_definition_loading',
      code: 'seeded_bundle_candidate_loader_active',
      message:
        'Trusted Definition now lists kernel-validated seeded Bundle.packet_set candidates inside the existing coordinator path. Local archive and pinned bundle loading remain future extensions of the same source model.',
    });
  }

  if (entries.find((entry) => entry.area === 'node_profile_selection')?.status === 'transitional') {
    findings.push({
      severity: 'warning',
      area: 'node_profile_selection',
      code: 'node_profile_selection_not_packet_backed',
      message:
        'Definition profile preferences are represented in coordinator input but packet-backed Bundle preference carriers are not yet normalized before ranking.',
    });
  }

  if (entries.find((entry) => entry.area === 'typescript_manifest_role')?.status === 'transitional') {
    findings.push({
      severity: 'warning',
      area: 'typescript_manifest_role',
      code: 'typescript_manifest_still_runtime_source',
      message:
        'The active runtime still resolves TypeScript PacketTypeDefinition payloads. Stored Definition packets are seed material, not yet the primary active definition source.',
    });
  }

  if (!definitionKernel.includes('policy_definition')) {
    findings.push({
      severity: 'info',
      area: 'definition_component_model',
      code: 'policy_semantics_are_descriptor_backed',
      message:
        'There is no dedicated policy_definition Definition subtype. Current policy semantics are represented through Policy packets plus policy/dependency descriptors; revisit only if Discussion or OWA defaults need a first-class Definition policy component.',
    });
  }

  return {
    report_kind: 'packet.definition_bootstrap_profile_inspection',
    status: statusFromFindings(findings),
    design_locked: {
      kernel_authority: 'core_native_definition_packet_schema',
      definition_authority_target: 'stored_definition_packets',
      profile_carrier: 'bundle_packet_set',
      executable_authority: 'trusted_local_runtime_capabilities',
      selection_authority_target: 'node_scope_defaults_preferences_policies',
    },
    scanned_files: SOURCE_FILES.filter((filePath) => existsSync(repoPath(filePath))),
    counts,
    entries,
    findings,
  };
}
