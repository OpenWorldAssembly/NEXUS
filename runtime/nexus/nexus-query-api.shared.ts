/**
 * File: nexus-query-api.shared.ts
 * Description: Shared client-side fetch helpers for Nexus query and mutation APIs.
 */

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
    throw new Error(await readApiErrorMessage(response));
  }

  return (await response.json()) as TPayload;
}

export async function fetchMutationJsonOrThrow<TPayload>(input: {
  path: string;
  method: 'POST' | 'PUT';
  body: unknown;
}): Promise<TPayload> {
  const response = await fetch(input.path, {
    method: input.method,
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify(input.body),
  });

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return (await response.json()) as TPayload;
}
