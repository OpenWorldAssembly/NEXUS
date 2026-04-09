/**
 * File: visitor-lobby-api.ts
 * Description: Provides client-side helpers for reading and writing the Nexus visitor-lobby API routes.
 */
import {
  parseVisitorLobbyPostResponse,
  parseVisitorLobbyScopeFeed,
  type AnonymousSession,
  type VisitorLobbyPostRecord,
  type VisitorLobbyScopeFeed,
} from '@/lib/nexus/visitor-lobby';

/**
 * Inputs: a failed fetch response.
 * Output: a readable error message from the API response body when available.
 */
async function readApiErrorMessage(response: Response): Promise<string> {
  try {
    const parsedError = (await response.json()) as { error?: string };

    if (parsedError.error) {
      return parsedError.error;
    }
  } catch {
    // Fall back to the status text below when the body is not JSON.
  }

  return response.statusText || 'Visitor lobby request failed.';
}

/**
 * Inputs: a scope id string.
 * Output: the current visitor-lobby thread and saved posts for that scope.
 */
export async function fetchVisitorLobbyFeed(
  scopeId: string,
): Promise<VisitorLobbyScopeFeed> {
  const response = await fetch(
    `/api/nexus/scopes/${encodeURIComponent(scopeId)}/visitor-lobby`,
  );

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  return parseVisitorLobbyScopeFeed(await response.json());
}

/**
 * Inputs: a scope id, anonymous session, and post content.
 * Output: the saved visitor-lobby post returned by the API.
 */
export async function createVisitorLobbyPost(input: {
  scopeId: string;
  session: AnonymousSession;
  title: string;
  body: string;
}): Promise<VisitorLobbyPostRecord> {
  const response = await fetch(
    `/api/nexus/scopes/${encodeURIComponent(input.scopeId)}/visitor-lobby/posts`,
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        session_id: input.session.session_id,
        short_label: input.session.short_label,
        title: input.title,
        body: input.body,
      }),
    },
  );

  if (!response.ok) {
    throw new Error(await readApiErrorMessage(response));
  }

  const parsedResponse = parseVisitorLobbyPostResponse(await response.json());

  return parsedResponse.post;
}
