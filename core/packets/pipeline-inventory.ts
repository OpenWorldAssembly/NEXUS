/**
 * File: pipeline-inventory.ts
 * Description: Explicit packet-family inventory for builder/interpreter pipeline rollout tracking.
 */

import {
  PACKET_FAMILIES,
  type PacketFamily,
} from '@core/schema/packet-schema';

export type PacketPipelineCompatibilityStance =
  | 'current_only'
  | 'legacy_supported'
  | 'forward_only'
  | 'bidirectional_supported';

export interface PacketPipelineInventoryEntry {
  family: PacketFamily;
  canonical_structure: string;
  builder_path: string;
  compatibility_stance: PacketPipelineCompatibilityStance;
  read_projection_path: string;
  ui_consumers: string[];
  write_paths: string[];
  manual_assumptions: string[];
  generic_builder_pipeline: boolean;
  unified_interpreter_pipeline: boolean;
}

function createCurrentOnlyEntry(
  family: PacketFamily,
  input: Omit<PacketPipelineInventoryEntry, 'family' | 'compatibility_stance'>
): PacketPipelineInventoryEntry {
  return {
    family,
    compatibility_stance: 'current_only',
    ...input,
  };
}

export const PACKET_PIPELINE_INVENTORY: Record<
  PacketFamily,
  PacketPipelineInventoryEntry
> = {
  Element: {
    family: 'Element',
    canonical_structure: 'Element(kind)',
    builder_path: 'core/packets/builders.ts#createElementPacket',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/schema/packet-schema.ts same-family adapters + runtime query services',
    ui_consumers: ['Shell', 'Trust', 'Roles', 'Library', 'Dashboard'],
    write_paths: ['Identity bootstrap', 'Locality creation', 'Mutation corridor'],
    manual_assumptions: ['Identity/locality semantics still include family-specific helpers.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  },
  Role: createCurrentOnlyEntry('Role', {
    canonical_structure: 'Role',
    builder_path: 'core/packets/builders.ts#createRolePacket',
    read_projection_path: 'runtime role projections',
    ui_consumers: ['Roles'],
    write_paths: ['Bootstrap and role query projections only'],
    manual_assumptions: ['Role surfaces still assume current-only schema.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Claim: {
    family: 'Claim',
    canonical_structure: 'Claim(kind)',
    builder_path: 'core/packets/builders.ts#createClaimPacket',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/schema/packet-schema.ts same-family adapters + trust/claim helpers',
    ui_consumers: ['Trust', 'Roles', 'Locality'],
    write_paths: ['Mutation corridor', 'Trust surface helpers'],
    manual_assumptions: ['Claim-kind policy resolution still lives in core/runtime helpers.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  },
  Signal: createCurrentOnlyEntry('Signal', {
    canonical_structure: 'Signal',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Proposal: createCurrentOnlyEntry('Proposal', {
    canonical_structure: 'Proposal',
    builder_path: 'core/packets/builders.ts#createProposalPacket',
    read_projection_path: 'runtime vote/dashboard projections',
    ui_consumers: ['Dashboard', 'Votes'],
    write_paths: ['Bootstrap/seed'],
    manual_assumptions: ['Proposal lifecycle remains provisional.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Vote: createCurrentOnlyEntry('Vote', {
    canonical_structure: 'Vote',
    builder_path: 'core/packets/builders.ts#createVotePacket',
    read_projection_path: 'runtime vote projections',
    ui_consumers: ['Votes'],
    write_paths: ['Bootstrap/seed'],
    manual_assumptions: ['Formal vote packet flows are not the main attestation path yet.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Attestation: createCurrentOnlyEntry('Attestation', {
    canonical_structure: 'Attestation(kind)',
    builder_path: 'core/packets/builders.ts#createAttestationPacket',
    read_projection_path: 'attestation service + query services',
    ui_consumers: ['Trust', 'Roles', 'Discussions'],
    write_paths: ['Mutation corridor', 'Attestation service helper'],
    manual_assumptions: ['Attestation mutation planning still uses family-specific helpers.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Decision: createCurrentOnlyEntry('Decision', {
    canonical_structure: 'Decision',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Initiative: createCurrentOnlyEntry('Initiative', {
    canonical_structure: 'Initiative',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Program: createCurrentOnlyEntry('Program', {
    canonical_structure: 'Program',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Campaign: createCurrentOnlyEntry('Campaign', {
    canonical_structure: 'Campaign',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  MissionTemplate: createCurrentOnlyEntry('MissionTemplate', {
    canonical_structure: 'MissionTemplate',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Mission family is not part of active Nexus flows yet.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  MissionPlan: createCurrentOnlyEntry('MissionPlan', {
    canonical_structure: 'MissionPlan',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Mission family is not part of active Nexus flows yet.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  MissionReport: createCurrentOnlyEntry('MissionReport', {
    canonical_structure: 'MissionReport',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Mission family is not part of active Nexus flows yet.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Module: createCurrentOnlyEntry('Module', {
    canonical_structure: 'Module',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Policy: {
    family: 'Policy',
    canonical_structure: 'Policy(kind)',
    builder_path: 'core/packets/packet-build-pipeline.ts + core/packets/families/policy.ts',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/schema/packet-schema.ts same-family adapters + auth/write-policy helpers',
    ui_consumers: ['Identity security', 'Trust policy resolution'],
    write_paths: ['Mutation corridor'],
    manual_assumptions: ['Policy semantics still resolve through core write-policy helpers.'],
    generic_builder_pipeline: true,
    unified_interpreter_pipeline: true,
  },
  Discussion: {
    family: 'Discussion',
    canonical_structure: 'Discussion(kind, role)',
    builder_path:
      'core/packets/packet-build-pipeline.ts + core/packets/families/discussion.ts',
    compatibility_stance: 'bidirectional_supported',
    read_projection_path:
      'core/packets/packet-interpreter.ts + core/packets/discussion-compat.ts',
    ui_consumers: ['Discussions', 'Library labels', 'Attestation packet targets'],
    write_paths: ['Mutation corridor', 'Default discussion surface bootstrap'],
    manual_assumptions: ['Legacy discussion family projections still bridge current UI payloads.'],
    generic_builder_pipeline: true,
    unified_interpreter_pipeline: true,
  },
  DiscussionSpace: createCurrentOnlyEntry('DiscussionSpace', {
    canonical_structure: 'Legacy discussion space',
    builder_path: 'core/packets/builders.ts#createDiscussionSpacePacket',
    read_projection_path: 'discussion compatibility legacy bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read-only compatibility', 'Seed fixtures'],
    manual_assumptions: ['Legacy family retained for back-compat views only.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  DiscussionForum: createCurrentOnlyEntry('DiscussionForum', {
    canonical_structure: 'Legacy discussion forum',
    builder_path: 'core/packets/builders.ts#createDiscussionForumPacket',
    read_projection_path: 'discussion compatibility legacy bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read-only compatibility', 'Seed fixtures'],
    manual_assumptions: ['Legacy family retained for back-compat views only.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  DiscussionThread: createCurrentOnlyEntry('DiscussionThread', {
    canonical_structure: 'Legacy discussion thread',
    builder_path: 'core/packets/builders.ts#createDiscussionThreadPacket',
    read_projection_path: 'discussion compatibility legacy bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read-only compatibility', 'Seed fixtures'],
    manual_assumptions: ['Legacy family retained for back-compat views only.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  DiscussionPost: createCurrentOnlyEntry('DiscussionPost', {
    canonical_structure: 'Legacy discussion post',
    builder_path: 'core/packets/builders.ts#createDiscussionPostPacket',
    read_projection_path: 'discussion compatibility legacy bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read-only compatibility', 'Seed fixtures'],
    manual_assumptions: ['Legacy family retained for back-compat views only.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  DiscussionReply: createCurrentOnlyEntry('DiscussionReply', {
    canonical_structure: 'Legacy discussion reply',
    builder_path: 'core/packets/builders.ts#createDiscussionReplyPacket',
    read_projection_path: 'discussion compatibility legacy bridge',
    ui_consumers: ['Discussions via legacy projection bridge'],
    write_paths: ['Legacy read-only compatibility', 'Seed fixtures'],
    manual_assumptions: ['Legacy family retained for back-compat views only.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Minutes: createCurrentOnlyEntry('Minutes', {
    canonical_structure: 'Minutes',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
  Artifact: createCurrentOnlyEntry('Artifact', {
    canonical_structure: 'Artifact',
    builder_path: 'none',
    read_projection_path: 'none',
    ui_consumers: [],
    write_paths: [],
    manual_assumptions: ['Family reserved but not actively surfaced.'],
    generic_builder_pipeline: false,
    unified_interpreter_pipeline: true,
  }),
};

export function listPacketPipelineInventory(): PacketPipelineInventoryEntry[] {
  return PACKET_FAMILIES.map((family) => PACKET_PIPELINE_INVENTORY[family]);
}
