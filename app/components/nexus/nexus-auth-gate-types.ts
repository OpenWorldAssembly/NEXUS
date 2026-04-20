/**
 * File: nexus-auth-gate-types.ts
 * Description: Shared typed auth/write-gate errors for Nexus protected actions.
 */

export type NexusAuthGateReason =
  | 'sign_in_required'
  | 'unlock_required'
  | 'session_refresh_required'
  | 'write_approval_required'
  | 'community_claim_required';

export class NexusAuthGateError extends Error {
  readonly reason: NexusAuthGateReason;

  constructor(reason: NexusAuthGateReason, message: string) {
    super(message);
    this.name = 'NexusAuthGateError';
    this.reason = reason;
  }
}

export function isNexusAuthGateError(
  error: unknown
): error is NexusAuthGateError {
  return error instanceof NexusAuthGateError;
}
