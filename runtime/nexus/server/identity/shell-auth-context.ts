/**
 * File: shell-auth-context.ts
 * Description: Resolves which actor-owned shell preference context may be read from an authenticated request.
 */

export type ShellActorPreferenceContext = {
  actorPacketId: string | null;
  ignoredRequestedActorPacketId: string | null;
  reason:
    | 'authenticated_default'
    | 'authenticated_match'
    | 'actor_mismatch'
    | 'guest';
};

export function resolveAuthenticatedShellActorPreferenceContext(input: {
  requestedActorPacketId?: string | null;
  authenticatedActorPacketId?: string | null;
  isAuthenticated?: boolean;
}): ShellActorPreferenceContext {
  const requestedActorPacketId = input.requestedActorPacketId?.trim() || null;
  const authenticatedActorPacketId = input.authenticatedActorPacketId?.trim() || null;

  if (!input.isAuthenticated || !authenticatedActorPacketId) {
    return {
      actorPacketId: null,
      ignoredRequestedActorPacketId: requestedActorPacketId,
      reason: 'guest',
    };
  }

  if (!requestedActorPacketId) {
    return {
      actorPacketId: authenticatedActorPacketId,
      ignoredRequestedActorPacketId: null,
      reason: 'authenticated_default',
    };
  }

  if (requestedActorPacketId !== authenticatedActorPacketId) {
    return {
      actorPacketId: null,
      ignoredRequestedActorPacketId: requestedActorPacketId,
      reason: 'actor_mismatch',
    };
  }

  return {
    actorPacketId: authenticatedActorPacketId,
    ignoredRequestedActorPacketId: null,
    reason: 'authenticated_match',
  };
}
