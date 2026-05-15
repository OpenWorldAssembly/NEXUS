/**
 * File: shell-preferences.ts
 * Description: Hosts explicit guest and compatibility bridges for shell follow and display preferences.
 */

import type { NexusScopeDisplayPreferencesPayload } from '@runtime/nexus/nexus-api-types';

const SHELL_PREFERENCES_COOKIE = 'owa_nexus_shell_preferences';
const SHELL_PREFERENCES_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type ShellSectionDisplayPreferenceState = {
  show_associated_parent_chains?: boolean;
  show_followed_parent_chains?: boolean;
};

type ShellPreferenceState = {
  follows_by_actor: Record<string, string[]>;
  guest_scope_ids: string[];
  main_visible_scope_ids_by_actor: Record<string, string[]>;
  guest_main_visible_scope_ids: string[];
  section_display_by_actor: Record<string, ShellSectionDisplayPreferenceState>;
  guest_section_display: ShellSectionDisplayPreferenceState;
};

const DEFAULT_SCOPE_DISPLAY_PREFERENCES: NexusScopeDisplayPreferencesPayload = {
  main_visible_scope_packet_ids: [],
  show_associated_parent_chains: true,
  show_followed_parent_chains: true,
};

function parseCookieHeader(cookieHeader: string | null): Record<string, string> {
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

function formatCookie(input: {
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

function parseJson<TValue>(input: string | null, fallback: TValue): TValue {
  if (!input) {
    return fallback;
  }

  try {
    return JSON.parse(input) as TValue;
  } catch {
    return fallback;
  }
}

function normalizeScopeIds(scopeIds: string[]): string[] {
  return Array.from(
    new Set(
      scopeIds.map((scopeId) => scopeId.trim()).filter((scopeId) => scopeId.length > 0)
    )
  ).sort((leftScopeId, rightScopeId) => leftScopeId.localeCompare(rightScopeId));
}

function normalizeSectionDisplayPreferenceState(
  input: ShellSectionDisplayPreferenceState | null | undefined
): Required<ShellSectionDisplayPreferenceState> {
  return {
    show_associated_parent_chains: input?.show_associated_parent_chains !== false,
    show_followed_parent_chains: input?.show_followed_parent_chains !== false,
  };
}

function readPreferenceState(request: Request | null | undefined): ShellPreferenceState {
  const cookies = parseCookieHeader(request?.headers.get('cookie') ?? null);

  return parseJson<ShellPreferenceState>(cookies[SHELL_PREFERENCES_COOKIE] ?? null, {
    follows_by_actor: {},
    guest_scope_ids: [],
    main_visible_scope_ids_by_actor: {},
    guest_main_visible_scope_ids: [],
    section_display_by_actor: {},
    guest_section_display: {},
  });
}

function getBucketScopeIds(
  state: ShellPreferenceState,
  actorPacketId?: string | null
): string[] {
  if (actorPacketId) {
    return normalizeScopeIds(state.follows_by_actor[actorPacketId] ?? []);
  }

  return normalizeScopeIds(state.guest_scope_ids);
}

function getBucketScopeDisplayPreferences(
  state: ShellPreferenceState,
  actorPacketId?: string | null
): NexusScopeDisplayPreferencesPayload {
  const mainVisibleScopePacketIds = actorPacketId
    ? normalizeScopeIds(state.main_visible_scope_ids_by_actor[actorPacketId] ?? [])
    : normalizeScopeIds(state.guest_main_visible_scope_ids);
  const sectionDisplayPreferences = actorPacketId
    ? normalizeSectionDisplayPreferenceState(state.section_display_by_actor[actorPacketId])
    : normalizeSectionDisplayPreferenceState(state.guest_section_display);

  return {
    main_visible_scope_packet_ids: mainVisibleScopePacketIds,
    show_associated_parent_chains:
      sectionDisplayPreferences.show_associated_parent_chains,
    show_followed_parent_chains:
      sectionDisplayPreferences.show_followed_parent_chains,
  };
}

function toSetCookieHeader(state: ShellPreferenceState): string {
  return formatCookie({
    name: SHELL_PREFERENCES_COOKIE,
    value: JSON.stringify(state),
    maxAgeSeconds: SHELL_PREFERENCES_COOKIE_MAX_AGE_SECONDS,
  });
}

export function readFollowedScopeIdsCompatibility(
  request: Request | null | undefined,
  actorPacketId?: string | null
): string[] {
  return getBucketScopeIds(readPreferenceState(request), actorPacketId);
}

export function writeFollowedScopePreferenceCompatibility(input: {
  request: Request;
  actorPacketId?: string | null;
  scopeId: string;
  isFollowed: boolean;
}): {
  followedScopeIds: string[];
  setCookieHeader: string;
} {
  const state = readPreferenceState(input.request);
  const currentScopeIds = getBucketScopeIds(state, input.actorPacketId);
  const nextScopeIds = normalizeScopeIds(
    input.isFollowed
      ? [...currentScopeIds, input.scopeId]
      : currentScopeIds.filter((scopeId) => scopeId !== input.scopeId)
  );

  if (input.actorPacketId) {
    state.follows_by_actor[input.actorPacketId] = nextScopeIds;
  } else {
    state.guest_scope_ids = nextScopeIds;
  }

  return {
    followedScopeIds: nextScopeIds,
    setCookieHeader: toSetCookieHeader(state),
  };
}

export function readScopeDisplayPreferencesCompatibility(
  request: Request | null | undefined,
  actorPacketId?: string | null
): NexusScopeDisplayPreferencesPayload {
  return {
    ...DEFAULT_SCOPE_DISPLAY_PREFERENCES,
    ...getBucketScopeDisplayPreferences(readPreferenceState(request), actorPacketId),
  };
}

export function writeScopeDisplayPreferencesCompatibility(input: {
  request: Request;
  actorPacketId?: string | null;
  preferences: Partial<NexusScopeDisplayPreferencesPayload>;
}): {
  preferences: NexusScopeDisplayPreferencesPayload;
  setCookieHeader: string;
} {
  const state = readPreferenceState(input.request);
  const currentPreferences = getBucketScopeDisplayPreferences(state, input.actorPacketId);
  const nextPreferences: NexusScopeDisplayPreferencesPayload = {
    main_visible_scope_packet_ids: normalizeScopeIds(
      input.preferences.main_visible_scope_packet_ids ??
        currentPreferences.main_visible_scope_packet_ids
    ),
    show_associated_parent_chains:
      input.preferences.show_associated_parent_chains ??
      currentPreferences.show_associated_parent_chains,
    show_followed_parent_chains:
      input.preferences.show_followed_parent_chains ??
      currentPreferences.show_followed_parent_chains,
  };

  if (input.actorPacketId) {
    state.main_visible_scope_ids_by_actor[input.actorPacketId] =
      nextPreferences.main_visible_scope_packet_ids;
    state.section_display_by_actor[input.actorPacketId] = {
      show_associated_parent_chains:
        nextPreferences.show_associated_parent_chains,
      show_followed_parent_chains: nextPreferences.show_followed_parent_chains,
    };
  } else {
    state.guest_main_visible_scope_ids = nextPreferences.main_visible_scope_packet_ids;
    state.guest_section_display = {
      show_associated_parent_chains:
        nextPreferences.show_associated_parent_chains,
      show_followed_parent_chains: nextPreferences.show_followed_parent_chains,
    };
  }

  return {
    preferences: nextPreferences,
    setCookieHeader: toSetCookieHeader(state),
  };
}

export const readFollowedScopeIds = readFollowedScopeIdsCompatibility;
export const writeFollowedScopePreference = writeFollowedScopePreferenceCompatibility;
