/**
 * File: nexus-query-api.shared.ts
 * Description: Shared client-side fetch helpers for Nexus query and mutation APIs.
 */

import {
  isNexusAuthGatePayload,
  NexusAuthGateError,
} from '@runtime/nexus/nexus-auth-gate-error';

export class NexusApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(input: { message: string; status: number; payload: unknown }) {
    super(input.message);
    this.status = input.status;
    this.payload = input.payload;
  }
}

async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const parsedError = (await response.json()) as { error?: string };

    if (parsedError.error) {
      return parsedError.error;
    }
  } catch {
    // Fallback to status text below when the body is not JSON.
  }

  return response.statusText || 'Nexus query request failed.';
}

export async function fetchJsonOrThrow<TPayload>(
  path: string,
  init?: RequestInit
): Promise<TPayload> {
  const response = await fetch(path, init);

  if (!response.ok) {
    let payload: unknown = null;

    try {
      payload = await response.clone().json();
    } catch {
      payload = null;
    }

    if (isNexusAuthGatePayload(payload)) {
      throw new NexusAuthGateError(
        payload.auth_gate.reason,
        payload.auth_gate.message ??
          (await readApiErrorMessage(response)),
        {
          retryable: payload.auth_gate.retryable,
          actorRequired: payload.auth_gate.actor_required,
          writeApprovalRequired: payload.auth_gate.write_approval_required,
          failureCode: payload.auth_gate.failure_code,
          diagnostics: payload.auth_gate.diagnostics,
        }
      );
    }

    throw new NexusApiError({
      message: await readApiErrorMessage(response),
      status: response.status,
      payload,
    });
  }

  return (await response.json()) as TPayload;
}

export async function fetchMutationJsonOrThrow<TPayload>(input: {
  path: string;
  method: 'POST' | 'PUT';
  body: unknown;
  headers?: Record<string, string>;
  signal?: AbortSignal;
}): Promise<TPayload> {
  const response = await fetch(input.path, {
    method: input.method,
    headers: {
      'content-type': 'application/json',
      ...(input.headers ?? {}),
    },
    body: JSON.stringify(input.body),
    signal: input.signal,
  });

  if (!response.ok) {
    let payload: unknown = null;

    try {
      payload = await response.clone().json();
    } catch {
      payload = null;
    }

    if (isNexusAuthGatePayload(payload)) {
      throw new NexusAuthGateError(
        payload.auth_gate.reason,
        payload.auth_gate.message ??
          (await readApiErrorMessage(response)),
        {
          retryable: payload.auth_gate.retryable,
          actorRequired: payload.auth_gate.actor_required,
          writeApprovalRequired: payload.auth_gate.write_approval_required,
          failureCode: payload.auth_gate.failure_code,
          diagnostics: payload.auth_gate.diagnostics,
        }
      );
    }

    throw new NexusApiError({
      message: await readApiErrorMessage(response),
      status: response.status,
      payload,
    });
  }

  return (await response.json()) as TPayload;
}
