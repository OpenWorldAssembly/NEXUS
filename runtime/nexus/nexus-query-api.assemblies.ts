/**
 * File: nexus-query-api.assemblies.ts
 * Description: Client-side query helpers for assembly-claim APIs.
 */

import type {
  NexusAssemblyClaimMutationPayload,
  NexusAssemblyClaimsPayload,
  NexusCreateAssemblyPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusAssemblyClaims(input: {
  actorPacketId: string;
}): Promise<NexusAssemblyClaimsPayload> {
  return fetchJsonOrThrow<NexusAssemblyClaimsPayload>(
    `/api/nexus/assemblies/claims?actor_packet_id=${encodeURIComponent(input.actorPacketId)}`
  );
}

export function setNexusAssemblyAssociationClaim(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusAssemblyClaimMutationPayload> {
  return fetchMutationJsonOrThrow<NexusAssemblyClaimMutationPayload>({
    path: '/api/nexus/assemblies/claims',
    method: 'PUT',
    body: input.requestBody,
  });
}

export function createNexusAssembly(input: {
  requestBody: Record<string, unknown>;
}): Promise<NexusCreateAssemblyPayload> {
  return fetchMutationJsonOrThrow<NexusCreateAssemblyPayload>({
    path: '/api/nexus/assemblies',
    method: 'POST',
    body: input.requestBody,
  });
}
