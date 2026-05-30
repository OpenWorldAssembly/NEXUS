/**
 * File: packet-client-intent-enrollment.ts
 * Description: Interface-neutral client/API ingress allowlist and definition crossing-guard preflight.
 */

import { PACKET_RUNTIME_CONNECTORS } from "@runtime/nexus/server/packet-runtime-connectors";
import {
  listMutationIntentDescriptors,
  type MutationIntentDescriptor,
} from "@runtime/nexus/server/mutation-intent-registry";
import type { MutationIntent } from "@core/auth/mutation-corridor";
import {
  listPacketRuntimeFortressHandoffCoverage,
  resolvePacketRuntimeFortressHandoff,
  type PacketRuntimeFortressHandoff,
  type PacketRuntimeFortressHandoffStatus,
} from "@runtime/nexus/server/packet-runtime-fortress-handoff";
import { trustedRegulationCoordinator } from "@runtime/trusted_coordinators/trusted_regulation_coordinator/index.ts";
import { trustedPlanningCoordinator } from "@runtime/trusted_coordinators/trusted_planning_coordinator/index.ts";

export type PacketClientIntentEnrollmentMode =
  | "signed_dispatch_prepare"
  | "live_connector"
  | "runtime_ready";

export type PacketClientIntentEnrollment = {
  enrollment_id: string;
  source_route: string;
  client_intent_id: string;
  mutation_intent: MutationIntent["kind"];
  connector_id: string | null;
  packet_type: string | null;
  packet_subtype: string | null;
  operation_kinds: string[];
  workflow_plan_ids: string[];
  policy_action_ids: string[];
  dependencies_definition_ids: string[];
  live_mode: PacketClientIntentEnrollmentMode;
  handoff_status: PacketRuntimeFortressHandoffStatus | "connector_live";
  notes: string;
};

export type PacketClientIntentPreflight = {
  preflight_kind: "packet.client_intent.preflight";
  status: "allowed_definition" | "allowed_live_connector" | "blocked";
  enrollment: PacketClientIntentEnrollment | null;
  handoff: PacketRuntimeFortressHandoff | null;
  policy_requirement_ids: string[];
  dependency_requirement_ids: string[];
  reason_codes: string[];
  notes: string[];
};

export type PacketClientIntentEnrollmentAuditFinding = {
  severity: "error";
  code: string;
  enrollment_id: string;
  message: string;
};

export type PacketClientIntentEnrollmentAuditReport = {
  status: "pass" | "fail";
  checked_enrollment_ids: string[];
  findings: PacketClientIntentEnrollmentAuditFinding[];
};

const CLIENT_INTENT_BY_MUTATION_INTENT: Record<string, string> = {
  "locality.path.create": "locality.path.create",
  "locality.graph.apply": "locality.graph.apply",
  "discussion.thread_post.create": "discussion.thread_post.create",
  "discussion.reply.create": "discussion.reply.create",
  "discussion.surfaces.ensure": "discussion.surfaces.ensure",
  "reaction.vote.set": "reaction.vote.set",
  "assembly.element.create": "assembly.element.create",
  "relation.association.add": "scope.association.set",
  "relation.association.clear": "scope.association.clear",
  "relation.residence.add": "scope.home.set",
  "relation.follow.add": "scope.follow.set",
  "relation.follow.clear": "scope.follow.clear",
  "relation.participation.add": "relation.participation.add",
  "relation.participation.clear": "relation.participation.clear",
  "reaction.attestation.set": "reaction.attestation.set",
  "actor.write_policy.update": "actor.write_policy.update",
  "preference.element.set": "preference.interface.set",
};

function resolveTrustedPolicyRequirements() {
  return (
    trustedRegulationCoordinator.resolvePolicyContext({
      context_mode: "reseed",
      operation_kind: "debug_audit",
    }).value?.requirements ?? []
  );
}

function resolveTrustedDependencyRequirements() {
  return (
    trustedPlanningCoordinator.resolveDependencyPlan({
      context_mode: "reseed",
      operation_kind: "debug_audit",
    }).value?.requirements ?? []
  );
}

function auditTrustedRegulationReadiness() {
  return trustedRegulationCoordinator.auditReadiness({
    context_mode: "reseed",
    operation_kind: "debug_audit",
  }).value;
}

function auditTrustedPlanningReadiness() {
  return trustedPlanningCoordinator.auditReadiness({
    context_mode: "reseed",
    operation_kind: "debug_audit",
  }).value;
}

function uniqueSorted(values: readonly string[]): string[] {
  return Array.from(new Set(values)).sort((left, right) =>
    left.localeCompare(right),
  );
}

function createPrepareEnrollment(
  descriptor: MutationIntentDescriptor,
): PacketClientIntentEnrollment {
  const handoff = resolvePacketRuntimeFortressHandoff({
    mutationIntent: descriptor.kind,
  });

  return {
    enrollment_id: `client.prepare.${descriptor.kind}`,
    source_route: "/api/nexus/mutations/prepare",
    client_intent_id:
      CLIENT_INTENT_BY_MUTATION_INTENT[descriptor.kind] ??
      `${descriptor.domain}.${descriptor.kind}`,
    mutation_intent: descriptor.kind,
    connector_id: null,
    packet_type: handoff.workflow_plan_packet_types[0] ?? null,
    packet_subtype: null,
    operation_kinds: handoff.operation_kinds,
    workflow_plan_ids: handoff.workflow_plan_ids,
    policy_action_ids: handoff.policy_action_ids,
    dependencies_definition_ids: handoff.dependency_ids,
    live_mode: "signed_dispatch_prepare",
    handoff_status: handoff.status,
    notes:
      "Client/API ingress write intent. The registry is descriptive metadata for Dispatch-owned prepare/finalize routing.",
  };
}

export function listPacketClientIntentEnrollments(): PacketClientIntentEnrollment[] {
  return listMutationIntentDescriptors().map(createPrepareEnrollment);
}

export function getPacketClientIntentEnrollment(
  enrollmentId: string,
): PacketClientIntentEnrollment | null {
  return (
    listPacketClientIntentEnrollments().find(
      (enrollment) => enrollment.enrollment_id === enrollmentId,
    ) ?? null
  );
}

export function resolvePacketClientIntentPreflight(input: {
  sourceRoute: string;
  mutationIntent?: string | null;
  connectorId?: string | null;
  clientIntentId?: string | null;
}): PacketClientIntentPreflight {
  const enrollment =
    listPacketClientIntentEnrollments().find((candidate) => {
      if (candidate.source_route !== input.sourceRoute) {
        return false;
      }

      if (
        input.clientIntentId &&
        candidate.client_intent_id !== input.clientIntentId
      ) {
        return false;
      }

      if (input.connectorId && candidate.connector_id !== input.connectorId) {
        return false;
      }

      if (
        input.mutationIntent &&
        candidate.mutation_intent !== input.mutationIntent
      ) {
        return false;
      }

      return Boolean(
        input.connectorId ?? input.mutationIntent ?? input.clientIntentId,
      );
    }) ?? null;

  if (!enrollment) {
    return {
      preflight_kind: "packet.client_intent.preflight",
      status: "blocked",
      enrollment: null,
      handoff: null,
      policy_requirement_ids: [],
      dependency_requirement_ids: [],
      reason_codes: ["unknown_client_intent_enrollment"],
      notes: [
        "The crossing guard refuses route/intent pairings that are not registered as client/API ingress enrollments.",
      ],
    };
  }

  const policyRequirements = resolveTrustedPolicyRequirements().filter(
    (descriptor) =>
      enrollment.policy_action_ids.includes(descriptor.policy_action_id),
  );
  const dependencyRequirements = resolveTrustedDependencyRequirements().filter(
    (descriptor) =>
      enrollment.dependencies_definition_ids.includes(descriptor.dependency_id),
  );
  const handoff =
    enrollment.live_mode === "signed_dispatch_prepare"
      ? resolvePacketRuntimeFortressHandoff({
          mutationIntent: enrollment.mutation_intent,
        })
      : null;
  const missingPolicyRequirements = enrollment.policy_action_ids.filter(
    (policyActionId) =>
      !policyRequirements.some(
        (descriptor) => descriptor.policy_action_id === policyActionId,
      ),
  );
  const missingDependencyRequirements =
    enrollment.dependencies_definition_ids.filter(
      (dependencyId) =>
        !dependencyRequirements.some(
          (descriptor) => descriptor.dependency_id === dependencyId,
        ) && !dependencyId.endsWith(".dependencies_definition.v0"),
    );
  const reasonCodes = [
    ...missingPolicyRequirements.map(
      (policyActionId) => `missing_policy_requirement:${policyActionId}`,
    ),
    ...missingDependencyRequirements.map(
      (dependencyId) => `missing_dependency_requirement:${dependencyId}`,
    ),
    handoff?.status === "blocked" ? "blocked_dispatch_handoff" : null,
  ].filter((reasonCode): reasonCode is string => reasonCode !== null);

  if (reasonCodes.length > 0) {
    return {
      preflight_kind: "packet.client_intent.preflight",
      status: "blocked",
      enrollment,
      handoff,
      policy_requirement_ids: policyRequirements.map(
        (descriptor) => descriptor.policy_requirement_id,
      ),
      dependency_requirement_ids: dependencyRequirements.map(
        (descriptor) => descriptor.dependency_id,
      ),
      reason_codes: reasonCodes,
      notes: [
        "Enrollment exists, but packet-backed policy/dependency or handoff metadata is incomplete.",
      ],
    };
  }

  return {
    preflight_kind: "packet.client_intent.preflight",
    status:
      enrollment.live_mode === "live_connector"
        ? "allowed_live_connector"
        : "allowed_definition",
    enrollment,
    handoff,
    policy_requirement_ids: policyRequirements.map(
      (descriptor) => descriptor.policy_requirement_id,
    ),
    dependency_requirement_ids: dependencyRequirements.map(
      (descriptor) => descriptor.dependency_id,
    ),
    reason_codes: [
      enrollment.live_mode === "live_connector"
        ? "registered_live_connector"
        : "registered_signed_dispatch_prepare",
    ],
    notes: [
      "Preflight validates enrollment metadata only; Dispatch and the trusted coordinator chain own proof, policy, ticketing, signing checks, persistence, and mutation effects.",
    ],
  };
}

export function auditPacketClientIntentEnrollments(): PacketClientIntentEnrollmentAuditReport {
  const findings: PacketClientIntentEnrollmentAuditFinding[] = [];
  const enrollments = listPacketClientIntentEnrollments();
  const enrollmentIds = enrollments.map(
    (enrollment) => enrollment.enrollment_id,
  );
  const knownMutationIntents = new Set(
    listMutationIntentDescriptors().map((descriptor) => descriptor.kind),
  );
  const handoffCoverage = new Map(
    listPacketRuntimeFortressHandoffCoverage().map((coverage) => [
      coverage.mutation_intent,
      coverage,
    ]),
  );
  const regulationReadiness = auditTrustedRegulationReadiness();
  const planningReadiness = auditTrustedPlanningReadiness();
  const policyIds = new Set(
    resolveTrustedPolicyRequirements().map(
      (descriptor) => descriptor.policy_action_id,
    ),
  );
  const dependencyIds = new Set(
    resolveTrustedDependencyRequirements().map(
      (descriptor) => descriptor.dependency_id,
    ),
  );

  for (const descriptor of listMutationIntentDescriptors()) {
    const prepareEnrollment = enrollments.find(
      (enrollment) =>
        enrollment.source_route === "/api/nexus/mutations/prepare" &&
        enrollment.mutation_intent === descriptor.kind,
    );

    if (!prepareEnrollment) {
      findings.push({
        severity: "error",
        code: "missing_prepare_intent_enrollment",
        enrollment_id: `client.prepare.${descriptor.kind}`,
        message: `${descriptor.kind} has no client/API prepare enrollment record.`,
      });
    }
  }

  for (const enrollment of enrollments) {
    if (
      enrollment.live_mode === "signed_dispatch_prepare" &&
      !knownMutationIntents.has(enrollment.mutation_intent)
    ) {
      findings.push({
        severity: "error",
        code: "unknown_enrolled_mutation_intent",
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} points at unknown mutation intent ${enrollment.mutation_intent}.`,
      });
    }

    if (enrollment.live_mode === "live_connector") {
      const connector = PACKET_RUNTIME_CONNECTORS.find(
        (candidate) => candidate.connector_id === enrollment.connector_id,
      );

      if (!connector) {
        findings.push({
          severity: "error",
          code: "unknown_live_connector_enrollment",
          enrollment_id: enrollment.enrollment_id,
          message: `${enrollment.enrollment_id} points at an unknown live connector.`,
        });
      }
    }

    const handoff = handoffCoverage.get(enrollment.mutation_intent);

    if (enrollment.live_mode === "signed_dispatch_prepare" && !handoff) {
      findings.push({
        severity: "error",
        code: "missing_handoff_enrollment",
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} has no fortress handoff coverage.`,
      });
    }

    for (const policyActionId of enrollment.policy_action_ids) {
      if (!policyIds.has(policyActionId)) {
        findings.push({
          severity: "error",
          code: "unanchored_enrollment_policy",
          enrollment_id: enrollment.enrollment_id,
          message: `${enrollment.enrollment_id} references unanchored policy action ${policyActionId}.`,
        });
      }
    }

    for (const dependencyId of enrollment.dependencies_definition_ids) {
      if (
        dependencyIds.has(dependencyId) ||
        dependencyId.endsWith(".dependencies_definition.v0")
      ) {
        continue;
      }

      findings.push({
        severity: "error",
        code: "unanchored_enrollment_dependency",
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} references unanchored dependency ${dependencyId}.`,
      });
    }

    const preflight = resolvePacketClientIntentPreflight({
      sourceRoute: enrollment.source_route,
      mutationIntent: enrollment.mutation_intent,
      connectorId: enrollment.connector_id,
      clientIntentId: enrollment.client_intent_id,
    });

    if (preflight.status === "blocked") {
      findings.push({
        severity: "error",
        code: "enrollment_preflight_blocked",
        enrollment_id: enrollment.enrollment_id,
        message: `${enrollment.enrollment_id} is enrolled but its preflight is blocked: ${preflight.reason_codes.join(", ")}.`,
      });
    }
  }

  if (regulationReadiness?.ready === false) {
    findings.push({
      severity: "error",
      code: "policy_audit_failed",
      enrollment_id: "packet.policy",
      message:
        "Client ingress enrollment cannot pass while trusted regulation readiness has policy findings.",
    });
  }

  if (planningReadiness?.ready === false) {
    findings.push({
      severity: "error",
      code: "planning_audit_failed",
      enrollment_id: "packet.planning",
      message:
        "Client ingress enrollment cannot pass while trusted planning readiness has default, dependency, builder, or plan findings.",
    });
  }

  return {
    status: findings.length > 0 ? "fail" : "pass",
    checked_enrollment_ids: uniqueSorted(enrollmentIds),
    findings,
  };
}
