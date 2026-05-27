/**
 * File: trusted_inspection_types.ts
 * Description: Local contracts for trusted inspection of build results against frozen operation plan snapshots.
 */

import type { PacketTypeDefinition } from '@core/packets/definitions/packet-definition-types.ts';
import type {
  TrustedBuildResult,
  TrustedPacketCandidateGraph,
  TrustedPacketCandidateNode,
} from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import type {
  TrustedOperationPlan,
  TrustedPlanningContextMode,
} from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import type {
  TrustedDefinitionRuntimePreference,
} from '@runtime/trusted_coordinators/trusted_definition_coordinator/index.ts';
import type {
  TrustedRuntimeCoordinatorIssue,
  TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';

export const TRUSTED_INSPECTION_COORDINATOR_ID = 'trusted_inspection_coordinator.v0' as const;

export type TrustedInspectionContextMode = TrustedPlanningContextMode;

export type TrustedPacketBodyInspection = {
  inspection_kind: 'trusted.packet_body_inspection';
  candidate_id: string;
  source_plan_id: string | null;
  packet_type: string | null;
  packet_subtype: string | null;
  builder_id: string | null;
  schema_valid: boolean;
  planned_values_valid: boolean;
  valid: boolean;
  schema_error_count: number;
  planned_value_mismatch_paths: string[];
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedPlanAlignmentInspection = {
  inspection_kind: 'trusted.plan_alignment_inspection';
  source_plan_id: string | null;
  build_result_plan_id: string | null;
  valid: boolean;
  planned_node_count: number;
  candidate_node_count: number;
  missing_plan_node_ids: string[];
  unplanned_candidate_ids: string[];
  child_alignment_issue_count: number;
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedCandidateGraphInspection = {
  inspection_kind: 'trusted.candidate_graph_inspection';
  source_plan_id: string | null;
  valid: boolean;
  root_candidate_id: string | null;
  candidate_count: number;
  body_candidate_count: number;
  blocked_candidate_count: number;
  body_inspections: TrustedPacketBodyInspection[];
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedInspectionReport = {
  report_kind: 'trusted.inspection_report';
  source_plan_id: string | null;
  source_build_result_plan_id: string | null;
  inspected_candidate_count: number;
  valid_candidate_count: number;
  invalid_candidate_count: number;
  graph_alignment: TrustedCandidateGraphInspection | null;
  plan_alignment: TrustedPlanAlignmentInspection | null;
  body_schema_inspections: TrustedPacketBodyInspection[];
  blockers: string[];
  warnings: string[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
};

export type TrustedInspectionReadinessReport = {
  report_kind: 'trusted.inspection_readiness_report';
  mode: TrustedInspectionContextMode;
  ready: boolean;
  checked_plan_count: number;
  inspected_build_count: number;
  inspected_candidate_count: number;
  valid_candidate_count: number;
  invalid_candidate_count: number;
  blocking_issue_count: number;
  warning_count: number;
  reports: TrustedInspectionReport[];
};

export type InspectTrustedBuildResultInput = {
  plan: TrustedOperationPlan;
  build_result: TrustedBuildResult;
  context_mode?: TrustedInspectionContextMode;
};

export type InspectTrustedCandidateGraphInput = {
  plan: TrustedOperationPlan;
  candidate_graph: TrustedPacketCandidateGraph;
  context_mode?: TrustedInspectionContextMode;
};

export type InspectTrustedPacketBodyCandidateInput = {
  candidate_node: TrustedPacketCandidateNode;
  plan_node?: TrustedOperationPlan | null;
  context_mode?: TrustedInspectionContextMode;
};

export type InspectTrustedPlanAlignmentInput = {
  plan: TrustedOperationPlan;
  build_result: TrustedBuildResult;
  context_mode?: TrustedInspectionContextMode;
};

export type AuditTrustedInspectionReadinessInput = {
  context_mode?: TrustedInspectionContextMode;
  node_element_id?: string | null;
  packet_type_filters?: readonly string[];
  definitions?: readonly PacketTypeDefinition[];
  preferences?: readonly TrustedDefinitionRuntimePreference[];
};

export type TrustedInspectionOperation =
  | 'inspect_build_result'
  | 'inspect_candidate_graph'
  | 'inspect_packet_body_candidate'
  | 'inspect_plan_alignment'
  | 'audit_readiness';

export type TrustedInspectionCoordinatorRequest =
  | {
      operation: 'inspect_build_result';
      input: InspectTrustedBuildResultInput;
    }
  | {
      operation: 'inspect_candidate_graph';
      input: InspectTrustedCandidateGraphInput;
    }
  | {
      operation: 'inspect_packet_body_candidate';
      input: InspectTrustedPacketBodyCandidateInput;
    }
  | {
      operation: 'inspect_plan_alignment';
      input: InspectTrustedPlanAlignmentInput;
    }
  | {
      operation: 'audit_readiness';
      input?: AuditTrustedInspectionReadinessInput;
    };
