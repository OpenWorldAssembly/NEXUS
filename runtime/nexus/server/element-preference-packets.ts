/**
 * File: element-preference-packets.ts
 * Description: Bridges live element scope-display preferences into Preference.element packets while preserving the legacy runtime table as a compatibility cache.
 */

import { createHash } from 'node:crypto';

import { createPacket } from '@core/packets/builders';
import {
  createElementPreferencePacketId,
  normalizeScopeDisplayPreferenceValue,
  type ElementPreferenceBody,
} from '@core/packets/packet-definition-manifest';
import type {
  PacketEnvelopeByType,
  PacketRevisionRef,
} from '@core/schema/packet-schema';
import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  preferenceBodyToRuntimeScopeDisplayPreferences,
  runtimeScopeDisplayPreferencesToPreferenceBody,
} from '@runtime/nexus/server/preference-packet-shadow';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type ElementPreferencePacket = PacketEnvelopeByType['Preference'];

export type ElementPreferencePacketWriteResult = {
  packet: ElementPreferencePacket;
  revision_ref: PacketRevisionRef;
  preferences: NexusScopeDisplayPreferencesPayload;
  wrote_revision: boolean;
};

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(',')}]`;
  }

  if (value && typeof value === 'object') {
    return `{${Object.entries(value as Record<string, unknown>)
      .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(',')}}`;
  }

  return JSON.stringify(value);
}

function createElementPreferenceRevisionId(input: {
  packetId: string;
  body: ElementPreferenceBody;
  parentRevisionRef?: PacketRevisionRef | null;
  createdAt: string;
}): string {
  const digest = createHash('sha256')
    .update(
      stableJson({
        packet_id: input.packetId,
        family: 'Preference',
        schema_version: '0.1.0',
        created_at: input.createdAt,
        parent_revision_ref: input.parentRevisionRef ?? null,
        body: input.body,
      })
    )
    .digest('hex')
    .slice(0, 24);

  return `${input.packetId}@r-${digest}`;
}

function isElementPreferencePacket(
  packet: unknown
): packet is ElementPreferencePacket {
  return (
    typeof packet === 'object' &&
    packet !== null &&
    (packet as ElementPreferencePacket).header?.family === 'Preference' &&
    (packet as ElementPreferencePacket).body?.subtype === 'element'
  );
}

function getPreferencePacketProjection(
  packet: ElementPreferencePacket
): NexusScopeDisplayPreferencesPayload | null {
  if (packet.body.status !== 'active') {
    return null;
  }

  return preferenceBodyToRuntimeScopeDisplayPreferences(packet.body);
}

function preferencesAreEqual(
  left: NexusScopeDisplayPreferencesPayload,
  right: NexusScopeDisplayPreferencesPayload
): boolean {
  return (
    stableJson(normalizeScopeDisplayPreferenceValue(left)) ===
    stableJson(normalizeScopeDisplayPreferenceValue(right))
  );
}

export async function readElementScopeDisplayPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
}): Promise<{
  packet: ElementPreferencePacket;
  preferences: NexusScopeDisplayPreferencesPayload;
} | null> {
  const packetId = createElementPreferencePacketId({
    owner_ref: { packet_id: input.actorPacketId },
  });
  const packet = await input.packetStore.fetchByPacket({ packet_id: packetId });

  if (!isElementPreferencePacket(packet)) {
    return null;
  }

  const preferences = getPreferencePacketProjection(packet);

  if (!preferences) {
    return null;
  }

  return {
    packet,
    preferences,
  };
}

export async function writeElementScopeDisplayPreferencePacket(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
  preferences: NexusScopeDisplayPreferencesPayload;
  createdAt?: string | null;
}): Promise<ElementPreferencePacketWriteResult> {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const currentProjection = await readElementScopeDisplayPreferencePacket({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
  });
  const parentRevisionRef = currentProjection
    ? {
        packet_id: currentProjection.packet.header.packet_id,
        revision_id: currentProjection.packet.header.revision_id,
      }
    : null;
  const body = runtimeScopeDisplayPreferencesToPreferenceBody({
    actorPacketId: input.actorPacketId,
    preferences: input.preferences,
    supersedes_ref: parentRevisionRef,
    note: 'Element scope-display preferences.',
  });
  const nextPreferences = preferenceBodyToRuntimeScopeDisplayPreferences(body);

  if (
    currentProjection &&
    preferencesAreEqual(currentProjection.preferences, nextPreferences)
  ) {
    return {
      packet: currentProjection.packet,
      revision_ref: {
        packet_id: currentProjection.packet.header.packet_id,
        revision_id: currentProjection.packet.header.revision_id,
      },
      preferences: currentProjection.preferences,
      wrote_revision: false,
    };
  }

  const packetId = createElementPreferencePacketId({
    owner_ref: { packet_id: input.actorPacketId },
    context: body.context,
  });
  const packet = createPacket({
    family: 'Preference',
    packet_id: packetId,
    revision_id: createElementPreferenceRevisionId({
      packetId,
      body,
      parentRevisionRef,
      createdAt,
    }),
    schema_version: '0.1.0',
    created_at: createdAt,
    parent_revision_refs: parentRevisionRef ? [parentRevisionRef] : [],
    merge_strategy: 'last_write_wins',
    authority_scope_ref: { packet_id: input.actorPacketId },
    applicable_scope_refs: [{ packet_id: input.actorPacketId }],
    created_by: { packet_id: input.actorPacketId },
    submitted_by: { packet_id: input.actorPacketId },
    visibility: 'private',
    metadata_tags: ['preference', 'element', 'scope_display'],
    metadata_summary: 'Element scope-display preferences.',
    adapter: 'nexus-runtime',
    body,
  });
  const revisionRef = await input.packetStore.writeRevision(packet);

  return {
    packet,
    revision_ref: revisionRef,
    preferences: nextPreferences,
    wrote_revision: true,
  };
}
