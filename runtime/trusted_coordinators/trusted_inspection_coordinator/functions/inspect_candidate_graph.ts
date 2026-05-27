/**
 * File: inspect_candidate_graph.ts
 * Description: Inspects a candidate graph against its frozen operation plan tree without re-planning.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  indexPlanTree,
  inspectionIssue,
  inspectionTrace,
  uniqueSorted,
} from '../trusted_inspection_internal.ts';
import {
  TRUSTED_INSPECTION_COORDINATOR_ID,
  type InspectTrustedCandidateGraphInput,
  type TrustedCandidateGraphInspection,
  type TrustedPacketBodyInspection,
} from '../trusted_inspection_types.ts';
import { inspectTrustedPacketBodyCandidate } from './inspect_packet_body_candidate.ts';

export function inspectTrustedCandidateGraph(
  input: InspectTrustedCandidateGraphInput
): TrustedRuntimeCoordinatorResult<TrustedCandidateGraphInspection> {
  const graph = input.candidate_graph;
  const planIndex = indexPlanTree(input.plan);
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const blockers = [...graph.blockers];
  const warnings = [...graph.warnings];
  const bodyInspections: TrustedPacketBodyInspection[] = [];

  if (graph.source_plan_id !== input.plan.plan_id) {
    blockers.push('Candidate graph source plan ID does not match the inspected plan.');
    issues.push(inspectionIssue({
      severity: 'error',
      code: 'candidate_graph_source_plan_mismatch',
      path: 'candidate_graph.source_plan_id',
      message: `Candidate graph source plan ${graph.source_plan_id ?? 'null'} does not match plan ${input.plan.plan_id}.`,
    }));
  }

  if (graph.root_candidate_id && !graph.candidate_nodes.some((node) => node.candidate_id === graph.root_candidate_id)) {
    blockers.push('Candidate graph root candidate ID does not resolve to a candidate node.');
    issues.push(inspectionIssue({
      severity: 'error',
      code: 'candidate_graph_root_missing',
      path: 'candidate_graph.root_candidate_id',
      message: `Root candidate ${graph.root_candidate_id} is not present in the candidate graph.`,
    }));
  }

  for (const candidateNode of graph.candidate_nodes) {
    const planNode = candidateNode.source_plan_id ? planIndex.get(candidateNode.source_plan_id) ?? null : null;
    const bodyInspection = inspectTrustedPacketBodyCandidate({
      candidate_node: candidateNode,
      plan_node: planNode,
      context_mode: input.context_mode,
    });

    issues.push(...bodyInspection.issues);
    traceEntries.push(...bodyInspection.trace);
    if (bodyInspection.value) {
      bodyInspections.push(bodyInspection.value);
      blockers.push(...bodyInspection.value.blockers);
      warnings.push(...bodyInspection.value.warnings);
    }
  }

  const valid = blockers.length === 0 && bodyInspections.every((inspection) => inspection.valid) && !issues.some((issue) => issue.severity === 'error');

  traceEntries.push(inspectionTrace({
    step_id: 'inspection.candidate_graph.inspect',
    status: valid ? 'ok' : blockers.length > 0 || issues.some((issue) => issue.severity === 'error') ? 'blocked' : 'partial',
    preset_ids: ['trusted.candidate_graph_inspection.v0'],
    notes: `Inspected candidate graph with ${graph.candidate_nodes.length} candidate node(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_INSPECTION_COORDINATOR_ID,
    coordinator_kind: 'inspection',
    value: {
      inspection_kind: 'trusted.candidate_graph_inspection',
      source_plan_id: graph.source_plan_id,
      valid,
      root_candidate_id: graph.root_candidate_id,
      candidate_count: graph.candidate_nodes.length,
      body_candidate_count: graph.body_candidate_count,
      blocked_candidate_count: graph.blocked_candidate_count,
      body_inspections: bodyInspections,
      blockers: uniqueSorted(blockers),
      warnings: uniqueSorted(warnings),
      issues,
      trace: traceEntries,
    },
    issues,
    trace: traceEntries,
    mode: input.context_mode,
  });
}
