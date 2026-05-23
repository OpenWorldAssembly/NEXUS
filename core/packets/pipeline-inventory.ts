/**
 * File: pipeline-inventory.ts
 * Description: Active packet-type inventory for canonical builder, definition, and read-model tracking.
 */

import { PACKET_TYPES, type PacketType } from '@core/schema/packet-schema';

export type PacketPipelineCompatibilityStance =
  | 'current_only'
  | 'legacy_supported'
  | 'forward_only'
  | 'bidirectional_supported';

export type PipelineStatus =
  | 'none'
  | 'declared'
  | 'partial'
  | 'tested'
  | 'production';

export interface PacketPipelineInventoryEntry {
  type: PacketType;
  canonical_structure: string;
  builder_path: string;
  compatibility_stance: PacketPipelineCompatibilityStance;
  read_projection_path: string;
  ui_consumers: string[];
  write_paths: string[];
  known_manual_assumptions: string[];
  builder_pipeline_status: PipelineStatus;
  same_type_adapter_status: PipelineStatus;
  type_evolution_status: PipelineStatus;
  read_model_status: PipelineStatus;
  next_migration_step: string;
}

function createEntry(
  type: PacketType,
  input: Omit<PacketPipelineInventoryEntry, 'type'>
): PacketPipelineInventoryEntry {
  return {
    type,
    ...input,
  };
}

function canonicalEntry(
  type: PacketType,
  input: {
    canonicalStructure: string;
    builderPath: string;
    readProjectionPath: string;
    uiConsumers?: string[];
    writePaths?: string[];
    assumptions?: string[];
    compatibilityStance?: PacketPipelineCompatibilityStance;
    readModelStatus?: PipelineStatus;
    nextStep?: string;
  }
): PacketPipelineInventoryEntry {
  return createEntry(type, {
    canonical_structure: input.canonicalStructure,
    builder_path: input.builderPath,
    compatibility_stance: input.compatibilityStance ?? 'current_only',
    read_projection_path: input.readProjectionPath,
    ui_consumers: input.uiConsumers ?? [],
    write_paths: input.writePaths ?? [],
    known_manual_assumptions: input.assumptions ?? [],
    builder_pipeline_status: 'production',
    same_type_adapter_status: 'tested',
    type_evolution_status: 'none',
    read_model_status: input.readModelStatus ?? 'declared',
    next_migration_step:
      input.nextStep ??
      'Keep canonical subtype writes aligned with the active definition profile before reseed.',
  });
}

export const PACKET_PIPELINE_INVENTORY: Record<
  PacketType,
  PacketPipelineInventoryEntry
> = {
  Definition: canonicalEntry('Definition', {
    canonicalStructure: 'Definition(subtype, defines_packet_type, definition parts)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/definition.ts',
    readProjectionPath:
      'core/packets/packet-definition-seeds.ts canonical definition profile audit',
    writePaths: ['Bootstrap definition profile seed material'],
    assumptions: [
      'Definition packets describe packet semantics; trusted local code remains the only executable authority.',
    ],
    readModelStatus: 'tested',
    nextStep:
      'Keep Definition bootstrap validation small while reseed starts from the active definition profile bundle.',
  }),
  Element: canonicalEntry('Element', {
    canonicalStructure: 'Element(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/element.ts',
    readProjectionPath: 'runtime identity/query services',
    uiConsumers: ['Shell', 'Trust', 'Roles', 'Library', 'Dashboard'],
    writePaths: ['Identity bootstrap', 'Locality creation', 'Mutation corridor'],
    compatibilityStance: 'current_only',
  }),
  Location: canonicalEntry('Location', {
    canonicalStructure: 'Location(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/location.ts',
    readProjectionPath:
      'core/projections/forward-ontology.ts + runtime scope/location read helpers',
  }),
  Role: canonicalEntry('Role', {
    canonicalStructure: 'Role(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/role.ts',
    readProjectionPath: 'runtime role projections',
    uiConsumers: ['Roles'],
    writePaths: ['Bootstrap and role query projections'],
  }),
  Claim: canonicalEntry('Claim', {
    canonicalStructure: 'Claim(subtype, relation_assertion)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/claim.ts',
    readProjectionPath: 'trust/claim helpers',
    uiConsumers: ['Trust', 'Roles', 'Locality'],
    writePaths: ['Mutation corridor', 'Trust surface helpers'],
  }),
  Relation: canonicalEntry('Relation', {
    canonicalStructure: 'Relation(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/relation.ts',
    readProjectionPath:
      'core/projections/forward-ontology.ts + runtime/nexus/server/claim-utils.ts',
    writePaths: ['Mutation corridor', 'Forward packet builders'],
  }),
  Report: canonicalEntry('Report', {
    canonicalStructure: 'Report(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/report.ts',
    readProjectionPath:
      'runtime verification/import reporting projections + Explorer verification surfaces',
    uiConsumers: ['Explorer', 'Dashboard', 'Packet action menus'],
    writePaths: ['Runtime verification service', 'Runtime import reporting'],
  }),
  Proposal: canonicalEntry('Proposal', {
    canonicalStructure: 'Proposal(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/proposal.ts',
    readProjectionPath: 'runtime vote/dashboard projections',
    uiConsumers: ['Dashboard', 'Votes'],
    writePaths: ['Bootstrap/seed'],
  }),
  Vote: canonicalEntry('Vote', {
    canonicalStructure: 'Vote(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/vote.ts',
    readProjectionPath: 'runtime vote projections',
    uiConsumers: ['Votes'],
    writePaths: ['Bootstrap/seed'],
  }),
  Attestation: canonicalEntry('Attestation', {
    canonicalStructure: 'Attestation(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/attestation.ts',
    readProjectionPath: 'attestation service + query services',
    uiConsumers: ['Trust', 'Roles', 'Discussions'],
    writePaths: ['Mutation corridor', 'Attestation service helper'],
  }),
  Decision: canonicalEntry('Decision', {
    canonicalStructure: 'Decision(subtype)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/decision.ts',
    readProjectionPath: 'runtime vote/dashboard projections',
    uiConsumers: ['Dashboard', 'Votes'],
    writePaths: ['Bootstrap/seed'],
  }),
  Action: canonicalEntry('Action', {
    canonicalStructure: 'Action(subtype, hierarchy/default refs)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/action.ts',
    readProjectionPath: 'core/projections/forward-ontology.ts',
    writePaths: ['Forward packet builders', 'OWA initiative/default seed anchor'],
    nextStep:
      'Use Action(subtype: initiative) as the OWA default anchor for reseed policy/template/default packet sets.',
  }),
  Policy: canonicalEntry('Policy', {
    canonicalStructure: 'Policy(subtype, requirement domains)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/policy.ts',
    readProjectionPath: 'auth/write-policy helpers',
    uiConsumers: ['Identity security', 'Trust policy resolution'],
    writePaths: ['Mutation corridor', 'Seed defaults'],
    compatibilityStance: 'current_only',
  }),
  Preference: canonicalEntry('Preference', {
    canonicalStructure: 'Preference(subtype: element)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/definitions/preference-helpers.ts',
    readProjectionPath:
      'runtime/nexus/server/element-preference-packets.ts + guest compatibility cache fallback',
    uiConsumers: ['Shell preferences', 'Scope display preferences'],
    writePaths: ['Signed Preference.element mutation corridor'],
    readModelStatus: 'production',
    nextStep:
      'Keep Preference.element as the canonical claimed interface preference exemplar for reseed.',
  }),
  Discussion: canonicalEntry('Discussion', {
    canonicalStructure: 'Discussion(subtype: space/forum/post/message/topic)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/discussion.ts',
    readProjectionPath: 'runtime discussion projections',
    uiConsumers: ['Discussions', 'Library labels', 'Attestation packet targets'],
    writePaths: ['Mutation corridor', 'Default discussion surface bootstrap'],
    readModelStatus: 'tested',
    nextStep:
      'Keep top-level posts and reply messages canonical while UI projection names remain adapter-facing.',
  }),
  Bundle: canonicalEntry('Bundle', {
    canonicalStructure: 'Bundle(subtype: packet_set inventory)',
    builderPath:
      'core/packets/packet-build-pipeline.ts + core/packets/types/bundle.ts',
    readProjectionPath:
      'core/packets/packet-definition-seeds.ts canonical bundle/profile audit',
    writePaths: [
      'Bootstrap definition profile seed material',
      'Import/export bundle validation',
    ],
    assumptions: [
      'Bundle packets carry packet inventories and do not move packet semantics away from the packets they reference.',
    ],
    readModelStatus: 'tested',
    nextStep:
      'Use Bundle.packet_set as the active definition-profile carrier for reseed verification.',
  }),
};

export function listPacketPipelineInventory(): PacketPipelineInventoryEntry[] {
  return PACKET_TYPES.map((type) => PACKET_PIPELINE_INVENTORY[type]);
}
