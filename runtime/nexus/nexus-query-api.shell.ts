/**
 * File: nexus-query-api.shell.ts
 * Description: Client-side query helpers for shell and dashboard payloads.
 */

import type {
  NexusDashboardPayload,
  NexusShellPayload,
} from '@runtime/nexus/nexus-api-types';
import { fetchJsonOrThrow } from '@runtime/nexus/nexus-query-api.shared';

export function fetchNexusShellPayload(): Promise<NexusShellPayload> {
  return fetchJsonOrThrow<NexusShellPayload>('/api/nexus/shell');
}

export function fetchNexusDashboardPayload(
  scopeId: string
): Promise<NexusDashboardPayload> {
  return fetchJsonOrThrow<NexusDashboardPayload>(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/dashboard`
  );
}
