/**
 * File: shell-preferences.ts
 * Description: Hosts explicit compatibility bridges for legacy shell follow preferences.
 */

const SHELL_FOLLOWS_COOKIE = 'owa_nexus_scope_follows';
const SHELL_FOLLOWS_COOKIE_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

type FollowPreferenceState = {
  follows_by_actor: Record<string, string[]>;
  guest_scope_ids: string[];
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

function readPreferenceState(request: Request | null | undefined): FollowPreferenceState {
  const cookies = parseCookieHeader(request?.headers.get('cookie') ?? null);

  return parseJson<FollowPreferenceState>(cookies[SHELL_FOLLOWS_COOKIE] ?? null, {
    follows_by_actor: {},
    guest_scope_ids: [],
  });
}

function getBucketScopeIds(
  state: FollowPreferenceState,
  actorPacketId?: string | null
): string[] {
  if (actorPacketId) {
    return normalizeScopeIds(state.follows_by_actor[actorPacketId] ?? []);
  }

  return normalizeScopeIds(state.guest_scope_ids);
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
    setCookieHeader: formatCookie({
      name: SHELL_FOLLOWS_COOKIE,
      value: JSON.stringify(state),
      maxAgeSeconds: SHELL_FOLLOWS_COOKIE_MAX_AGE_SECONDS,
    }),
  };
}

export const readFollowedScopeIds = readFollowedScopeIdsCompatibility;
export const writeFollowedScopePreference = writeFollowedScopePreferenceCompatibility;
