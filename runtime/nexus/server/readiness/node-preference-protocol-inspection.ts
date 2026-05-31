/**
 * File: node-preference-protocol-inspection.ts
 * Description: Static inspection for node Element identity and Preference.node protocol readiness.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

export type NodePreferenceProtocolArea =
  | 'node_element_identity'
  | 'preference_node_schema'
  | 'definition_manifest_parts'
  | 'builder_projection_helpers'
  | 'verification_identity_storage'
  | 'trust_graph_authority'
  | 'runtime_service_boundary';

export type NodePreferenceProtocolStatus =
  | 'aligned'
  | 'mostly_aligned'
  | 'transitional'
  | 'missing';

export type NodePreferenceProtocolFindingSeverity = 'error' | 'warning' | 'info';

export type NodePreferenceProtocolFinding = {
  severity: NodePreferenceProtocolFindingSeverity;
  area: NodePreferenceProtocolArea;
  code: string;
  message: string;
};

export type NodePreferenceProtocolEntry = {
  area: NodePreferenceProtocolArea;
  status: NodePreferenceProtocolStatus;
  source_files: string[];
  evidence: string[];
  next_step: string;
};

export type NodePreferenceProtocolInspectionReport = {
  report_kind: 'packet.node_preference_protocol_inspection';
  status: 'pass' | 'warn' | 'fail';
  design_locked: {
    node_identity_carrier: 'Element.node';
    node_preferences_carrier: 'Preference.node';
    trust_ratings_authority: 'packet_graph_attestations_and_verification_reports';
    private_key_authority: 'local_secure_runtime_configuration';
    runtime_boundary: 'trusted_coordinators_only';
  };
  scanned_files: string[];
  counts: {
    preference_node_actions: number;
    preference_node_definition_parts: number;
    node_preference_helpers: number;
    local_validator_side_tables: number;
    private_key_side_table_fields: number;
  };
  entries: NodePreferenceProtocolEntry[];
  findings: NodePreferenceProtocolFinding[];
};

const SOURCE_FILES = [
  'core/schema/packet-ontology.ts',
  'core/schema/packet-body-schemas.ts',
  'core/packets/definitions/preference.ts',
  'core/packets/definitions/preference-helpers.ts',
  'runtime/nexus/server/verification-service.ts',
  'runtime/storage/packet-store-schema.ts',
  'runtime/storage/node-sqlite-packet-store.ts',
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

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

function createEntry(input: NodePreferenceProtocolEntry): NodePreferenceProtocolEntry {
  return {
    ...input,
    source_files: uniqueSorted(input.source_files),
  };
}

function statusFromFindings(
  findings: readonly NodePreferenceProtocolFinding[]
): NodePreferenceProtocolInspectionReport['status'] {
  if (findings.some((finding) => finding.severity === 'error')) {
    return 'fail';
  }

  if (findings.some((finding) => finding.severity === 'warning')) {
    return 'warn';
  }

  return 'pass';
}

export function createNodePreferenceProtocolInspectionReport(): NodePreferenceProtocolInspectionReport {
  const sources = Object.fromEntries(
    SOURCE_FILES.map((filePath) => [filePath, readRepoFile(filePath)])
  ) as Record<(typeof SOURCE_FILES)[number], string>;

  const ontology = sources['core/schema/packet-ontology.ts'];
  const bodySchemas = sources['core/schema/packet-body-schemas.ts'];
  const preferenceDefinition = sources['core/packets/definitions/preference.ts'];
  const preferenceHelpers = sources['core/packets/definitions/preference-helpers.ts'];
  const verificationService = sources['runtime/nexus/server/verification-service.ts'];
  const packetStoreSchema = sources['runtime/storage/packet-store-schema.ts'];
  const sqlitePacketStore = sources['runtime/storage/node-sqlite-packet-store.ts'];

  const counts = {
    preference_node_actions: countMatches(preferenceDefinition, /preference\.node\.[a-z_]+/g),
    preference_node_definition_parts: countMatches(
      preferenceDefinition,
      /part_id: 'preference\.node\./g
    ),
    node_preference_helpers: countMatches(
      preferenceHelpers,
      /buildNodePreferenceBody|projectLatestActiveNodePreference|createNodePreferencePacketId|normalizeNodePreferenceValue/g
    ),
    local_validator_side_tables: countMatches(
      `${packetStoreSchema}\n${sqlitePacketStore}`,
      /runtime_validator_identity/g
    ),
    private_key_side_table_fields: countMatches(
      `${packetStoreSchema}\n${sqlitePacketStore}`,
      /private_jwk_json|private_jwk/g
    ),
  };

  const findings: NodePreferenceProtocolFinding[] = [];

  if (!ontology.includes("'node'")) {
    findings.push({
      severity: 'error',
      area: 'node_element_identity',
      code: 'ELEMENT_NODE_SUBTYPE_MISSING',
      message: 'Element.node is not declared in the packet ontology.',
    });
  }

  if (!bodySchemas.includes('NodePreferenceBodySchema')) {
    findings.push({
      severity: 'error',
      area: 'preference_node_schema',
      code: 'CANONICAL_NODE_PREFERENCE_SCHEMA_MISSING',
      message: 'Canonical packet body schemas do not expose Preference.node.',
    });
  }

  if (counts.preference_node_definition_parts < 8) {
    findings.push({
      severity: 'error',
      area: 'definition_manifest_parts',
      code: 'NODE_DEFINITION_PARTS_INCOMPLETE',
      message:
        'Preference.node does not yet have the full definition-part bundle expected for packet-backed profiles.',
    });
  }

  if (counts.node_preference_helpers < 4) {
    findings.push({
      severity: 'error',
      area: 'builder_projection_helpers',
      code: 'NODE_HELPERS_INCOMPLETE',
      message:
        'Preference.node helper coverage is incomplete for builder, deterministic id, normalization, and latest-active projection.',
    });
  }

  if (counts.local_validator_side_tables > 0 || counts.private_key_side_table_fields > 0) {
    findings.push({
      severity: 'warning',
      area: 'verification_identity_storage',
      code: 'LOCAL_VALIDATOR_SECRET_STORAGE_TRANSITIONAL',
      message:
        'Local validator identity still uses a runtime side table with private JWK storage. This is acceptable for local development but should migrate toward secure runtime configuration or an encrypted local secret store before node exchange hardening.',
    });
  }

  if (!preferenceDefinition.includes('trusted_node_attestation_refs')) {
    findings.push({
      severity: 'error',
      area: 'trust_graph_authority',
      code: 'TRUST_ATTESTATION_POINTERS_MISSING',
      message:
        'Preference.node must point at trust attestations instead of becoming the trust-score authority.',
    });
  }

  const entries: NodePreferenceProtocolEntry[] = [
    createEntry({
      area: 'node_element_identity',
      status:
        ontology.includes("'node'") &&
        verificationService.includes("subtype: 'node'") &&
        !verificationService.includes("subtype: 'local_validator'")
          ? 'aligned'
          : 'transitional',
      source_files: [
        'core/schema/packet-ontology.ts',
        'runtime/nexus/server/verification-service.ts',
      ],
      evidence: [
        ontology.includes("'node'")
          ? 'Element.node is available as a canonical element subtype.'
          : 'Element.node is not declared.',
        verificationService.includes("subtype: 'node'")
          ? 'Runtime validator identity creation now emits an Element.node packet.'
          : 'Runtime validator identity creation is not yet using Element.node.',
      ],
      next_step:
        'Give each environment its own stable node Element packet and avoid cloning node identity across local and production imports.',
    }),
    createEntry({
      area: 'preference_node_schema',
      status:
        bodySchemas.includes('NodePreferenceBodySchema') &&
        preferenceDefinition.includes('NodePreferenceBodySchema')
          ? 'aligned'
          : 'missing',
      source_files: [
        'core/schema/packet-body-schemas.ts',
        'core/packets/definitions/preference.ts',
      ],
      evidence: [
        'Preference.node carries definition profile selection, trust graph defaults, import verification defaults, and storage cleanup defaults.',
        'Preference.node defaults to sealed_private because it may include operational trust and cleanup posture.',
      ],
      next_step:
        'Seed an initial node preference for local-dev / production nodes once reseed packet identities are finalized.',
    }),
    createEntry({
      area: 'definition_manifest_parts',
      status: counts.preference_node_definition_parts >= 8 ? 'aligned' : 'missing',
      source_files: ['core/packets/definitions/preference.ts'],
      evidence: [
        `${counts.preference_node_actions} Preference.node action references are present in the canonical definition.`,
        `${counts.preference_node_definition_parts} Preference.node definition part(s) are present.`,
      ],
      next_step:
        'Keep Preference.node expressed through definition parts so profile resolution can stay packet-backed.',
    }),
    createEntry({
      area: 'builder_projection_helpers',
      status: counts.node_preference_helpers >= 4 ? 'aligned' : 'missing',
      source_files: ['core/packets/definitions/preference-helpers.ts'],
      evidence: [
        'Node preference builder, deterministic packet id, normalization, and latest-active projection helpers are present.',
      ],
      next_step:
        'Wire live node preference reads through the Definition and Projection coordinators when node bootstrap starts consuming packet-backed preferences.',
    }),
    createEntry({
      area: 'verification_identity_storage',
      status: counts.private_key_side_table_fields > 0 ? 'transitional' : 'aligned',
      source_files: [
        'runtime/storage/packet-store-schema.ts',
        'runtime/storage/node-sqlite-packet-store.ts',
      ],
      evidence: [
        `${counts.local_validator_side_tables} runtime_validator_identity reference(s) were found.`,
        `${counts.private_key_side_table_fields} private key storage reference(s) were found.`,
      ],
      next_step:
        'Do not store private keys in packet bodies. Move node signing secrets toward env-backed or encrypted local secret material before enabling node-to-node exchange.',
    }),
    createEntry({
      area: 'trust_graph_authority',
      status: preferenceDefinition.includes('trusted_node_attestation_refs')
        ? 'aligned'
        : 'missing',
      source_files: ['core/packets/definitions/preference.ts'],
      evidence: [
        'Preference.node stores trust defaults and pointers to trust attestations; it is not the final trust score source of truth.',
      ],
      next_step:
        'When import exchange lands, resolve node trust from attestations, verification reports, and administrator preference defaults through the trusted coordinators.',
    }),
    createEntry({
      area: 'runtime_service_boundary',
      status: 'aligned',
      source_files: ['core/packets/definitions/preference.ts'],
      evidence: [
        'The pass adds no independent node preference service; node preferences are packet definitions consumed by existing trusted coordinators.',
      ],
      next_step:
        'Keep future node bootstrap reads under Definition / Projection / Verification / Archive coordinator jurisdiction.',
    }),
  ];

  return {
    report_kind: 'packet.node_preference_protocol_inspection',
    status: statusFromFindings(findings),
    design_locked: {
      node_identity_carrier: 'Element.node',
      node_preferences_carrier: 'Preference.node',
      trust_ratings_authority: 'packet_graph_attestations_and_verification_reports',
      private_key_authority: 'local_secure_runtime_configuration',
      runtime_boundary: 'trusted_coordinators_only',
    },
    scanned_files: [...SOURCE_FILES],
    counts,
    entries,
    findings,
  };
}
