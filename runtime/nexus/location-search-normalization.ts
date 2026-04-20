/**
 * Inputs: human-entered locality text.
 * Output: a punctuation-insensitive key for canonical locality search.
 */
export function normalizeLocalitySearchText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/['\u2019]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export type LocalitySearchLevel = 'nation' | 'region' | 'city' | 'district';

export function matchesLocalitySearchScopeFilter(
  locality: {
    level: LocalitySearchLevel;
    parent_packet_id: string | null;
  },
  filters: {
    level?: LocalitySearchLevel | null;
    parentScopeId?: string | null;
  }
): boolean {
  if (filters.level && locality.level !== filters.level) {
    return false;
  }

  if (filters.parentScopeId && locality.parent_packet_id !== filters.parentScopeId) {
    return false;
  }

  return true;
}

export function createLocalityCanonicalNameKey(value: string): string {
  return normalizeLocalitySearchText(value);
}

export function toLocalitySearchLevel(
  subtype: string | null | undefined
): LocalitySearchLevel | null {
  if (subtype === 'nation') {
    return 'nation';
  }

  if (subtype === 'state' || subtype === 'region') {
    return 'region';
  }

  if (subtype === 'city') {
    return 'city';
  }

  if (subtype === 'district' || subtype === 'neighborhood') {
    return 'district';
  }

  return null;
}

export function getLocalitySearchMatchScore(input: {
  query: string;
  searchableValues: string[];
}): number | null {
  const queryKey = normalizeLocalitySearchText(input.query);
  const searchableKeys = input.searchableValues.map(normalizeLocalitySearchText);
  const queryTokens = queryKey.split(' ').filter(Boolean);

  if (searchableKeys.some((field) => field === queryKey)) {
    return 0;
  }

  if (searchableKeys.some((field) => field.startsWith(queryKey))) {
    return 1;
  }

  if (searchableKeys.some((field) => field.includes(queryKey))) {
    return 2;
  }

  if (
    queryTokens.length > 0 &&
    queryTokens.every((token) =>
      searchableKeys.some((field) => field.split(' ').some((word) => word.startsWith(token)))
    )
  ) {
    return 3;
  }

  return null;
}

export function getLocalityFuzzySimilarity(left: string, right: string): number {
  const leftTokens = new Set(normalizeLocalitySearchText(left).split(' ').filter(Boolean));
  const rightTokens = new Set(normalizeLocalitySearchText(right).split(' ').filter(Boolean));

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0;
  }

  let sharedCount = 0;

  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      sharedCount += 1;
      continue;
    }

    if (
      Array.from(rightTokens).some(
        (candidate) => candidate.startsWith(token) || token.startsWith(candidate)
      )
    ) {
      sharedCount += 0.5;
    }
  }

  return sharedCount / Math.max(leftTokens.size, rightTokens.size);
}
