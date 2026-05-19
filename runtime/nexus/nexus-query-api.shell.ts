/**
 * File: nexus-query-api.shell.ts
 * Description: Client-side query helpers for shell and dashboard payloads.
 */

import type { ShellChromePreferenceValue } from '@core/packets/packet-definition-manifest';
import type {
  NexusDashboardPayload,
  NexusScopeDisplayPreferencesPayload,
  NexusShellPayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchJsonOrThrow,
  fetchMutationJsonOrThrow,
} from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusShellPayload(input?: {
  actorPacketId?: string | null;
}): Promise<NexusShellPayload> {
  const searchParams = new URLSearchParams();

  if (input?.actorPacketId) {
    searchParams.set('actor_packet_id', input.actorPacketId);
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusShellPayload>(
    `/api/nexus/shell${queryString.length > 0 ? `?${queryString}` : ''}`
  );
}

export function fetchNexusDashboardPayload(
  scopeId: string,
  actorPacketId?: string | null
): Promise<NexusDashboardPayload> {
  const searchParams = new URLSearchParams();

  if (actorPacketId) {
    searchParams.set('actor_packet_id', actorPacketId);
  }

  const queryString = searchParams.toString();

  return fetchJsonOrThrow<NexusDashboardPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/dashboard${
      queryString.length > 0 ? `?${queryString}` : ''
    }`
  );
}

export function updateNexusScopeDisplayPreferences(input: {
  requestBody: Record<string, unknown>;
  headers?: Record<string, string>;
}): Promise<{
  preferences: NexusScopeDisplayPreferencesPayload;
  shell_chrome?: ShellChromePreferenceValue;
}> {
  return fetchMutationJsonOrThrow<{
    preferences: NexusScopeDisplayPreferencesPayload;
    shell_chrome?: ShellChromePreferenceValue;
  }>({
    path: '/api/nexus/shell-preferences',
    method: 'POST',
    body: input.requestBody,
    headers: input.headers,
  });
}
