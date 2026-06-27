/**
 * File: reseed+api.ts
 * Description: Local maintenance API for applying canonical Nexus reseed packets.
 */

import type { RequestHandler } from 'expo-router/server';

import {
  NEXUS_WIPE_CONFIRMATION_PHRASE,
  runNexusDatabaseWipe,
  runNexusCanonicalReseed,
  type NexusCanonicalReseedMode,
} from '@runtime/nexus/server/nexus-reseed';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

export function canUseReseedRoute(_request: Request): boolean {
  // TEMPORARY RESEED RESET BYPASS:
  // This route is intentionally open while the Railway packet store is being
  // wiped and reseeded. Restore maintenance-token/env gating after reset.
  return true;
}

function parseMode(value: unknown): NexusCanonicalReseedMode {
  return value === 'commit' ? 'commit' : 'dry_run';
}

function parseRequestObject(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object'
    ? value as Record<string, unknown>
    : {};
}

export const GET: RequestHandler = async (request) => {
  if (!canUseReseedRoute(request)) {
    return createJsonResponse(
      { error: 'Nexus reseed is disabled or unauthorized for this runtime.' },
      403
    );
  }

  const services = await getNexusPacketServices();
  const report = await runNexusCanonicalReseed({
    packetStore: services.packetStore,
    request: { mode: 'dry_run' },
  });

  return createJsonResponse(report);
};

export const POST: RequestHandler = async (request) => {
  if (!canUseReseedRoute(request)) {
    return createJsonResponse(
      { error: 'Nexus reseed is disabled or unauthorized for this runtime.' },
      403
    );
  }

  try {
    const requestBody = parseRequestObject(await request.json().catch(() => ({})));
    const services = await getNexusPacketServices();

    if (requestBody.action === 'reset') {
      const wipe = await runNexusDatabaseWipe({
        packetStore: services.packetStore,
        request: {
          mode: 'commit',
          confirmation: NEXUS_WIPE_CONFIRMATION_PHRASE,
        },
      });

      if (wipe.status === 'blocked') {
        return createJsonResponse(
          {
            report_kind: 'nexus.database_reset',
            status: 'blocked',
            wipe,
            reseed: null,
          },
          409
        );
      }

      const reseed = await runNexusCanonicalReseed({
        packetStore: services.packetStore,
        request: { mode: 'commit' },
      });

      return createJsonResponse(
        {
          report_kind: 'nexus.database_reset',
          status: reseed.status === 'blocked' ? 'blocked' : 'applied',
          wipe,
          reseed,
        },
        reseed.status === 'blocked' ? 409 : 200
      );
    }

    if (requestBody.action === 'wipe') {
      const report = await runNexusDatabaseWipe({
        packetStore: services.packetStore,
        request: {
          mode: parseMode(requestBody.mode),
          confirmation:
            typeof requestBody.confirmation === 'string'
              ? requestBody.confirmation
              : null,
        },
      });

      return createJsonResponse(report, report.status === 'blocked' ? 409 : 200);
    }

    const report = await runNexusCanonicalReseed({
      packetStore: services.packetStore,
      request: { mode: parseMode(requestBody.mode) },
    });

    return createJsonResponse(report, report.status === 'blocked' ? 409 : 200);
  } catch (error) {
    return createJsonResponse(
      {
        error:
          error instanceof Error
            ? error.message
            : 'Unable to run Nexus reseed.',
      },
      500
    );
  }
};
