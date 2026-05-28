/**
 * File: nexus-packet-search.ts
 * Description: Builds grouped Packet Explorer search results over the shared packet search index.
 */

import type { NexusPacketVerificationSummary } from '@core/contracts';
import type {
  NexusPacketExplorerSearchActiveGroup,
  NexusPacketExplorerSearchGroup,
  NexusPacketExplorerSearchGroupKey,
  NexusPacketExplorerSearchMatchType,
  NexusPacketExplorerSearchPayload,
  NexusPacketExplorerSearchRequest,
  NexusPacketExplorerSearchResultRow,
} from '@runtime/nexus/nexus-api-types';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';
import type { PacketSearchIndexRecord } from '@runtime/storage/sqlite-records';
import type { PacketType } from '@core/schema/packet-schema';
import { trustedProjectionCoordinator } from '@runtime/trusted_coordinators/trusted_projection_coordinator/index.ts';

type PacketSearchServices = Pick<NexusPacketServices, 'packetStore'>;

const DEFAULT_PREVIEW_LIMIT = 8;
const DEFAULT_CATEGORY_PAGE_SIZE = 25;
const DEFAULT_PAGE_NUMBER = 1;
const MAX_GROUP_RESULT_LIMIT = 25;

const SEARCH_GROUP_LABELS: Record<NexusPacketExplorerSearchGroupKey, string> = {
  direct: 'Direct matches',
  name: 'Name matches',
  text: 'Text matches',
};

type RankedSearchCandidate = NexusPacketExplorerSearchResultRow;

function trimOptionalString(value: string | null | undefined): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function normalizeText(value: string | null | undefined): string {
  return trimOptionalString(value)?.toLowerCase() ?? '';
}

function parseJsonStringArray(input: string): string[] {
  try {
    const parsed = JSON.parse(input) as unknown;

    if (!Array.isArray(parsed)) {
      return [];
    }

    return parsed.filter((value): value is string => typeof value === 'string');
  } catch {
    return [];
  }
}

function isIdentifierLikeQuery(query: string): boolean {
  return query.includes(':') || query.includes('@') || query.includes('/');
}

function sanitizeLimitPerGroup(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PREVIEW_LIMIT;
  }

  return Math.max(1, Math.min(MAX_GROUP_RESULT_LIMIT, Math.floor(value)));
}

function sanitizeSearchActiveGroup(
  value: unknown
): NexusPacketExplorerSearchActiveGroup {
  return value === 'direct' || value === 'name' || value === 'text' ? value : 'all';
}

function sanitizePageNumber(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_PAGE_NUMBER;
  }

  return Math.max(1, Math.floor(value));
}

function sanitizePageSize(value: number | null | undefined): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return DEFAULT_CATEGORY_PAGE_SIZE;
  }

  return Math.max(1, Math.min(MAX_GROUP_RESULT_LIMIT, Math.floor(value)));
}


function getFreshVerificationSummaryForSearchRow(
  row: PacketSearchIndexRecord,
  verificationByPacketId: Map<string, NexusPacketVerificationSummary>
): NexusPacketVerificationSummary | null {
  const verification = verificationByPacketId.get(row.packet_id) ?? null;

  if (!verification || verification.target_revision_id !== row.revision_id) {
    return null;
  }

  return verification;
}

function createSearchRow(input: {
  row: PacketSearchIndexRecord;
  matchGroup: NexusPacketExplorerSearchGroupKey;
  matchType: NexusPacketExplorerSearchMatchType;
  matchReason: string;
  score: number;
  matchedRevisionId?: string | null;
  verification?: NexusPacketVerificationSummary | null;
}): RankedSearchCandidate {
  return {
    packet_id: input.row.packet_id,
    revision_id: input.row.revision_id,
    type: input.row.type as PacketType,
    title: input.row.title,
    label: input.row.label,
    summary: input.row.summary,
    status: input.row.status,
    authority_scope_packet_id: input.row.authority_scope_packet_id,
    applicable_scope_ids: parseJsonStringArray(input.row.applicable_scope_ids_json),
    match_group: input.matchGroup,
    match_type: input.matchType,
    match_reason: input.matchReason,
    score: input.score,
    matched_revision_id: input.matchedRevisionId ?? null,
    created_at: input.row.created_at,
    verification: input.verification ?? null,
  };
}

function compareSearchRows(
  left: RankedSearchCandidate,
  right: RankedSearchCandidate
): number {
  if (left.score !== right.score) {
    return right.score - left.score;
  }

  return right.created_at.localeCompare(left.created_at);
}

function selectPreferredCandidate(input: {
  existing: RankedSearchCandidate | null;
  next: RankedSearchCandidate;
}): RankedSearchCandidate {
  if (!input.existing) {
    return input.next;
  }

  return compareSearchRows(input.existing, input.next) <= 0
    ? input.existing
    : input.next;
}

function findBestSearchCandidate(input: {
  row: PacketSearchIndexRecord;
  normalizedQuery: string;
}): RankedSearchCandidate | null {
  const packetId = normalizeText(input.row.packet_id);
  const revisionId = normalizeText(input.row.revision_id);
  const title = normalizeText(input.row.title);
  const label = normalizeText(input.row.label);
  const summary = normalizeText(input.row.summary);
  const type = normalizeText(input.row.type);
  const tags = parseJsonStringArray(input.row.tags_json).map((tag) =>
    tag.toLowerCase()
  );

  if (packetId === input.normalizedQuery) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'direct',
      matchType: 'packet_id_exact',
      matchReason: 'Matched packet ID',
      score: 1000,
    });
  }

  if (revisionId === input.normalizedQuery) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'direct',
      matchType: 'revision_id_exact',
      matchReason: 'Matched preferred revision ID',
      score: 950,
      matchedRevisionId: input.row.revision_id,
    });
  }

  if (packetId.startsWith(input.normalizedQuery)) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'direct',
      matchType: 'packet_id_prefix',
      matchReason: 'Matched packet ID prefix',
      score: 850,
    });
  }

  if (revisionId.startsWith(input.normalizedQuery)) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'direct',
      matchType: 'revision_id_prefix',
      matchReason: 'Matched preferred revision ID prefix',
      score: 825,
      matchedRevisionId: input.row.revision_id,
    });
  }

  if (title === input.normalizedQuery) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'name',
      matchType: 'title_exact',
      matchReason: 'Matched title',
      score: 750,
    });
  }

  if (label === input.normalizedQuery) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'name',
      matchType: 'label_exact',
      matchReason: 'Matched label',
      score: 740,
    });
  }

  if (title.includes(input.normalizedQuery)) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'name',
      matchType: 'title_contains',
      matchReason: 'Matched title',
      score: 700,
    });
  }

  if (label.includes(input.normalizedQuery)) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'name',
      matchType: 'label_contains',
      matchReason: 'Matched label',
      score: 680,
    });
  }

  if (tags.some((tag) => tag.includes(input.normalizedQuery))) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'text',
      matchType: 'tag_contains',
      matchReason: 'Matched tag',
      score: 575,
    });
  }

  if (summary.includes(input.normalizedQuery)) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'text',
      matchType: 'summary_contains',
      matchReason: 'Matched summary',
      score: 550,
    });
  }

  if (type.includes(input.normalizedQuery)) {
    return createSearchRow({
      row: input.row,
      matchGroup: 'text',
      matchType: 'type_contains',
      matchReason: 'Matched type',
      score: 500,
    });
  }

  return null;
}


function projectSearchCandidates(
  candidates: RankedSearchCandidate[]
): RankedSearchCandidate[] {
  const projection = trustedProjectionCoordinator.resolvePacketCardListProjection({
    cards: candidates.map((candidate) => ({
      packet: { packet_id: candidate.packet_id },
      revision: {
        packet_id: candidate.packet_id,
        revision_id: candidate.revision_id,
      },
      type: candidate.type,
      title: candidate.title,
      label: candidate.label,
      summary: candidate.summary,
      status: candidate.status,
      created_at: candidate.created_at,
      verification: candidate.verification,
      authority_scope_packet_id: candidate.authority_scope_packet_id,
      applicable_scope_ids: candidate.applicable_scope_ids,
    })),
    target_surface: 'packet_explorer_search',
    context_mode: 'normal_runtime',
  }).value;

  if (!projection) {
    return candidates;
  }

  return projection.items.map((item, index) => {
    const sourceCandidate = candidates[index];

    return {
      ...sourceCandidate,
      packet_id: item.packet_ref.packet_id,
      revision_id: item.revision_ref.revision_id,
      type: item.packet_type as PacketType,
      title: item.title,
      label: item.label,
      summary: item.summary,
      status: item.status,
      created_at: item.created_at,
    };
  });
}

function buildGroupedPayload(input: {
  query: string;
  activeGroup: NexusPacketExplorerSearchActiveGroup;
  limitPerGroup: number;
  page: number;
  pageSize: number;
  candidates: RankedSearchCandidate[];
}): NexusPacketExplorerSearchPayload {
  const groups = (['direct', 'name', 'text'] as const).map((groupKey) => {
    const groupResults = input.candidates
      .filter((candidate) => candidate.match_group === groupKey)
      .sort(compareSearchRows);
    const usePagedResults = input.activeGroup === groupKey;
    const groupPageSize = usePagedResults ? input.pageSize : input.limitPerGroup;
    const totalPages = Math.max(1, Math.ceil(groupResults.length / groupPageSize));
    const currentPage = usePagedResults
      ? Math.min(input.page, totalPages)
      : DEFAULT_PAGE_NUMBER;
    const offset = usePagedResults ? (currentPage - 1) * groupPageSize : 0;
    const results = groupResults.slice(offset, offset + groupPageSize);

    return {
      key: groupKey,
      label: SEARCH_GROUP_LABELS[groupKey],
      count: groupResults.length,
      truncated: usePagedResults
        ? currentPage < totalPages
        : groupResults.length > input.limitPerGroup,
      current_page: currentPage,
      page_size: groupPageSize,
      total_pages: totalPages,
      results,
    } satisfies NexusPacketExplorerSearchGroup;
  });

  return {
    query: input.query,
    active_group: input.activeGroup,
    page: input.activeGroup === 'all' ? DEFAULT_PAGE_NUMBER : input.page,
    page_size: input.activeGroup === 'all' ? input.limitPerGroup : input.pageSize,
    scope_mode: 'all_known',
    limit_per_group: input.limitPerGroup,
    total_result_count: groups.reduce((sum, group) => sum + group.count, 0),
    groups,
  };
}

export function parseNexusPacketExplorerSearchRequest(
  input: unknown
): NexusPacketExplorerSearchRequest {
  if (!input || typeof input !== 'object') {
    throw new Error('Explorer search requests must use a JSON object body.');
  }

  const candidate = input as Record<string, unknown>;
  const query = trimOptionalString(
    typeof candidate.query === 'string' ? candidate.query : null
  );

  if (!query) {
    throw new Error('Enter a packet clue before searching.');
  }

  if (!isIdentifierLikeQuery(query) && query.length < 2) {
    throw new Error('Search text must be at least 2 characters long.');
  }

  return {
    query,
    limit_per_group:
      typeof candidate.limit_per_group === 'number'
        ? candidate.limit_per_group
        : null,
    active_group: sanitizeSearchActiveGroup(candidate.active_group),
    page:
      typeof candidate.page === 'number'
        ? candidate.page
        : null,
    page_size:
      typeof candidate.page_size === 'number'
        ? candidate.page_size
        : null,
    scope_mode: 'all_known',
    selected_packet_id:
      typeof candidate.selected_packet_id === 'string'
        ? candidate.selected_packet_id
        : null,
  };
}

export async function buildNexusPacketExplorerSearchPayload(input: {
  services: PacketSearchServices;
  requestBody: NexusPacketExplorerSearchRequest;
}): Promise<NexusPacketExplorerSearchPayload> {
  const query = trimOptionalString(input.requestBody.query);

  if (!query) {
    throw new Error('Enter a packet clue before searching.');
  }

  const limitPerGroup = sanitizeLimitPerGroup(
    input.requestBody.limit_per_group ?? null
  );
  const activeGroup = sanitizeSearchActiveGroup(input.requestBody.active_group);
  const page = sanitizePageNumber(input.requestBody.page ?? null);
  const pageSize = sanitizePageSize(input.requestBody.page_size ?? null);
  const normalizedQuery = normalizeText(query);
  const [searchRows, verificationSummaries] = await Promise.all([
    input.services.packetStore.listSearchRows(),
    input.services.packetStore.listPacketVerificationSummaries(),
  ]);
  const verificationByPacketId = new Map(
    verificationSummaries.map((summary) => [summary.packet_id, summary] as const)
  );
  const rowsByPacketId = new Map(
    searchRows.map((row) => [row.packet_id, row] as const)
  );
  const candidatesByPacketId = new Map<string, RankedSearchCandidate>();

  for (const row of searchRows) {
    const nextCandidate = findBestSearchCandidate({
      row,
      normalizedQuery,
    });

    if (!nextCandidate) {
      continue;
    }

    nextCandidate.verification = getFreshVerificationSummaryForSearchRow(row, verificationByPacketId);

    candidatesByPacketId.set(
      row.packet_id,
      selectPreferredCandidate({
        existing: candidatesByPacketId.get(row.packet_id) ?? null,
        next: nextCandidate,
      })
    );
  }

  const resolvedRevisionRef =
    typeof input.services.packetStore.resolveRevisionRef === 'function'
      ? await input.services.packetStore.resolveRevisionRef(query)
      : null;

  if (resolvedRevisionRef) {
    const searchRow = rowsByPacketId.get(resolvedRevisionRef.packet_id) ?? null;

    if (searchRow) {
      const directRevisionCandidate = createSearchRow({
        row: searchRow,
        matchGroup: 'direct',
        matchType: 'revision_id_exact',
        matchReason: 'Matched revision ID',
        score: 975,
        matchedRevisionId: resolvedRevisionRef.revision_id,
        verification: getFreshVerificationSummaryForSearchRow(searchRow, verificationByPacketId),
      });

      candidatesByPacketId.set(
        searchRow.packet_id,
        selectPreferredCandidate({
          existing: candidatesByPacketId.get(searchRow.packet_id) ?? null,
          next: directRevisionCandidate,
        })
      );
    }
  }

  const projectedCandidates = projectSearchCandidates(
    Array.from(candidatesByPacketId.values())
  );

  return buildGroupedPayload({
    query,
    activeGroup,
    limitPerGroup,
    page,
    pageSize,
    candidates: projectedCandidates,
  });
}

export async function getNexusPacketExplorerSearchPayload(
  requestBody: NexusPacketExplorerSearchRequest
): Promise<NexusPacketExplorerSearchPayload> {
  const { getNexusPacketServices } = await import(
    '@runtime/nexus/server/nexus-packet-services'
  );
  const services = await getNexusPacketServices();

  return buildNexusPacketExplorerSearchPayload({
    services,
    requestBody,
  });
}
