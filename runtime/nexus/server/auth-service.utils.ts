/**
 * File: auth-service.utils.ts
 * Description: Shared low-level auth helpers for cookie parsing, assertion freshness, and identity packet validation.
 */

import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  normalizeDisplayAlias,
  validateDisplayAlias,
  validateLocationDisclosure,
} from '@runtime/nexus/identity-validation';
import type { NexusPasskeySummaryPayload } from '@runtime/nexus/nexus-api-types';
import type { PasskeyRecord } from '@runtime/nexus/server/auth-service.types';
import { ACTOR_ASSERTION_TTL_MS } from '@runtime/nexus/server/auth-service.types';

/**
 * Inputs: the raw cookie header string.
 * Output: a decoded map of cookie names to values.
 */
export function parseCookieHeader(
  cookieHeader: string | null
): Record<string, string> {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter((part) => part.includes('='))
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        return [
          part.slice(0, separatorIndex),
          decodeURIComponent(part.slice(separatorIndex + 1)),
        ];
      })
  );
}

/**
 * Inputs: the cookie name/value and optional max age.
 * Output: a secure serialized cookie string.
 */
export function formatCookie(input: {
  name: string;
  value: string;
  maxAgeSeconds?: number | null;
}): string {
  const parts = [
    `${input.name}=${encodeURIComponent(input.value)}`,
    'Path=/',
    'HttpOnly',
    'Secure',
    'SameSite=Lax',
  ];

  if (typeof input.maxAgeSeconds === 'number') {
    parts.push(`Max-Age=${input.maxAgeSeconds}`);
  }

  return parts.join('; ');
}

/**
 * Inputs: a cookie name.
 * Output: an expired cookie string that clears the cookie immediately.
 */
export function createExpiredCookie(name: string): string {
  return `${name}=; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
}

/**
 * Inputs: a JSON string and fallback value.
 * Output: the parsed JSON value when valid, otherwise the fallback.
 */
export function parseJson<TValue>(input: string | null, fallback: TValue): TValue {
  if (!input) {
    return fallback;
  }

  try {
    return JSON.parse(input) as TValue;
  } catch {
    return fallback;
  }
}

/**
 * Inputs: an actor assertion issued-at timestamp.
 * Output: throws when the assertion is too old or malformed.
 */
export function assertRecentAssertion(issuedAt: string): void {
  const issuedAtTime = new Date(issuedAt).getTime();

  if (!Number.isFinite(issuedAtTime)) {
    throw new Error('Actor assertion timestamp is invalid.');
  }

  if (Math.abs(Date.now() - issuedAtTime) > ACTOR_ASSERTION_TTL_MS) {
    throw new Error('Actor assertion has expired.');
  }
}

/**
 * Inputs: a passkey database record.
 * Output: the serialized passkey summary payload returned to clients.
 */
export function toPasskeySummary(
  record: PasskeyRecord
): NexusPasskeySummaryPayload {
  return {
    credential_id: record.credential_id,
    created_at: record.created_at,
    last_used_at: record.last_used_at,
    transports: parseJson<string[]>(record.transports_json, []),
    revoked_at: record.revoked_at,
  };
}

/**
 * Inputs: a packet fetched from storage.
 * Output: whether the packet is a person `Element`.
 */
export function isPersonElementPacket(
  packet: PacketEnvelope | null | undefined
): packet is PacketEnvelopeByType['Element'] {
  if (!packet || packet.header.family !== 'Element') {
    return false;
  }

  const elementPacket = packet as PacketEnvelopeByType['Element'];

  return elementPacket.body.kind === 'person';
}

/**
 * Inputs: a person element packet.
 * Output: throws when alias or location-disclosure metadata is invalid.
 */
export function validateIdentityPacketMetadata(
  actorPacket: PacketEnvelopeByType['Element']
): void {
  const normalizedAlias = normalizeDisplayAlias(
    actorPacket.body.identity?.alias ?? actorPacket.body.name
  );
  const aliasError = validateDisplayAlias(normalizedAlias);

  if (aliasError) {
    throw new Error(aliasError);
  }

  if ((actorPacket.body.identity?.alias ?? '') !== normalizedAlias) {
    throw new Error('Display alias must be normalized before it is saved.');
  }

  const locationError = validateLocationDisclosure(
    actorPacket.body.identity?.location_disclosure ?? null
  );

  if (locationError) {
    throw new Error(locationError);
  }
}

/**
 * Inputs: the current request and an optional preferred device label.
 * Output: a bounded session device label.
 */
export function resolveDeviceLabel(input: {
  request: Request;
  preferredLabel?: string | null;
}): string {
  if (input.preferredLabel && input.preferredLabel.trim().length > 0) {
    return input.preferredLabel.trim().slice(0, 120);
  }

  const userAgent =
    input.request.headers.get('x-device-label') ??
    input.request.headers.get('user-agent') ??
    'Current device';

  return userAgent.slice(0, 120);
}
