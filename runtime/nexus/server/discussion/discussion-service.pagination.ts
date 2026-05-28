/**
 * File: discussion-service.pagination.ts
 * Description: Cursor and page-size helpers for the SQLite discussion service.
 */

function parseCursorOffset(cursor: string | null | undefined): number {
  if (!cursor) {
    return 0;
  }

  const parsedValue = Number.parseInt(cursor, 10);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) {
    return 0;
  }

  return parsedValue;
}

export function resolvePageSize(
  requestedLimit: number | null | undefined,
  defaultLimit: number,
  maxLimit: number
): number {
  if (
    typeof requestedLimit !== 'number' ||
    !Number.isFinite(requestedLimit) ||
    requestedLimit <= 0
  ) {
    return defaultLimit;
  }

  return Math.min(Math.trunc(requestedLimit), maxLimit);
}

export function paginateItems<T>(input: {
  items: T[];
  cursor: string | null | undefined;
  limit: number;
}): {
  items: T[];
  next_cursor: string | null;
  has_more: boolean;
} {
  const offset = parseCursorOffset(input.cursor);
  const pageItems = input.items.slice(offset, offset + input.limit);
  const nextOffset = offset + pageItems.length;
  const hasMore = nextOffset < input.items.length;

  return {
    items: pageItems,
    next_cursor: hasMore ? String(nextOffset) : null,
    has_more: hasMore,
  };
}
