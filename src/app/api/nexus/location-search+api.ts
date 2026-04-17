/**
 * File: location-search+api.ts
 * Description: Serves canonical Nexus location matches for identity disclosure forms.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { searchNexusLocations } from '@runtime/nexus/server/location-search-service';

const SearchLocationQuerySchema = z.object({
  query: z.string().trim().max(120).default(''),
});

function createJsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json',
    },
  });
}

/**
 * Inputs: a search query string.
 * Output: canonical Nexus location matches for identity disclosure selection.
 */
export const GET: RequestHandler = async (request) => {
  try {
    const requestUrl = new URL(request.url);
    const parsedQuery = SearchLocationQuerySchema.parse({
      query: requestUrl.searchParams.get('query') ?? '',
    });
    const results = await searchNexusLocations(parsedQuery.query);

    return createJsonResponse({
      query: parsedQuery.query,
      results,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to search locations.';

    return createJsonResponse({ error: message }, 400);
  }
};
