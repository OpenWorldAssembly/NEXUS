/**
 * File: pipeline-inventory.ts
 * Description: Explicit packet-family inventory for staged builder, adapter, and read-model rollout tracking.
 */

import { PACKET_FAMILIES, type PacketFamily } from '@core/schema/packet-schema';

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
  family: PacketFamily;
  canonical_structure: string;
  builder_path: string;
  compatibility_stance: PacketPipelineCompatibilityStance;
  read_projection_path: string;
  ui_consumers: string[];
  write_paths: string[];
  known_manual_assumptions: string[];
  builder_pipeline_status: PipelineStatus;
  same_family_adapter_status: PipelineStatus;
  family_evolution_status: PipelineStatus;
  read_model_status: PipelineStatus;
  next_migration_step: string;
}

function createEntry(
  family: PacketFamily,
  input: Omit<PacketPipelineInventoryEntry, 'family'>
): PacketPipelineInventoryEntry {
  return {
    family,
    ...input,
  };
}

function createReservedEntry(
  family: PacketFamily,
  assumption: string
): PacketPipelineInventoryEntry {
  return createEntry(family, {
    canonical_structure: family,
    builder_path: 'none',
    compatibility_stance: 'current_only',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    known_manual_assumptions: [assumption],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'declared',
    family_evolution_status: 'none',
    read_model_status: 'none',
    next_migration_step: 'No active migration planned until the family becomes a live Nexus surface.',
  });
}

export const PACKET_PIPELINE_INVENTORY: Record<
  PacketFamily,
  PacketPipelineInventoryEntry
> = {
  Element: createEntry('Element', {
    canonical_structure: 'Element(type, subtype, legacy kind)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/element.ts',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/schema/packet-schema.ts same-family adapters + runtime identity/query services',
    ui_consumers: ['Shell', 'Trust', 'Roles', 'Library', 'Dashboard'],
    write_paths: ['Identity bootstrap', 'Locality creation', 'Mutation corridor'],
    known_manual_assumptions: [
      'Identity/locality semantics still depend on family-specific revision helpers layered on top of the generic builder.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'production',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Keep Element as the identity proof family while later runtime read models converge.',
  }),
  Location: createEntry('Location', {
    canonical_structure: 'Location(type, subtype)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/location.ts',
    compatibility_stance: 'current_only',
    read_projection_path:
      'core/projections/forward-ontology.ts + future runtime scope/location read helpers',
    ui_consumers: [],
    write_paths: ['Forward packet builders only'],
    known_manual_assumptions: [
      'Location is a new forward family and is not yet surfaced directly in Nexus UI.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Use Location as the portable spatial definition family before broader locality/runtime consumer migration.',
  }),
  Role: createEntry('Role', {
    canonical_structure: 'Role',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/role.ts',
    compatibility_stance: 'current_only',
    read_projection_path: 'runtime role projections',
    ui_consumers: ['Roles'],
    write_paths: ['Bootstrap and role query projections only'],
    known_manual_assumptions: ['Role surfaces still assume one current schema.'],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'none',
    next_migration_step: 'Keep current-only compatibility unless older signed role packets become a live migration concern.',
  }),
  Claim: createEntry('Claim', {
    canonical_structure: 'Claim(claim_kind, relation assertion)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/claim.ts',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/schema/packet-schema.ts same-family adapters + trust/claim helpers',
    ui_consumers: ['Trust', 'Roles', 'Locality'],
    write_paths: ['Mutation corridor', 'Trust surface helpers'],
    known_manual_assumptions: [
      'Claim-kind semantics still resolve through family-specific helpers in core/runtime.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'production',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Keep Claim as the scoped-association proof family while downstream runtime surfaces mature.',
  }),
  Relation: createEntry('Relation', {
    canonical_structure: 'Relation(type, subtype)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/relation.ts',
    compatibility_stance: 'current_only',
    read_projection_path:
      'core/projections/forward-ontology.ts + runtime/nexus/server/claim-utils.ts',
    ui_consumers: [],
    write_paths: ['Forward packet builders only'],
    known_manual_assumptions: [
      'Relation is the forward connective family, while Claim remains the current assertional layer.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Route new relation-aware read models through Relation while keeping Claim interoperable during migration.',
  }),
  Report: createEntry('Report', {
    canonical_structure: 'Report(type, subtype)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/report.ts',
    compatibility_stance: 'current_only',
    read_projection_path:
      'runtime verification/import reporting projections + Explorer verification surfaces',
    ui_consumers: ['Explorer', 'Dashboard', 'Packet action menus'],
    write_paths: ['Runtime verification service', 'Runtime import reporting'],
    known_manual_assumptions: [
      'Report is the forward verification/import reporting family while MissionReport remains a legacy mission-specific family.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Use Report for verification and import reporting before broader decision/resolution reporting semantics land.',
  }),
  Signal: createReservedEntry('Signal', 'Family reserved but not actively surfaced.'),
  Proposal: createEntry('Proposal', {
    canonical_structure: 'Proposal',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/proposal.ts',
    compatibility_stance: 'current_only',
    read_projection_path: 'runtime vote/dashboard projections',
    ui_consumers: ['Dashboard', 'Votes'],
    write_paths: ['Bootstrap/seed'],
    known_manual_assumptions: ['Proposal lifecycle remains provisional.'],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'none',
    next_migration_step: 'Keep current-only compatibility until proposal versioning becomes a live migration concern.',
  }),
  Vote: createEntry('Vote', {
    canonical_structure: 'Vote',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/vote.ts',
    compatibility_stance: 'current_only',
    read_projection_path: 'runtime vote projections',
    ui_consumers: ['Votes'],
    write_paths: ['Bootstrap/seed'],
    known_manual_assumptions: [
      'Formal Vote packets are not the main discussion attestation path yet.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'none',
    next_migration_step: 'Keep current-only compatibility until formal vote versioning becomes a live migration concern.',
  }),
  Attestation: createEntry('Attestation', {
    canonical_structure: 'Attestation(kind)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/attestation.ts',
    compatibility_stance: 'current_only',
    read_projection_path: 'attestation service + query services',
    ui_consumers: ['Trust', 'Roles', 'Discussions'],
    write_paths: ['Mutation corridor', 'Attestation service helper'],
    known_manual_assumptions: [
      'Attestation mutation planning still uses family-specific helpers and runtime projections.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Keep Attestation stable as the shared packet-signal family while vote surfaces expand.',
  }),
  Decision: createEntry('Decision', {
    canonical_structure: 'Decision',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/decision.ts',
    compatibility_stance: 'current_only',
    read_projection_path: 'runtime vote/dashboard projections',
    ui_consumers: ['Dashboard', 'Votes'],
    write_paths: ['Bootstrap/seed'],
    known_manual_assumptions: [
      'Decision packets are schema-shaped infrastructure only until governance workflows become interactive.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'none',
    next_migration_step: 'Keep current-only compatibility until formal governance workflows require versioned Decision packets.',
  }),
  Cause: createEntry('Cause', {
    canonical_structure: 'Cause(type, subtype)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/cause.ts',
    compatibility_stance: 'current_only',
    read_projection_path: 'core/projections/forward-ontology.ts',
    ui_consumers: [],
    write_paths: ['Forward packet builders only'],
    known_manual_assumptions: [
      'Cause is the forward purpose/alignment family; legacy initiative-family packets remain readable separately.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Use Cause as the forward home for initiative/campaign/program semantics before UI/workflow rollout.',
  }),
  Action: createEntry('Action', {
    canonical_structure: 'Action(type, subtype)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/action.ts',
    compatibility_stance: 'current_only',
    read_projection_path: 'core/projections/forward-ontology.ts',
    ui_consumers: [],
    write_paths: ['Forward packet builders only'],
    known_manual_assumptions: [
      'Action is the forward execution family; legacy mission-family packets remain readable separately.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'none',
    read_model_status: 'declared',
    next_migration_step: 'Use Action as the forward home for mission/task/event semantics before workflow rollout.',
  }),
  Initiative: createEntry('Initiative', {
    canonical_structure: 'Legacy initiative packet',
    builder_path: 'none',
    compatibility_stance: 'forward_only',
    read_projection_path: 'core/projections/forward-ontology.ts cause projection bridge',
    ui_consumers: [],
    write_paths: ['Legacy read compatibility only'],
    known_manual_assumptions: ['Legacy family retained as migration input while Cause becomes the forward vocabulary.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'declared',
    family_evolution_status: 'declared',
    read_model_status: 'declared',
    next_migration_step: 'Project legacy Initiative packets into Cause(subtype: initiative) reads and avoid new forward writes here.',
  }),
  Program: createEntry('Program', {
    canonical_structure: 'Legacy program packet',
    builder_path: 'none',
    compatibility_stance: 'forward_only',
    read_projection_path: 'core/projections/forward-ontology.ts cause projection bridge',
    ui_consumers: [],
    write_paths: ['Legacy read compatibility only'],
    known_manual_assumptions: ['Legacy family retained as migration input while Cause becomes the forward vocabulary.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'declared',
    family_evolution_status: 'declared',
    read_model_status: 'declared',
    next_migration_step: 'Project legacy Program packets into Cause(subtype: program) reads and avoid new forward writes here.',
  }),
  Campaign: createEntry('Campaign', {
    canonical_structure: 'Legacy campaign packet',
    builder_path: 'none',
    compatibility_stance: 'forward_only',
    read_projection_path: 'core/projections/forward-ontology.ts cause projection bridge',
    ui_consumers: [],
    write_paths: ['Legacy read compatibility only'],
    known_manual_assumptions: ['Legacy family retained as migration input while Cause becomes the forward vocabulary.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'declared',
    family_evolution_status: 'declared',
    read_model_status: 'declared',
    next_migration_step: 'Project legacy Campaign packets into Cause(subtype: campaign) reads and avoid new forward writes here.',
  }),
  MissionTemplate: createReservedEntry(
    'MissionTemplate',
    'Legacy mission-family packet retained as migration input while Action becomes the forward vocabulary.'
  ),
  MissionPlan: createReservedEntry(
    'MissionPlan',
    'Legacy mission-family packet retained as migration input while Action becomes the forward vocabulary.'
  ),
  MissionReport: createReservedEntry(
    'MissionReport',
    'Legacy mission-family packet retained as migration input while Action becomes the forward vocabulary.'
  ),
  Module: createReservedEntry('Module', 'Family reserved but not actively surfaced.'),
  Policy: createEntry('Policy', {
    canonical_structure: 'Policy(kind, requirement domains)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/policy.ts',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/schema/packet-schema.ts same-family adapters + auth/write-policy helpers',
    ui_consumers: ['Identity security', 'Trust policy resolution'],
    write_paths: ['Mutation corridor'],
    known_manual_assumptions: [
      'Policy semantics still resolve through specialized write-policy helpers.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'production',
    family_evolution_status: 'none',
    read_model_status: 'partial',
    next_migration_step: 'Keep as the small proof family for the generic builder while read models mature.',
  }),
  Discussion: createEntry('Discussion', {
    canonical_structure: 'Discussion(kind, role)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/discussion.ts',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/packets/packet-interpreter.ts + core/packets/discussion-compat.ts',
    ui_consumers: ['Discussions', 'Library labels', 'Attestation packet targets'],
    write_paths: ['Mutation corridor', 'Default discussion surface bootstrap'],
    known_manual_assumptions: [
      'Legacy discussion projections still bridge current API/UI payloads during migration.',
    ],
    builder_pipeline_status: 'production',
    same_family_adapter_status: 'production',
    family_evolution_status: 'production',
    read_model_status: 'tested',
    next_migration_step: 'Finish migrating runtime discussion projections onto the generic read-model contract.',
  }),
  DiscussionSpace: createEntry('DiscussionSpace', {
    canonical_structure: 'Legacy discussion space',
    builder_path: 'core/packets/builders.ts#createDiscussionSpacePacket',
    compatibility_stance: 'legacy_supported',
    read_projection_path: 'discussion compatibility family-evolution bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read compatibility', 'Seed fixtures'],
    known_manual_assumptions: ['Legacy family retained for back-compat only.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'production',
    read_model_status: 'tested',
    next_migration_step: 'Keep readable while canonical Discussion becomes the only normal write target.',
  }),
  DiscussionForum: createEntry('DiscussionForum', {
    canonical_structure: 'Legacy discussion forum',
    builder_path: 'core/packets/builders.ts#createDiscussionForumPacket',
    compatibility_stance: 'legacy_supported',
    read_projection_path: 'discussion compatibility family-evolution bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read compatibility', 'Seed fixtures'],
    known_manual_assumptions: ['Legacy family retained for back-compat only.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'production',
    read_model_status: 'tested',
    next_migration_step: 'Keep readable while canonical Discussion becomes the only normal write target.',
  }),
  DiscussionThread: createEntry('DiscussionThread', {
    canonical_structure: 'Legacy discussion thread',
    builder_path: 'core/packets/builders.ts#createDiscussionThreadPacket',
    compatibility_stance: 'legacy_supported',
    read_projection_path: 'discussion compatibility family-evolution bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read compatibility', 'Seed fixtures'],
    known_manual_assumptions: ['Legacy family retained for back-compat only.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'production',
    read_model_status: 'tested',
    next_migration_step: 'Keep readable while canonical Discussion becomes the only normal write target.',
  }),
  DiscussionPost: createEntry('DiscussionPost', {
    canonical_structure: 'Legacy discussion post',
    builder_path: 'core/packets/builders.ts#createDiscussionPostPacket',
    compatibility_stance: 'legacy_supported',
    read_projection_path: 'discussion compatibility family-evolution bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read compatibility', 'Seed fixtures'],
    known_manual_assumptions: ['Legacy family retained for back-compat only.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'production',
    read_model_status: 'tested',
    next_migration_step: 'Keep readable while canonical Discussion becomes the only normal write target.',
  }),
  DiscussionReply: createEntry('DiscussionReply', {
    canonical_structure: 'Legacy discussion reply',
    builder_path: 'core/packets/builders.ts#createDiscussionReplyPacket',
    compatibility_stance: 'legacy_supported',
    read_projection_path: 'discussion compatibility family-evolution bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read compatibility', 'Seed fixtures'],
    known_manual_assumptions: ['Legacy family retained for back-compat only.'],
    builder_pipeline_status: 'none',
    same_family_adapter_status: 'tested',
    family_evolution_status: 'production',
    read_model_status: 'tested',
    next_migration_step: 'Keep readable while canonical Discussion becomes the only normal write target.',
  }),
  Minutes: createReservedEntry('Minutes', 'Family reserved but not actively surfaced.'),
  Artifact: createReservedEntry('Artifact', 'Family reserved but not actively surfaced.'),
};

export function listPacketPipelineInventory(): PacketPipelineInventoryEntry[] {
  return PACKET_FAMILIES.map((family) => PACKET_PIPELINE_INVENTORY[family]);
}
