/**
 * File: actions+api.ts
 * Description: Serves runtime-projected base PacketActions for packet cards and generic menus.
 */

import type { RequestHandler } from 'expo-router/server';

import { PACKET_TYPES } from '@core/schema/packet-schema';
import type { PacketType } from '@core/schema/packet-schema';
import type {
  NexusPacketActionsBatchRequest,
  NexusPacketActionSurface,
  NexusPacketActionTargetInput,
} from '@runtime/nexus/nexus-api-types';
import { getNexusPacketServices } from '@runtime/nexus/server/nexus-packet-services';

const PACKET_ACTION_SURFACES = new Set<NexusPacketActionSurface>([
  'dashboard',
  'discussions',
  'votes',
  'roles',
  'trust',
  'library',
  'explorer',
]);

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

function sanitizeString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0
    ? value.trim()
    : null;
}

function sanitizeType(value: unknown): PacketType | null {
  return typeof value === 'string' &&
    (PACKET_TYPES as readonly string[]).includes(value)
    ? (value as PacketType)
    : null;
}

function sanitizeSurface(value: unknown): NexusPacketActionSurface | null {
  return typeof value === 'string' &&
    PACKET_ACTION_SURFACES.has(value as NexusPacketActionSurface)
    ? (value as NexusPacketActionSurface)
    : null;
}

function parseTarget(value: unknown): NexusPacketActionTargetInput | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }

  const candidate = value as Record<string, unknown>;
  const packetId = sanitizeString(candidate.packet_id);

  if (!packetId) {
    return null;
  }

  return {
    packet_id: packetId,
    revision_id: sanitizeString(candidate.revision_id),
    type: sanitizeType(candidate.type),
    label: sanitizeString(candidate.label),
    title: sanitizeString(candidate.title),
    summary: sanitizeString(candidate.summary),
    preferred_surface: sanitizeSurface(candidate.preferred_surface),
  };
}

function parseBatchRequest(value: unknown): NexusPacketActionsBatchRequest {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new Error('Packet action request must be a JSON object.');
  }

  const candidate = value as Record<string, unknown>;
  const rawTargets = Array.isArray(candidate.targets) ? candidate.targets : [];
  const targets = rawTargets
    .map((target) => parseTarget(target))
    .filter((target): target is NexusPacketActionTargetInput => target !== null);

  if (targets.length === 0) {
    throw new Error('Packet action request requires at least one packet target.');
  }

  return {
    scope_id: sanitizeString(candidate.scope_id),
    viewer_actor_packet_id: sanitizeString(candidate.viewer_actor_packet_id),
    surface: sanitizeSurface(candidate.surface),
    targets,
  };
}

/**
 * Inputs: packet target array plus optional surface/scope context.
 * Output: runtime-projected base PacketActions for each target.
 */
export const POST: RequestHandler = async (request) => {
  try {
    const requestBody = await request.json();
    const batchRequest = parseBatchRequest(requestBody);
    const services = await getNexusPacketServices();
    const payload = await services.packetActionService.projectPacketActionsBatch(
      batchRequest
    );

    return createJsonResponse(payload);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Unable to project packet actions.';

    return createJsonResponse({ error: message }, 400);
  }
};
