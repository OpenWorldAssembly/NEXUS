/**
 * File: nexus-query-api.roles.ts
 * Description: Client-side query helpers for the roles workspace and scoped role attestation mutations.
 */

import type {
  NexusRoleAttestationMutationPayload,
  NexusRoleClaimMutationPayload,
  NexusRolesPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusRolesPayload(input: {
  scopeId: string;
  actorPacketId?: string | null;
}): Promise<NexusRolesPayload> {
  const searchParams = new URLSearchParams();

  if (input.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusRolesPayload>(
    `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/roles${
      queryString.length > 0 ? `?${queryString}` : ''
    }`,
    {
      cache: 'no-store',
    }
  );
}

export function setNexusScopedRoleClaim(input: {
  scopeId: string;
  requestBody: Record<string, unknown>;
}): Promise<NexusRoleClaimMutationPayload> {
  return fetchMutationJsonOrThrow<NexusRoleClaimMutationPayload>({
    path: `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/roles/claims`,
    method: 'PUT',
    body: input.requestBody,
  });
}

export function setNexusRoleAttestation(input: {
  scopeId: string;
  requestBody: Record<string, unknown>;
}): Promise<NexusRoleAttestationMutationPayload> {
  return fetchMutationJsonOrThrow<NexusRoleAttestationMutationPayload>({
    path: `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/roles/attestations`,
    method: 'PUT',
    body: input.requestBody,
  });
}
