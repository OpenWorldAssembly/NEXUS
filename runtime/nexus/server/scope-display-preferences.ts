/**
 * File: scope-display-preferences.ts
 * Description: Resolves Preference.element-backed scope-display preferences for claimed actors, with runtime-table and guest compatibility fallbacks.
 */

import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';
import {
  readElementScopeDisplayPreferencePacket,
  writeElementScopeDisplayPreferencePacket,
} from '@runtime/nexus/server/element-preference-packets';
import {
  readScopeDisplayPreferencesCompatibility,
} from '@runtime/nexus/server/shell-preferences';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export const DEFAULT_SCOPE_DISPLAY_PREFERENCES: NexusScopeDisplayPreferencesPayload = {
  main_visible_scope_packet_ids: [],
  show_associated_parent_chains: true,
  show_followed_parent_chains: true,
};

function normalizePreferences(
  input: Partial<NexusScopeDisplayPreferencesPayload> | null | undefined
): NexusScopeDisplayPreferencesPayload {
  return {
    main_visible_scope_packet_ids: Array.from(
      new Set(
        (input?.main_visible_scope_packet_ids ?? [])
          .map((scopeId) => scopeId.trim())
          .filter((scopeId) => scopeId.length > 0)
      )
    ).sort((leftScopeId, rightScopeId) => leftScopeId.localeCompare(rightScopeId)),
    show_associated_parent_chains:
      input?.show_associated_parent_chains ??
      DEFAULT_SCOPE_DISPLAY_PREFERENCES.show_associated_parent_chains,
    show_followed_parent_chains:
      input?.show_followed_parent_chains ??
      DEFAULT_SCOPE_DISPLAY_PREFERENCES.show_followed_parent_chains,
  };
}

export function reconcileScopeDisplayPreferences(input: {
  preferences: Partial<NexusScopeDisplayPreferencesPayload>;
  eligibleMainScopePacketIds?: Iterable<string> | null;
}): NexusScopeDisplayPreferencesPayload {
  const normalizedPreferences = normalizePreferences(input.preferences);
  const eligibleMainScopePacketIds = input.eligibleMainScopePacketIds
    ? new Set(
        Array.from(input.eligibleMainScopePacketIds)
          .map((scopeId) => scopeId.trim())
          .filter((scopeId) => scopeId.length > 0)
      )
    : null;

  if (!eligibleMainScopePacketIds) {
    return normalizedPreferences;
  }

  return {
    ...normalizedPreferences,
    main_visible_scope_packet_ids:
      normalizedPreferences.main_visible_scope_packet_ids.filter((scopeId) =>
        eligibleMainScopePacketIds.has(scopeId)
      ),
  };
}

export async function readScopeDisplayPreferences(input: {
  packetStore: NodeSQLitePacketStore;
  request?: Request | null;
  actorPacketId?: string | null;
}): Promise<NexusScopeDisplayPreferencesPayload> {
  if (input.actorPacketId) {
    const preferencePacket = await readElementScopeDisplayPreferencePacket({
      packetStore: input.packetStore,
      actorPacketId: input.actorPacketId,
    });

    if (preferencePacket) {
      return normalizePreferences(preferencePacket.preferences);
    }

    const storedPreferences = await input.packetStore.readActorScopeDisplayPreferences(
      input.actorPacketId
    );

    if (storedPreferences) {
      return normalizePreferences(storedPreferences);
    }
  }

  return normalizePreferences(
    readScopeDisplayPreferencesCompatibility(
      input.request ?? null,
      input.actorPacketId ?? null
    )
  );
}

export async function writeClaimedScopeDisplayPreferences(input: {
  packetStore: NodeSQLitePacketStore;
  actorPacketId: string;
  preferences: Partial<NexusScopeDisplayPreferencesPayload>;
  eligibleMainScopePacketIds?: Iterable<string> | null;
}): Promise<NexusScopeDisplayPreferencesPayload> {
  const currentPreferences = await readScopeDisplayPreferences({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
  });
  const nextPreferences = reconcileScopeDisplayPreferences({
    preferences: {
      ...currentPreferences,
      ...input.preferences,
    },
    eligibleMainScopePacketIds: input.eligibleMainScopePacketIds,
  });

  const updatedAt = new Date().toISOString();

  await writeElementScopeDisplayPreferencePacket({
    packetStore: input.packetStore,
    actorPacketId: input.actorPacketId,
    preferences: nextPreferences,
    createdAt: updatedAt,
  });

  await input.packetStore.writeActorScopeDisplayPreferences({
    actor_packet_id: input.actorPacketId,
    main_visible_scope_packet_ids: nextPreferences.main_visible_scope_packet_ids,
    show_associated_parent_chains:
      nextPreferences.show_associated_parent_chains,
    show_followed_parent_chains:
      nextPreferences.show_followed_parent_chains,
    updated_at: updatedAt,
  });

  return nextPreferences;
}
