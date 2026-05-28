/**
 * File: trusted_building_types.ts
 * Description: Local contracts for trusted packet candidate construction from trusted operation plans.
 */

import type {
  PacketDefinitionPartDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketStore } from '@core/contracts';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import type {
  PacketTypeBodyBuilderInput,
  PacketTypeBodyCandidate,
} from '@core/packets/packet-type-body-builders.ts';
import type { TrustedOperationPlan } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import type {
  TrustedDefinitionContextMode,
  TrustedDefinitionRuntimePreference,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_BUILDING_COORDINATOR_ID = 'trusted_building_coordinator.v0' as const;

export type TrustedBuildingContextMode = TrustedDefinitionContextMode;

export type TrustedGenericBodyCandidate = {
  candidate_kind: 'trusted.generic_body_candidate';
  builder_id: string | null;
  packet_type: string;
  packet_subtype: string | null;
  schema_version: string | null;
  storage_class: PacketTypeDefinition['storage_class'] | null;
  revision_behavior: PacketTypeDefinition['revision_behavior'] | null;
  body: Record<string, unknown>;
  source_plan_id: string | null;
  materialization_status: 'candidate' | 'partial' | 'blocked';
  notes: string[];
};

export type TrustedBodyCandidate = PacketTypeBodyCandidate | TrustedGenericBodyCandidate;

export type TrustedPacketCandidateNode = {
  candidate_id: string;
  candidate_kind: 'trusted.packet_candidate_node';
  source_plan_id: string | null;
  packet_type: string | null;
  packet_subtype: string | null;
  builder_id: string | null;
  body_candidate: TrustedBodyCandidate | null;
  packet_envelope?: PacketEnvelope | null;
  parent_candidate_id: string | null;
  child_candidate_ids: string[];
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedPacketCandidateGraph = {
  graph_kind: 'trusted.packet_candidate_graph';
  source_plan_id: string | null;
  root_candidate_id: string | null;
  candidate_nodes: TrustedPacketCandidateNode[];
  body_candidate_count: number;
  blocked_candidate_count: number;
  warnings: string[];
  blockers: string[];
};

export type TrustedBuildResult = {
  result_kind: 'trusted.build_result';
  source_plan_id: string | null;
  root_candidate: TrustedPacketCandidateNode | null;
  candidate_graph: TrustedPacketCandidateGraph;
  body_candidates: TrustedBodyCandidate[];
  blockers: string[];
  warnings: string[];
};

export type TrustedDefinitionPartBuildPlan = {
  plan_kind: 'trusted.definition_part_build_plan';
  packet_type: string;
  definition_version: string;
  part_count: number;
  part_ids: string[];
  candidates: PacketTypeBodyCandidate[];
};

export type ResolveTrustedBuildFromOperationPlanInput = {
  plan: TrustedOperationPlan;
  actor_packet?: PacketEnvelopeByType['Element'] | null;
  packet_store?: PacketStore | null;
  context_mode?: TrustedBuildingContextMode;
};

export type BuildTrustedPacketBodyCandidateInput = {
  plan: TrustedOperationPlan;
  actor_packet?: PacketEnvelopeByType['Element'] | null;
  packet_store?: PacketStore | null;
  parent_candidate_id?: string | null;
};

export type BuildTrustedPacketTypeBodyCandidateInput = {
  input: PacketTypeBodyBuilderInput;
};

export type BuildTrustedDefinitionPartCandidatesInput = {
  definition: PacketTypeDefinition;
  parts?: readonly PacketDefinitionPartDescriptor[];
};

export type BuildTrustedCandidateGraphInput = {
  plan: TrustedOperationPlan;
  actor_packet?: PacketEnvelopeByType['Element'] | null;
  packet_store?: PacketStore | null;
};

export type AuditTrustedBuildingReadinessInput = {
  context_mode?: TrustedBuildingContextMode;
  node_element_id?: string | null;
  packet_type_filters?: readonly string[];
  definitions?: readonly PacketTypeDefinition[];
  preferences?: readonly TrustedDefinitionRuntimePreference[];
};

export type TrustedBuildingReadinessReport = {
  report_kind: 'trusted.building_readiness_report';
  mode: TrustedBuildingContextMode;
  ready: boolean;
  checked_plan_count: number;
  built_graph_count: number;
  body_candidate_count: number;
  blocking_issue_count: number;
  warning_count: number;
  build_results: TrustedBuildResult[];
};

export type TrustedBuildingOperation =
  | 'build_from_operation_plan'
  | 'build_packet_body_candidate'
  | 'build_packet_type_body_candidate'
  | 'build_definition_part_candidates'
  | 'build_candidate_graph'
  | 'audit_readiness';

export type TrustedBuildingCoordinatorRequest =
  | {
      operation: 'build_from_operation_plan';
      input: ResolveTrustedBuildFromOperationPlanInput;
    }
  | {
      operation: 'build_packet_body_candidate';
      input: BuildTrustedPacketBodyCandidateInput;
    }
  | {
      operation: 'build_packet_type_body_candidate';
      input: BuildTrustedPacketTypeBodyCandidateInput;
    }
  | {
      operation: 'build_definition_part_candidates';
      input: BuildTrustedDefinitionPartCandidatesInput;
    }
  | {
      operation: 'build_candidate_graph';
      input: BuildTrustedCandidateGraphInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedBuildingReadinessInput;
    };
