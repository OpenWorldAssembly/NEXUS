/**
 * File: build_candidate_graph.ts
 * Description: Recursively builds a packet candidate graph from a trusted operation plan tree.
 */

import {
  createTrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorIssue,
  type TrustedRuntimeCoordinatorResult,
  type TrustedRuntimeCoordinatorTraceEntry,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  buildingTrace,
  uniqueSorted,
} from '../trusted_building_internal.ts';
import {
  TRUSTED_BUILDING_COORDINATOR_ID,
  type BuildTrustedCandidateGraphInput,
  type TrustedPacketCandidateGraph,
  type TrustedPacketCandidateNode,
} from '../trusted_building_types.ts';
import { buildTrustedPacketBodyCandidate } from './build_packet_body_candidate.ts';

function collectCandidateGraph(input: {
  plan: BuildTrustedCandidateGraphInput['plan'];
  parentCandidateId?: string | null;
  nodes: TrustedPacketCandidateNode[];
  issues: TrustedRuntimeCoordinatorIssue[];
  trace: TrustedRuntimeCoordinatorTraceEntry[];
}): TrustedPacketCandidateNode | null {
  const nodeResult = buildTrustedPacketBodyCandidate({
    plan: input.plan,
    parent_candidate_id: input.parentCandidateId ?? null,
  });
  input.issues.push(...nodeResult.issues);
  input.trace.push(...nodeResult.trace);

  if (!nodeResult.value) {
    return null;
  }

  const node = nodeResult.value;
  input.nodes.push(node);

  for (const childPlan of input.plan.child_packet_plans?.child_plans ?? []) {
    const childNode = collectCandidateGraph({
      plan: childPlan,
      parentCandidateId: node.candidate_id,
      nodes: input.nodes,
      issues: input.issues,
      trace: input.trace,
    });

    if (childNode) {
      node.child_candidate_ids.push(childNode.candidate_id);
    }
  }

  return node;
}

export function buildTrustedCandidateGraph(
  input: BuildTrustedCandidateGraphInput
): TrustedRuntimeCoordinatorResult<TrustedPacketCandidateGraph> {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const traceEntries: TrustedRuntimeCoordinatorTraceEntry[] = [];
  const nodes: TrustedPacketCandidateNode[] = [];
  const rootNode = collectCandidateGraph({
    plan: input.plan,
    parentCandidateId: null,
    nodes,
    issues,
    trace: traceEntries,
  });
  const blockers = uniqueSorted(nodes.flatMap((node) => node.blockers));
  const warnings = uniqueSorted(nodes.flatMap((node) => node.warnings));
  const bodyCandidateCount = nodes.filter((node) => Boolean(node.body_candidate)).length;
  const blockedCandidateCount = nodes.filter((node) => node.blockers.length > 0).length;

  traceEntries.push(buildingTrace({
    step_id: 'building.candidate_graph.build',
    status: blockedCandidateCount > 0 || issues.some((issue) => issue.severity === 'error')
      ? 'blocked'
      : warnings.length > 0
        ? 'partial'
        : 'ok',
    preset_ids: ['trusted.candidate_graph.v0'],
    notes: `Built candidate graph with ${nodes.length} node(s) and ${bodyCandidateCount} body candidate(s).`,
  }));

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_BUILDING_COORDINATOR_ID,
    coordinator_kind: 'building',
    value: {
      graph_kind: 'trusted.packet_candidate_graph',
      source_plan_id: input.plan.plan_id,
      root_candidate_id: rootNode?.candidate_id ?? null,
      candidate_nodes: nodes,
      body_candidate_count: bodyCandidateCount,
      blocked_candidate_count: blockedCandidateCount,
      blockers,
      warnings,
    },
    issues,
    trace: traceEntries,
  });
}
