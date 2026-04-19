/**
 * File: location-search+api.ts
 * Description: Serves canonical Nexus location matches for identity disclosure forms.
 */

import type { RequestHandler } from 'expo-router/server';
import { z } from 'zod';

import { createLocalityCanonicalNameKey } from '@runtime/nexus/location-search-normalization';
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
    const canonicalQueryKey = createLocalityCanonicalNameKey(parsedQuery.query);
    const hasExactResult = results.some(
      (result) => result.canonical_name_key === canonicalQueryKey
    );

    return createJsonResponse({
      query: parsedQuery.query,
      results,
      create_candidate:
        canonicalQueryKey.length >= 2 && !hasExactResult
          ? {
              query: parsedQuery.query,
              canonical_name_key: canonicalQueryKey,
              label: 'Location not found in Nexus directory. Create it?',
              description:
                'Nexus can create canonical locality Elements from a confirmed parent path. No third-party geocoder is used in this phase.',
            }
          : null,
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'Unable to search locations.';

    return createJsonResponse({ error: message }, 400);
  }
};
