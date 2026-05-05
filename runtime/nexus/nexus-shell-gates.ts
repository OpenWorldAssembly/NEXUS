/**
 * File: nexus-shell-gates.ts
 * Description: Defines session-scoped Nexus shell gate state for entry notices and future onboarding flows.
 */

export const NEXUS_SHELL_GATE_IDS = ['early_access'] as const;

export type NexusShellGateId = (typeof NEXUS_SHELL_GATE_IDS)[number];

export type NexusShellGateSession = {
  dismissed_gate_ids: NexusShellGateId[];
};

const NEXUS_SHELL_GATE_SESSION_STORAGE_KEY = 'owa.nexus-shell.gates.v1';

function getSessionStorage(): Storage | null {
  if (typeof window === 'undefined') {
    return null;
  }

  try {
    return window.sessionStorage;
  } catch {
    return null;
  }
}

function isNexusShellGateId(value: unknown): value is NexusShellGateId {
  return (
    typeof value === 'string' &&
    (NEXUS_SHELL_GATE_IDS as readonly string[]).includes(value)
  );
}

function sanitizeNexusShellGateSession(value: unknown): NexusShellGateSession | null {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Record<string, unknown>;

  if (!Array.isArray(candidate.dismissed_gate_ids)) {
    return null;
  }

  return {
    dismissed_gate_ids: candidate.dismissed_gate_ids.filter(isNexusShellGateId),
  };
}

export function createEmptyNexusShellGateSession(): NexusShellGateSession {
  return {
    dismissed_gate_ids: [],
  };
}

export function isNexusShellGateDismissed(
  session: NexusShellGateSession,
  gateId: NexusShellGateId
): boolean {
  return session.dismissed_gate_ids.includes(gateId);
}

export function dismissNexusShellGate(
  session: NexusShellGateSession,
  gateId: NexusShellGateId
): NexusShellGateSession {
  if (session.dismissed_gate_ids.includes(gateId)) {
    return session;
  }

  return {
    ...session,
    dismissed_gate_ids: [...session.dismissed_gate_ids, gateId],
  };
}

export function readNexusShellGateSession(): NexusShellGateSession {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return createEmptyNexusShellGateSession();
  }

  const rawValue = sessionStorage.getItem(NEXUS_SHELL_GATE_SESSION_STORAGE_KEY);

  if (!rawValue) {
    return createEmptyNexusShellGateSession();
  }

  try {
    const parsedValue = JSON.parse(rawValue) as unknown;

    return (
      sanitizeNexusShellGateSession(parsedValue) ??
      createEmptyNexusShellGateSession()
    );
  } catch {
    return createEmptyNexusShellGateSession();
  }
}

export function persistNexusShellGateSession(
  session: NexusShellGateSession
): void {
  const sessionStorage = getSessionStorage();

  if (!sessionStorage) {
    return;
  }

  sessionStorage.setItem(
    NEXUS_SHELL_GATE_SESSION_STORAGE_KEY,
    JSON.stringify(session)
  );
}
