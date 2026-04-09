/**
 * File: anonymous-session.ts
 * Description: Creates and reuses session-scoped anonymous guest identifiers for the Nexus visitor lobby MVP.
 */
import {
  AnonymousSessionSchema,
  type AnonymousSession,
} from '@/lib/nexus/visitor-lobby';

const ANONYMOUS_SESSION_STORAGE_KEY = 'owa-nexus-anonymous-session';
export const ANONYMOUS_ACTOR_KEY_PREFIX = 'anonymous-session:';

let inMemoryAnonymousSession: AnonymousSession | null = null;

/**
 * Inputs: none.
 * Output: a short random suffix suitable for session and display ids.
 */
function createRandomSuffix(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 8);
  }

  return Math.random().toString(36).slice(2, 10);
}

/**
 * Inputs: none.
 * Output: a new anonymous session record for the current browser or runtime session.
 */
function createAnonymousSession(): AnonymousSession {
  const suffix = createRandomSuffix();

  return {
    session_id: `anon-session-${suffix}`,
    short_label: `Anon ${suffix.slice(0, 4).toUpperCase()}`,
    started_at: new Date().toISOString(),
  };
}

/**
 * Inputs: a raw sessionStorage value.
 * Output: a validated anonymous session or null when the stored value is invalid.
 */
function parseStoredAnonymousSession(
  storedValue: string | null,
): AnonymousSession | null {
  if (!storedValue) {
    return null;
  }

  try {
    return AnonymousSessionSchema.parse(JSON.parse(storedValue));
  } catch {
    return null;
  }
}

/**
 * Inputs: none.
 * Output: the current browser sessionStorage instance when available.
 */
function getBrowserSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

/**
 * Inputs: an anonymous session id string.
 * Output: the canonical actor key used for guest voting, points, and discussion eligibility.
 */
export function createAnonymousActorKey(sessionId: string): string {
  return `${ANONYMOUS_ACTOR_KEY_PREFIX}${sessionId}`;
}

/**
 * Inputs: none.
 * Output: a stable anonymous session for the current browser session or runtime fallback.
 */
export function getOrCreateAnonymousSession(): AnonymousSession {
  const sessionStorage = getBrowserSessionStorage();

  if (sessionStorage) {
    const storedSession = parseStoredAnonymousSession(
      sessionStorage.getItem(ANONYMOUS_SESSION_STORAGE_KEY),
    );

    if (storedSession) {
      return storedSession;
    }

    const nextSession = createAnonymousSession();

    sessionStorage.setItem(
      ANONYMOUS_SESSION_STORAGE_KEY,
      JSON.stringify(nextSession),
    );

    return nextSession;
  }

  if (inMemoryAnonymousSession) {
    return inMemoryAnonymousSession;
  }

  inMemoryAnonymousSession = createAnonymousSession();

  return inMemoryAnonymousSession;
}
