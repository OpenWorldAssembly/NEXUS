/**
 * File: trusted_dispatch_coordinator.ts
 * Description: Canonical dispatch-facing bridge over trusted request intake and enrolled write lifecycles.
 */

import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import type { MutationActionId } from '@core/auth/write-policy';
import { parsePacketEnvelope, type PacketEnvelope } from '@core/schema/packet-schema';
import { trustedBuildingCoordinator } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import { trustedCertificationCoordinator } from '@runtime/trusted_coordinators/trusted_certification_coordinator/index.ts';
import { trustedInspectionCoordinator } from '@runtime/trusted_coordinators/trusted_inspection_coordinator/index.ts';
import { trustedPlanningCoordinator } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import {
  appendTrustedChildResult,
  completeTrustedProcessChain,
  createTrustedProcessChain,
} from '@runtime/trusted_coordinators/trusted_process';
import type { TrustedRuntimeCoordinatorResult } from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  createTrustedRuntimeCoordinatorResult,
  trustedIssue,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import { trustedRequestCoordinator } from '@runtime/trusted_coordinators/trusted_request_coordinator/trusted_request_coordinator.ts';
import type {
  AuditTrustedRequestReadinessInput,
  ListTrustedRequestEnrollmentsInput,
  NormalizeTrustedRequestInput,
  PreflightTrustedClientIntentInput,
  TrustedRequestEnrollmentList,
  TrustedRequestPreflight,
  TrustedRequestReadinessReport,
  TrustedRuntimeRequest,
} from '@runtime/trusted_coordinators/trusted_request_coordinator/trusted_request_types.ts';
import type {
  FinalizeTrustedDispatchMutationWriteInput,
  PrepareTrustedDispatchMutationWriteInput,
  TrustedDispatchFinalizedMutationResult,
  TrustedDispatchPreparedMutationResult,
} from './trusted_dispatch_types.ts';

const TRUSTED_DISPATCH_COORDINATOR_ID = 'trusted_dispatch_coordinator.v0';

function asDispatchResult<TValue>(
  result: TrustedRuntimeCoordinatorResult<TValue>
): TrustedRuntimeCoordinatorResult<TValue> {
  return {
    ...result,
    coordinator_id: 'trusted_dispatch_coordinator.v0',
    coordinator_kind: 'dispatch',
    trace: [
      ...result.trace,
      {
        step_id: 'dispatch.compat_request_bridge',
        coordinator_id: 'trusted_dispatch_coordinator.v0',
        preset_ids: [],
        status: result.status,
        notes:
          'Trusted Dispatch Coordinator is the canonical runtime front desk; current implementation delegates to the compatibility Trusted Request Coordinator.',
      },
    ],
  };
}

function packetCandidatesFromBuildResult(
  buildResult: { candidate_graph: { candidate_nodes: readonly unknown[] } }
): PacketEnvelope[] {
  const packets: PacketEnvelope[] = [];

  for (const candidateNode of buildResult.candidate_graph.candidate_nodes) {
    const candidate = candidateNode as Record<string, unknown>;
    const bodyCandidate = candidate.body_candidate as Record<string, unknown> | null;
    const possiblePackets = [
      candidate.packet,
      candidate.envelope,
      candidate.packet_envelope,
      bodyCandidate?.packet,
      bodyCandidate?.envelope,
      bodyCandidate?.packet_envelope,
      bodyCandidate?.body && typeof bodyCandidate.body === 'object'
        ? (bodyCandidate.body as Record<string, unknown>).packet
        : null,
      bodyCandidate?.body && typeof bodyCandidate.body === 'object'
        ? (bodyCandidate.body as Record<string, unknown>).packet_envelope
        : null,
    ].filter((value) => value !== null && value !== undefined);

    for (const possiblePacket of possiblePackets) {
      try {
        packets.push(parsePacketEnvelope(possiblePacket));
        break;
      } catch {
        // Keep looking for an archive-ready packet envelope on this candidate.
      }
    }
  }

  return packets;
}

function blockedDispatchResult<TValue>(input: {
  operation_name: string;
  issue_code: string;
  issue_path: string;
  issue_message: string;
  request_id?: string | null;
  operation_id?: string | null;
  child_results?: readonly TrustedRuntimeCoordinatorResult<unknown>[];
}): TrustedRuntimeCoordinatorResult<TValue> {
  const issue = trustedIssue({
    severity: 'error',
    code: input.issue_code,
    path: input.issue_path,
    message: input.issue_message,
  });
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_DISPATCH_COORDINATOR_ID,
    coordinator_kind: 'dispatch',
    operation_name: input.operation_name,
    completion_policy: 'atomic_required',
    request_id: input.request_id ?? null,
    operation_id: input.operation_id ?? null,
  });

  for (const [index, result] of (input.child_results ?? []).entries()) {
    processChain = appendTrustedChildResult(processChain, result, {
      stage_id: `dispatch.${input.operation_name}.child.${index}`,
      operation_name: result.trace.at(-1)?.step_id ?? result.coordinator_id,
      notes: `Dispatch write pipeline child result from ${result.coordinator_id}.`,
    });
  }

  return createTrustedRuntimeCoordinatorResult({
    coordinator_id: TRUSTED_DISPATCH_COORDINATOR_ID,
    coordinator_kind: 'dispatch',
    status: 'blocked',
    value: null,
    issues: [issue],
    trace: [
      {
        step_id: `dispatch.${input.operation_name}.blocked`,
        coordinator_id: TRUSTED_DISPATCH_COORDINATOR_ID,
        preset_ids: ['trusted.dispatch.write_pipeline.v0'],
        status: 'blocked',
        notes: input.issue_message,
      },
    ],
    request_id: input.request_id ?? null,
    operation_id: input.operation_id ?? null,
    process_chain: completeTrustedProcessChain(processChain, { status: 'blocked' }),
  });
}

export const trustedDispatchCoordinator = {
  id: TRUSTED_DISPATCH_COORDINATOR_ID,

  normalizeRequest(
    input: NormalizeTrustedRequestInput
  ): TrustedRuntimeCoordinatorResult<TrustedRuntimeRequest> {
    return asDispatchResult(trustedRequestCoordinator.normalizeRequest(input));
  },

  preflightClientIntent(
    input: PreflightTrustedClientIntentInput
  ): TrustedRuntimeCoordinatorResult<TrustedRequestPreflight> {
    return asDispatchResult(trustedRequestCoordinator.preflightClientIntent(input));
  },

  async prepareEnrolledMutationWrite(
    input: PrepareTrustedDispatchMutationWriteInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedDispatchPreparedMutationResult>> {
    const request = this.normalizeRequest({
      source_kind: 'api_route',
      source_route: input.source_route,
      operation_kind: 'mutation_prepare',
      request_id: input.request_id ?? null,
      client_intent_id: input.client_intent_id ?? input.intent.kind,
      mutation_intent: input.intent.kind,
      actor_packet_id: input.actor_packet.header.packet_id,
      payload: {
        dispatch_write_pipeline: 'prepare',
      },
    });
    if (request.status === 'error' || !request.value) {
      return blockedDispatchResult({
        operation_name: 'prepare_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.prepare.normalize',
        issue_message: request.issues[0]?.message ?? 'Dispatch could not normalize the mutation prepare request.',
        request_id: input.request_id ?? null,
        operation_id: input.intent.kind,
        child_results: [request],
      });
    }

    const preflight = this.preflightClientIntent({
      sourceRoute: input.source_route,
      requestId: request.value.request_id,
      clientIntentId: input.client_intent_id ?? input.intent.kind,
      mutationIntent: input.intent.kind,
    });
    if (preflight.status === 'error' || !preflight.value) {
      return blockedDispatchResult({
        operation_name: 'prepare_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.prepare.preflight',
        issue_message: preflight.issues[0]?.message ?? 'Dispatch preflight blocked the mutation prepare request.',
        request_id: request.value.request_id,
        operation_id: input.intent.kind,
        child_results: [request, preflight],
      });
    }

    const plan = trustedPlanningCoordinator.resolveOperationPlan({
      mutation_intent: input.intent.kind,
      body_input_values: input.intent as unknown as Record<string, unknown>,
      include_defaults: true,
      include_dependencies: true,
      include_regulation: true,
      include_write_policy_gate: true,
    });
    if (plan.status === 'error' || plan.status === 'blocked' || !plan.value) {
      return blockedDispatchResult({
        operation_name: 'prepare_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.prepare.planning',
        issue_message: plan.issues[0]?.message ?? 'Planning could not resolve an enrolled mutation write plan.',
        request_id: request.value.request_id,
        operation_id: input.intent.kind,
        child_results: [request, preflight, plan],
      });
    }

    const build = trustedBuildingCoordinator.buildFromOperationPlan({
      plan: plan.value,
    });
    const inspection = build.value
      ? trustedInspectionCoordinator.inspectBuildResult({
          plan: plan.value,
          build_result: build.value,
        })
      : null;

    if (
      build.status === 'error' ||
      build.status === 'blocked' ||
      !build.value ||
      !inspection ||
      inspection.status === 'error' ||
      inspection.status === 'blocked' ||
      !inspection.value
    ) {
      return blockedDispatchResult({
        operation_name: 'prepare_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.prepare.build_or_inspection',
        issue_message: 'Building or Inspection could not produce an inspectable mutation candidate graph.',
        request_id: request.value.request_id,
        operation_id: plan.value.plan_id,
        child_results: [request, preflight, plan, build, ...(inspection ? [inspection] : [])],
      });
    }

    const certification = trustedCertificationCoordinator.prepareCertificationTicket({
      plan: plan.value,
      build_result: build.value,
      inspection_report: inspection.value,
      actor_packet_id: input.actor_packet.header.packet_id,
      request_id: request.value.request_id,
      operation_id: plan.value.plan_id,
    });
    const candidatePackets = packetCandidatesFromBuildResult(build.value);

    if (
      certification.status === 'error' ||
      certification.status === 'blocked' ||
      !certification.value ||
      candidatePackets.length === 0
    ) {
      return blockedDispatchResult({
        operation_name: 'prepare_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.prepare.certification',
        issue_message:
          certification.issues[0]?.message ??
          'Dispatch cannot return a live prepare payload until Building emits full signable packet envelopes for Certification.',
        request_id: request.value.request_id,
        operation_id: plan.value.plan_id,
        child_results: [request, preflight, plan, build, inspection, certification],
      });
    }

    const preparedPackets = await Promise.all(
      candidatePackets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );
    const policyDecision = plan.value.write_policy_gate?.decision;

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DISPATCH_COORDINATOR_ID,
      coordinator_kind: 'dispatch',
      value: {
        ticket: {
          ticket_id: certification.value.ticket.ticket_id,
          actor_packet_id: input.actor_packet.header.packet_id,
          kind: input.intent.kind,
          expires_at: certification.value.ticket.expires_at,
        },
        prepared_mutation: {
          kind: input.intent.kind,
          action_ids: (policyDecision?.action_ids ?? plan.value.action_ids) as MutationActionId[],
          required_proof_level: policyDecision?.required_proof_level ?? 'session',
          accepted_proof_methods: policyDecision?.accepted_proof_methods ?? ['claimed_session'],
          source_policy_packet_ids: policyDecision?.source_policy_packet_ids ?? [],
          governing_scope_packet_id:
            plan.value.write_policy_gate?.governing_scope_packet_id ?? null,
          prepared_packets: preparedPackets,
        },
      },
      trace: [
        ...request.trace,
        ...preflight.trace,
        ...plan.trace,
        ...build.trace,
        ...inspection.trace,
        ...certification.trace,
      ],
      request_id: request.value.request_id,
      operation_id: plan.value.plan_id,
    });
  },

  async finalizeEnrolledMutationWrite(
    input: FinalizeTrustedDispatchMutationWriteInput
  ): Promise<TrustedRuntimeCoordinatorResult<TrustedDispatchFinalizedMutationResult>> {
    const request = this.normalizeRequest({
      source_kind: 'api_route',
      source_route: input.source_route,
      operation_kind: 'mutation_finalize',
      request_id: input.request_id ?? null,
      client_intent_id: input.client_intent_id ?? input.mutation_intent ?? null,
      mutation_intent: input.mutation_intent ?? null,
      actor_packet_id: input.actor_packet.header.packet_id,
      payload: {
        ticket_id: input.request.ticket_id,
        dispatch_write_pipeline: 'finalize',
      },
    });

    if (request.status === 'error' || !request.value) {
      return blockedDispatchResult({
        operation_name: 'finalize_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.finalize.normalize',
        issue_message: request.issues[0]?.message ?? 'Dispatch could not normalize the mutation finalize request.',
        request_id: input.request_id ?? null,
        operation_id: input.request.ticket_id,
        child_results: [request],
      });
    }

    return blockedDispatchResult({
      operation_name: 'finalize_enrolled_mutation_write',
      issue_code: 'dispatch.certification_payload_unsupported',
      issue_path: 'dispatch.finalize.signed_return',
      issue_message:
        'Dispatch finalize now requires Certification signed-ticket return support for the existing signed packet bundle payload; legacy mutation tickets and finalizers are not allowed as fallback.',
      request_id: request.value.request_id,
      operation_id: input.request.ticket_id,
      child_results: [request],
    });
  },

  listEnrollments(
    input: ListTrustedRequestEnrollmentsInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedRequestEnrollmentList> {
    return asDispatchResult(trustedRequestCoordinator.listEnrollments(input));
  },

  auditReadiness(
    input: AuditTrustedRequestReadinessInput = {}
  ): TrustedRuntimeCoordinatorResult<TrustedRequestReadinessReport> {
    return asDispatchResult(trustedRequestCoordinator.auditReadiness(input));
  },
};
