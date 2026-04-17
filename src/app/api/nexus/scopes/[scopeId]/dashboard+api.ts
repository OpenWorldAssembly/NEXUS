/**
 * File: dashboard+api.ts
 * Description: Serves packet-backed dashboard data for a specific Nexus scope lens.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  getNexusDashboardPayload,
  getNexusShellPayload,
  resolveScopeIdFromShell,
} from '@runtime/nexus/server/nexus-query-data';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

/**
 * Inputs: route scope id.
 * Output: dashboard payload resolved to a valid packet-backed scope id.
 */
export const GET: RequestHandler = async (_request, params) => {
  try {
    const shellPayload = await getNexusShellPayload();
    const scopeId = resolveScopeIdFromShell(shellPayload, params.scopeId);
    const dashboardPayload = await getNexusDashboardPayload(scopeId);

    return createJsonResponse(dashboardPayload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to load packet-backed dashboard data.';

    return createJsonResponse({ error: message }, 500);
  }
};

