/**
 * File: trusted_dispatch_coordinator.ts
 * Description: Canonical dispatch-facing bridge over trusted request intake and enrolled write lifecycles.
 */

import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { MutationActionId } from '@core/auth/write-policy';
import { resolveDiscussionScopePacketId } from '@core/packets/discussion.ts';
import { parsePacketEnvelope, type PacketEnvelope, type PacketEnvelopeByType } from '@core/schema/packet-schema';
import { trustedArchiveCoordinator } from '@runtime/trusted_coordinators/trusted_archive_coordinator/index.ts';
import { trustedBuildingCoordinator } from '@runtime/trusted_coordinators/trusted_building_coordinator/index.ts';
import { trustedCertificationCoordinator } from '@runtime/trusted_coordinators/trusted_certification_coordinator/index.ts';
import { trustedInspectionCoordinator } from '@runtime/trusted_coordinators/trusted_inspection_coordinator/index.ts';
import { trustedPlanningCoordinator } from '@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts';
import { trustedVerificationCoordinator } from '@runtime/trusted_coordinators/trusted_verification_coordinator/index.ts';
import { SQLiteReactionService } from '@runtime/nexus/server/reaction/reaction-service.ts';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
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

function mutationKindFromPlanId(planId: string | null): string {
  if (!planId) {
    return 'unknown';
  }

  const workflowMutationKind = planId.replace(/\.workflow\.v\d+$/, '');
  if (workflowMutationKind !== planId) {
    return workflowMutationKind;
  }

  const trustedReactionPlan = /^trusted\.operation_plan\.Reaction\.reaction\.reaction\.(set|clear)$/.exec(planId);
  if (trustedReactionPlan) {
    return 'reaction.vote.set';
  }

  const trustedOperationPlan = /^trusted\.operation_plan\.Relation\.([^.]+)\.relation\.([^.]+)$/.exec(planId);
  if (trustedOperationPlan) {
    const [, subtype, action] = trustedOperationPlan;

    if (action === 'set') {
      return `relation.${subtype}.add`;
    }

    if (action === 'clear') {
      return `relation.${subtype}.clear`;
    }
  }

  return 'unknown';
}

function packetRevisionKey(input: {
  packet_id?: string | null;
  revision_id?: string | null;
}): string | null {
  return input.packet_id && input.revision_id
    ? `${input.packet_id}:${input.revision_id}`
    : null;
}

function sortedUniqueKeys(values: readonly (string | null | undefined)[]): string[] {
  return Array.from(new Set(values.filter((value): value is string => Boolean(value))))
    .sort((left, right) => left.localeCompare(right));
}

function diffKeys(left: readonly string[], right: readonly string[]): string[] {
  const rightSet = new Set(right);
  return left.filter((value) => !rightSet.has(value));
}

function verificationPacketKeys(report: {
  packet_results: readonly {
    packet_ref: { packet_id: string } | null;
    revision_ref: { revision_id: string } | null;
    overall_status: string;
  }[];
}): string[] {
  return sortedUniqueKeys(
    report.packet_results
      .filter((result) => result.overall_status === 'passed' || result.overall_status === 'warning')
      .map((result) => packetRevisionKey({
        packet_id: result.packet_ref?.packet_id,
        revision_id: result.revision_ref?.revision_id,
      }))
  );
}

function archiveWriteKeys(receipt: {
  writes: readonly {
    packet_ref: { packet_id: string };
    revision_ref: { revision_id: string };
  }[];
}): string[] {
  return sortedUniqueKeys(
    receipt.writes.map((write) => packetRevisionKey({
      packet_id: write.packet_ref.packet_id,
      revision_id: write.revision_ref.revision_id,
    }))
  );
}

function planningHintsForMutationIntent(intent: MutationIntent): {
  packet_type?: string;
  packet_subtype?: string;
  operation_kind?: string;
  workflow_plan_id?: string;
  action_ids?: string[];
} {
  if (intent.kind === 'relation.follow.add') {
    return {
      packet_type: 'Relation',
      packet_subtype: 'follow',
      operation_kind: 'relation.set',
      workflow_plan_id: 'relation.follow.add.workflow.v0',
      action_ids: ['relation.follow.add'],
    };
  }

  if (intent.kind === 'relation.association.add') {
    return {
      packet_type: 'Relation',
      packet_subtype: 'association',
      operation_kind: 'relation.set',
      workflow_plan_id: 'relation.association.add.workflow.v0',
      action_ids: ['relation.association.add'],
    };
  }

  if (intent.kind === 'reaction.vote.set') {
    const isClear = intent.value === null;

    return {
      packet_type: 'Reaction',
      packet_subtype: 'reaction',
      operation_kind: isClear ? 'reaction.clear' : 'reaction.set',
      workflow_plan_id: 'reaction.vote.set.workflow.v0',
      action_ids: [isClear ? 'reaction.vote.clear' : 'reaction.vote.set'],
    };
  }

  return {};
}

function bodyInputValuesForMutationIntent(input: {
  intent: PrepareTrustedDispatchMutationWriteInput['intent'];
  actor_packet: PrepareTrustedDispatchMutationWriteInput['actor_packet'];
}): Record<string, unknown> {
  if (input.intent.kind === 'relation.follow.add') {
    return {
      subtype: 'follow',
      subject_ref: { packet_id: input.actor_packet.header.packet_id },
      target_ref: { packet_id: input.intent.target_scope_packet_id },
      scope_ref: { packet_id: input.intent.scope_id },
      status: 'active',
      policy_ref: null,
      terms_ref: null,
      supporting_refs: [],
      note: null,
      effective_from: null,
      effective_until: null,
      subscription_options: null,
    };
  }

  if (input.intent.kind === 'relation.association.add') {
    return {
      subtype: 'association',
      subject_ref: { packet_id: input.actor_packet.header.packet_id },
      target_ref: { packet_id: input.intent.target_packet_id },
      scope_ref: { packet_id: input.intent.scope_id },
      status: 'active',
      policy_ref: null,
      terms_ref: null,
      supporting_refs: [],
      note: input.intent.note ?? null,
      effective_from: null,
      effective_until: null,
      subscription_options: null,
    };
  }

  if (input.intent.kind === 'reaction.vote.set') {
    const scopePacketId = resolveDiscussionScopePacketId(input.intent.scope_id);
    const isClear = input.intent.value === null;

    return {
      __trusted_header_values: {
        authority_scope_ref: { packet_id: scopePacketId },
        applicable_scope_refs: [{ packet_id: scopePacketId }],
        created_at: input.intent.created_at ?? null,
      },
      subtype: 'reaction',
      target_ref: { packet_id: input.intent.target_packet_id },
      status: isClear ? 'cleared' : 'active',
      vote_value: input.intent.value,
      attestation_value: null,
      emoji_keys: [],
      context_ref: null,
      supporting_refs: [],
      note: null,
      supersedes_ref: null,
    };
  }

  return input.intent as unknown as Record<string, unknown>;
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

function dispatchProcessChainFromChildren(input: {
  operation_name: string;
  request_id?: string | null;
  operation_id?: string | null;
  child_results: readonly TrustedRuntimeCoordinatorResult<unknown>[];
}) {
  let processChain = createTrustedProcessChain({
    coordinator_id: TRUSTED_DISPATCH_COORDINATOR_ID,
    coordinator_kind: 'dispatch',
    operation_name: input.operation_name,
    completion_policy: 'atomic_required',
    request_id: input.request_id ?? null,
    operation_id: input.operation_id ?? null,
  });

  for (const [index, result] of input.child_results.entries()) {
    processChain = appendTrustedChildResult(processChain, result, {
      stage_id: `dispatch.${input.operation_name}.child.${index}`,
      operation_name: result.trace.at(-1)?.step_id ?? result.coordinator_id,
      notes: `Dispatch write pipeline child result from ${result.coordinator_id}.`,
    });
  }

  return completeTrustedProcessChain(processChain);
}

function nodeSQLitePacketStoreFrom(packetStore: FinalizeTrustedDispatchMutationWriteInput['packet_store']): NodeSQLitePacketStore | null {
  return packetStore && typeof (packetStore as { databasePath?: unknown }).databasePath === 'string'
    ? (packetStore as NodeSQLitePacketStore)
    : null;
}

function firstReactionPacketFromCandidates(
  packets: readonly PacketEnvelope[]
): PacketEnvelopeByType['Reaction'] | null {
  const reactionPacket = packets.find(
    (packet): packet is PacketEnvelopeByType['Reaction'] => packet.header.type === 'Reaction'
  );

  return reactionPacket ?? null;
}

async function buildReactionVoteFinalizeResult(input: {
  packet_store: FinalizeTrustedDispatchMutationWriteInput['packet_store'];
  actor_packet: PacketEnvelopeByType['Element'];
  archive_receipt: unknown;
  verification_report: unknown;
  candidate_packets: readonly PacketEnvelope[];
}) {
  const reactionPacket = firstReactionPacketFromCandidates(input.candidate_packets);
  if (!reactionPacket) {
    return {
      archive_receipt: input.archive_receipt,
      verification_report: input.verification_report,
    };
  }

  const packetStore = nodeSQLitePacketStoreFrom(input.packet_store);
  if (!packetStore) {
    return {
      archive_receipt: input.archive_receipt,
      verification_report: input.verification_report,
      target_packet_id: reactionPacket.body.target_ref.packet_id,
      value: reactionPacket.body.status === 'active' ? reactionPacket.body.vote_value : null,
    };
  }

  const reactionService = new SQLiteReactionService(packetStore);
  await reactionService.syncDerivedState();
  const summary = await reactionService.getTargetSummary({
    target_packet_id: reactionPacket.body.target_ref.packet_id,
    viewer_actor_key: `element:${input.actor_packet.header.packet_id}`,
  });

  return {
    archive_receipt: input.archive_receipt,
    verification_report: input.verification_report,
    target_packet_id: reactionPacket.body.target_ref.packet_id,
    value: reactionPacket.body.status === 'active' ? reactionPacket.body.vote_value : null,
    summary,
  };
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

    const planningHints = planningHintsForMutationIntent(input.intent);
    const plan = trustedPlanningCoordinator.resolveOperationPlan({
      ...planningHints,
      operation_kind: planningHints.operation_kind as never,
      mutation_intent: input.intent.kind,
      body_input_values: bodyInputValuesForMutationIntent({
        intent: input.intent,
        actor_packet: input.actor_packet,
      }),
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
      actor_packet: input.actor_packet,
      packet_store: input.packet_store,
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

    const candidatePackets = packetCandidatesFromBuildResult(build.value);
    const preparedPackets = await Promise.all(
      candidatePackets.map(async (packet) => {
        const digests = await getPacketUnsignedDigestCandidates(packet);

        return {
          packet,
          unsigned_digest: digests[0]?.digest ?? '',
        };
      })
    );

    if (candidatePackets.length === 0) {
      return blockedDispatchResult({
        operation_name: 'prepare_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.prepare.certification',
        issue_message:
          'Dispatch cannot return a live prepare payload until Building emits full signable packet envelopes for Certification.',
        request_id: request.value.request_id,
        operation_id: plan.value.plan_id,
        child_results: [request, preflight, plan, build, inspection],
      });
    }

    const certification = trustedCertificationCoordinator.prepareCertificationTicket({
      plan: plan.value,
      build_result: build.value,
      inspection_report: inspection.value,
      actor_packet_id: input.actor_packet.header.packet_id,
      request_id: request.value.request_id,
      operation_id: plan.value.plan_id,
      expected_packets: preparedPackets.map((preparedPacket) => ({
        packet_id: preparedPacket.packet.header.packet_id,
        revision_id: preparedPacket.packet.header.revision_id,
        packet_type: preparedPacket.packet.header.type,
        unsigned_digest: preparedPacket.unsigned_digest,
      })),
    });

    if (certification.status === 'error' || certification.status === 'blocked' || !certification.value) {
      return blockedDispatchResult({
        operation_name: 'prepare_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.prepare.certification',
        issue_message:
          certification.issues[0]?.message ??
          'Certification could not open a ticket for the prepared packet envelopes.',
        request_id: request.value.request_id,
        operation_id: plan.value.plan_id,
        child_results: [request, preflight, plan, build, inspection, certification],
      });
    }
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
      process_chain: dispatchProcessChainFromChildren({
        operation_name: 'prepare_enrolled_mutation_write',
        request_id: request.value.request_id,
        operation_id: plan.value.plan_id,
        child_results: [request, preflight, plan, build, inspection, certification],
      }),
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

    const rawSignedPackets = input.request.signed_packets;
    const certification = trustedCertificationCoordinator.certifySignedPacketBundle({
      ticket_id: input.request.ticket_id,
      signed_packets: rawSignedPackets,
      signer_packet: input.actor_packet,
    });

    if (certification.status === 'error' || certification.status === 'blocked' || !certification.value) {
      return blockedDispatchResult({
        operation_name: 'finalize_enrolled_mutation_write',
        issue_code: 'dispatch.certification_payload_unsupported',
        issue_path: 'dispatch.finalize.certification',
        issue_message:
          certification.issues[0]?.message ??
          'Certification rejected the signed packet bundle for this ticket.',
        request_id: request.value.request_id,
        operation_id: input.request.ticket_id,
        child_results: [request, certification],
      });
    }

    const verification = await trustedVerificationCoordinator.verifyPacketBatch({
      packets: rawSignedPackets.map((packet, index) => ({
        entry_id: `signed_packets.${index}`,
        raw_packet: packet,
        signer_packet: input.actor_packet,
      })),
      signer_packets: [input.actor_packet],
      verification_mode: 'strict',
    });

    if (verification.status === 'error' || verification.status === 'blocked' || !verification.value) {
      return blockedDispatchResult({
        operation_name: 'finalize_enrolled_mutation_write',
        issue_code: 'dispatch.certification_payload_unsupported',
        issue_path: 'dispatch.finalize.verification',
        issue_message:
          verification.issues[0]?.message ??
          'Verification rejected the signed packet bundle for this ticket.',
        request_id: request.value.request_id,
        operation_id: input.request.ticket_id,
        child_results: [request, certification, verification],
      });
    }

    const certifiedPacketKeys = sortedUniqueKeys(certification.value.certified_packet_keys);
    const verifiedPacketKeys = verificationPacketKeys(verification.value);
    const missingFromVerification = diffKeys(certifiedPacketKeys, verifiedPacketKeys);
    const unexpectedVerificationKeys = diffKeys(verifiedPacketKeys, certifiedPacketKeys);

    if (missingFromVerification.length > 0 || unexpectedVerificationKeys.length > 0) {
      return blockedDispatchResult({
        operation_name: 'finalize_enrolled_mutation_write',
        issue_code: 'dispatch.verified_certified_packet_mismatch',
        issue_path: 'dispatch.finalize.verification',
        issue_message: `Verification packet keys did not match Certification packet keys. Missing from Verification: ${missingFromVerification.join(', ') || 'none'}; unexpected from Verification: ${unexpectedVerificationKeys.join(', ') || 'none'}.`,
        request_id: request.value.request_id,
        operation_id: input.request.ticket_id,
        child_results: [request, certification, verification],
      });
    }

    const certifiedMutationKind = mutationKindFromPlanId(certification.value.source_plan_id);

    if (
      input.mutation_intent &&
      certifiedMutationKind !== 'unknown' &&
      input.mutation_intent !== certifiedMutationKind
    ) {
      return blockedDispatchResult({
        operation_name: 'finalize_enrolled_mutation_write',
        issue_code: 'dispatch.mutation_intent_mismatch',
        issue_path: 'dispatch.finalize.mutation_intent',
        issue_message: `Finalize mutation intent ${input.mutation_intent} does not match certification plan ${certifiedMutationKind}.`,
        request_id: request.value.request_id,
        operation_id: input.request.ticket_id,
        child_results: [request, certification, verification],
      });
    }

    const archive = await trustedArchiveCoordinator.storeCertifiedPacketSet({
      packet_store: input.packet_store,
      certified_packet_set: certification.value,
    });

    if (archive.status === 'error' || archive.status === 'blocked' || !archive.value) {
      return blockedDispatchResult({
        operation_name: 'finalize_enrolled_mutation_write',
        issue_code: 'dispatch.write_pipeline_not_ready',
        issue_path: 'dispatch.finalize.archive',
        issue_message:
          archive.issues[0]?.message ??
          'Archive could not store the certified packet set.',
        request_id: request.value.request_id,
        operation_id: input.request.ticket_id,
        child_results: [request, certification, verification, archive],
      });
    }

    const archivedPacketKeys = archiveWriteKeys(archive.value);
    const missingFromArchive = diffKeys(certifiedPacketKeys, archivedPacketKeys);
    const unexpectedArchiveKeys = diffKeys(archivedPacketKeys, certifiedPacketKeys);

    if (missingFromArchive.length > 0 || unexpectedArchiveKeys.length > 0) {
      return blockedDispatchResult({
        operation_name: 'finalize_enrolled_mutation_write',
        issue_code: 'dispatch.archive_certified_packet_mismatch',
        issue_path: 'dispatch.finalize.archive',
        issue_message: `Archive write keys did not match Certification packet keys. Missing from Archive: ${missingFromArchive.join(', ') || 'none'}; unexpected from Archive: ${unexpectedArchiveKeys.join(', ') || 'none'}.`,
        request_id: request.value.request_id,
        operation_id: input.request.ticket_id,
        child_results: [request, certification, verification, archive],
      });
    }

    const finalizedCandidatePackets = packetCandidatesFromBuildResult(certification.value);
    const mutationResult = certifiedMutationKind === 'reaction.vote.set'
      ? await buildReactionVoteFinalizeResult({
          packet_store: input.packet_store,
          actor_packet: input.actor_packet,
          archive_receipt: archive.value,
          verification_report: verification.value,
          candidate_packets: finalizedCandidatePackets,
        })
      : {
          archive_receipt: archive.value,
          verification_report: verification.value,
        };

    return createTrustedRuntimeCoordinatorResult({
      coordinator_id: TRUSTED_DISPATCH_COORDINATOR_ID,
      coordinator_kind: 'dispatch',
      value: {
        kind: certifiedMutationKind as TrustedDispatchFinalizedMutationResult['kind'],
        persist_effects: archive.value.writes.map((write) => ({
          packet: {
            packet_id: write.packet_ref.packet_id,
            revision_id: write.revision_ref.revision_id,
          },
        })),
        result: mutationResult,
      },
      trace: [
        ...request.trace,
        ...certification.trace,
        ...verification.trace,
        ...archive.trace,
      ],
      request_id: request.value.request_id,
      operation_id: input.request.ticket_id,
      process_chain: dispatchProcessChainFromChildren({
        operation_name: 'finalize_enrolled_mutation_write',
        request_id: request.value.request_id,
        operation_id: input.request.ticket_id,
        child_results: [request, certification, verification, archive],
      }),
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
