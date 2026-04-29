/**
 * File: nexus-auth-gate-error.ts
 * Description: Shared typed auth/write-gate errors and payload helpers for Nexus protected actions.
 */

export type NexusAuthGateReason =
  | 'sign_in_required'
  | 'unlock_required'
  | 'session_refresh_required'
  | 'write_approval_required'
  | 'community_claim_required'
  | 'stale_actor_packet';

export type NexusAuthFailureCode =
  | 'session_missing'
  | 'session_expired'
  | 'session_revoked'
  | 'session_actor_mismatch'
  | 'request_actor_revision_stale'
  | 'request_actor_signature_invalid'
  | 'stored_actor_signature_invalid'
  | 'session_actor_signature_invalid'
  | 'request_actor_canonicalization_mismatch'
  | 'stored_actor_canonicalization_mismatch'
  | 'session_actor_canonicalization_mismatch'
  | 'request_actor_metadata_invalid'
  | 'stored_actor_metadata_invalid'
  | 'session_actor_metadata_invalid'
  | 'request_actor_schema_invalid'
  | 'stored_actor_schema_invalid'
  | 'session_actor_schema_invalid'
  | 'assertion_signature_invalid'
  | 'reauth_token_missing'
  | 'reauth_token_actor_mismatch'
  | 'csrf_token_mismatch'
  | 'actor_assertion_packet_mismatch'
  | 'actor_assertion_key_inactive'
  | 'identity_bundle_missing'
  | 'sign_in_required'
  | 'locality_claim_required'
  | 'membership_required';

export type NexusAuthFailureDiagnostics = Record<
  string,
  string | number | boolean | null
>;

export type NexusAuthGatePayload = {
  reason: NexusAuthGateReason;
  message?: string;
  retryable?: boolean;
  actor_required?: boolean;
  write_approval_required?: boolean;
  failure_code?: NexusAuthFailureCode;
  diagnostics?: NexusAuthFailureDiagnostics;
};

export type NexusAuthFailurePayload = {
  code: NexusAuthFailureCode;
  message?: string;
  diagnostics?: NexusAuthFailureDiagnostics;
};

export class NexusAuthFailureError extends Error {
  readonly failureCode: NexusAuthFailureCode;
  readonly diagnostics: NexusAuthFailureDiagnostics | null;

  constructor(
    message: string,
    options: {
      failureCode: NexusAuthFailureCode;
      diagnostics?: NexusAuthFailureDiagnostics;
    }
  ) {
    super(message);
    this.name = 'NexusAuthFailureError';
    this.failureCode = options.failureCode;
    this.diagnostics = options.diagnostics ?? null;
  }
}

export class NexusAuthGateError extends NexusAuthFailureError {
  readonly reason: NexusAuthGateReason;
  readonly retryable: boolean;
  readonly actorRequired: boolean;
  readonly writeApprovalRequired: boolean;

  constructor(
    reason: NexusAuthGateReason,
    message: string,
    options?: {
      retryable?: boolean;
      actorRequired?: boolean;
      writeApprovalRequired?: boolean;
      failureCode?: NexusAuthFailureCode;
      diagnostics?: NexusAuthFailureDiagnostics;
    }
  ) {
    super(message, {
      failureCode:
        options?.failureCode ??
        (reason === 'sign_in_required'
          ? 'sign_in_required'
          : reason === 'community_claim_required'
            ? 'membership_required'
            : reason === 'stale_actor_packet'
              ? 'session_actor_mismatch'
              : reason === 'session_refresh_required'
                ? 'session_expired'
                : reason === 'write_approval_required'
                  ? 'reauth_token_missing'
                  : 'identity_bundle_missing'),
      diagnostics: options?.diagnostics,
    });
    this.name = 'NexusAuthGateError';
    this.reason = reason;
    this.retryable = options?.retryable ?? true;
    this.actorRequired = options?.actorRequired ?? false;
    this.writeApprovalRequired = options?.writeApprovalRequired ?? false;
  }
}

export function createNexusAuthGatePayload(
  error: NexusAuthGateError
): NexusAuthGatePayload {
  const diagnostics =
    process.env.NODE_ENV !== 'production'
      ? error.diagnostics ?? undefined
      : undefined;

  return {
    reason: error.reason,
    message: error.message,
    retryable: error.retryable,
    actor_required: error.actorRequired,
    write_approval_required: error.writeApprovalRequired,
    failure_code: error.failureCode,
    diagnostics,
  };
}

export function createNexusAuthFailurePayload(
  error: NexusAuthFailureError
): NexusAuthFailurePayload {
  const diagnostics =
    process.env.NODE_ENV !== 'production'
      ? error.diagnostics ?? undefined
      : undefined;

  return {
    code: error.failureCode,
    message: error.message,
    diagnostics,
  };
}

export function isNexusAuthFailureError(
  error: unknown
): error is NexusAuthFailureError {
  return (
    error instanceof Error &&
    (error.name === 'NexusAuthFailureError' ||
      error.name === 'NexusAuthGateError') &&
    typeof (error as { failureCode?: unknown }).failureCode === 'string'
  );
}

export function isNexusAuthGateError(
  error: unknown
): error is NexusAuthGateError {
  return (
    error instanceof Error &&
    error.name === 'NexusAuthGateError' &&
    typeof (error as { reason?: unknown }).reason === 'string'
  );
}

export function isNexusAuthGatePayload(
  payload: unknown
): payload is { auth_gate: NexusAuthGatePayload; error?: string } {
  if (!payload || typeof payload !== 'object') {
    return false;
  }

  const authGate = (payload as { auth_gate?: unknown }).auth_gate;

  if (!authGate || typeof authGate !== 'object') {
    return false;
  }

  return typeof (authGate as { reason?: unknown }).reason === 'string';
}
