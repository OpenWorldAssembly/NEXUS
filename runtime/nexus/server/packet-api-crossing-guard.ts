/**
 * File: packet-api-crossing-guard.ts
 * Description: Interface-neutral API ingress preflight helpers for the packet runtime crossing guard.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import {
  auditPacketClientIntentEnrollments,
  listPacketClientIntentEnrollments,
  resolvePacketClientIntentPreflight,
  type PacketClientIntentPreflight,
} from '@runtime/nexus/server/packet-client-intent-enrollment';

export type PacketApiPreflightResult = {
  preflight_kind: 'packet.api_ingress.preflight';
  status: PacketClientIntentPreflight['status'];
  source_route: string;
  mutation_intent: string;
  client_intent_id: string | null;
  connector_id: string | null;
  client_preflight: PacketClientIntentPreflight;
};

export type PacketApiEnrollmentCoverage = {
  source_route: string;
  enrollment_count: number;
  mutation_intents: string[];
  connector_ids: string[];
  client_intent_ids: string[];
};

function assertPreflightAllowed(preflight: PacketApiPreflightResult): PacketApiPreflightResult {
  if (preflight.status !== 'blocked') {
    return preflight;
  }

  throw new Error(
    `Packet API ingress is not enrolled for ${preflight.source_route} ${preflight.mutation_intent}.`
  );
}

export function resolvePrepareMutationApiPreflight(
  intent: Pick<MutationIntent, 'kind'>
): PacketApiPreflightResult {
  const clientPreflight = resolvePacketClientIntentPreflight({
    sourceRoute: '/api/nexus/mutations/prepare',
    mutationIntent: intent.kind,
  });

  return assertPreflightAllowed({
    preflight_kind: 'packet.api_ingress.preflight',
    status: clientPreflight.status,
    source_route: '/api/nexus/mutations/prepare',
    mutation_intent: intent.kind,
    client_intent_id: clientPreflight.enrollment?.client_intent_id ?? null,
    connector_id: null,
    client_preflight: clientPreflight,
  });
}

export function resolveFinalizeMutationApiPreflight(
  ticketIntent: Pick<MutationIntent, 'kind'>
): PacketApiPreflightResult {
  const clientPreflight = resolvePacketClientIntentPreflight({
    sourceRoute: '/api/nexus/mutations/prepare',
    mutationIntent: ticketIntent.kind,
  });

  return assertPreflightAllowed({
    preflight_kind: 'packet.api_ingress.preflight',
    status: clientPreflight.status,
    source_route: '/api/nexus/mutations/finalize',
    mutation_intent: ticketIntent.kind,
    client_intent_id: clientPreflight.enrollment?.client_intent_id ?? null,
    connector_id: null,
    client_preflight: clientPreflight,
  });
}

export function resolveShellPreferencesApiPreflight(): PacketApiPreflightResult {
  const clientPreflight = resolvePacketClientIntentPreflight({
    sourceRoute: '/api/nexus/shell-preferences',
    mutationIntent: 'preference.element.set',
    connectorId: 'preference.element.interface.set',
  });

  return assertPreflightAllowed({
    preflight_kind: 'packet.api_ingress.preflight',
    status: clientPreflight.status,
    source_route: '/api/nexus/shell-preferences',
    mutation_intent: 'preference.element.set',
    client_intent_id: clientPreflight.enrollment?.client_intent_id ?? null,
    connector_id: 'preference.element.interface.set',
    client_preflight: clientPreflight,
  });
}

export function listPacketApiEnrollmentCoverage(): PacketApiEnrollmentCoverage[] {
  const enrollmentsByRoute = new Map<
    string,
    ReturnType<typeof listPacketClientIntentEnrollments>
  >();

  for (const enrollment of listPacketClientIntentEnrollments()) {
    enrollmentsByRoute.set(enrollment.source_route, [
      ...(enrollmentsByRoute.get(enrollment.source_route) ?? []),
      enrollment,
    ]);
  }

  return [...enrollmentsByRoute.entries()]
    .map(([sourceRoute, enrollments]) => ({
      source_route: sourceRoute,
      enrollment_count: enrollments.length,
      mutation_intents: enrollments
        .map((enrollment) => enrollment.mutation_intent)
        .sort((left, right) => left.localeCompare(right)),
      connector_ids: enrollments
        .map((enrollment) => enrollment.connector_id)
        .filter((connectorId): connectorId is string => connectorId !== null)
        .sort((left, right) => left.localeCompare(right)),
      client_intent_ids: enrollments
        .map((enrollment) => enrollment.client_intent_id)
        .sort((left, right) => left.localeCompare(right)),
    }))
    .sort((left, right) => left.source_route.localeCompare(right.source_route));
}

export function auditPacketApiEnrollmentCoverage() {
  return auditPacketClientIntentEnrollments();
}
