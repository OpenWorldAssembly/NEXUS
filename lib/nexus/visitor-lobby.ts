/**
 * File: visitor-lobby.ts
 * Description: Defines visitor-lobby bundle types, canonical packet parsing, and repository contracts for the Nexus MVP.
 */
import { z } from 'zod';

import {
  createDiscussionPostPacket,
  createDiscussionThreadPacket,
  createPacketRef,
  createTextExcerpt,
} from '@/domain/packets/builders';
import {
  parsePacketEnvelope,
  type PacketEnvelopeByType,
  type PacketHeader,
  type PacketRef,
} from '@/domain/schema/packet-schema';

export const VISITOR_LOBBY_BUNDLE_VERSION = 2;
export const VISITOR_LOBBY_SESSION_ADAPTER = 'anonymous-session';
export const VISITOR_LOBBY_SESSION_REF_TYPE = 'visitor_lobby_session';

const VisitorLobbyBundleEnvelopeSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(VISITOR_LOBBY_BUNDLE_VERSION)]),
    updated_at: z.string().min(1),
    threads: z.array(z.unknown()).default([]),
    posts: z.array(z.unknown()).default([]),
  })
  .strict();

const VisitorLobbyFeedEnvelopeSchema = z
  .object({
    thread: z.unknown(),
    posts: z.array(z.unknown()),
  })
  .strict();

const VisitorLobbyPostEnvelopeSchema = z
  .object({
    post: z.unknown(),
  })
  .strict();

const LegacyVisitorLobbyPacketRefSchema = z
  .object({
    packet_id: z.string().min(1),
  })
  .strict();

const LegacyVisitorLobbyProducerSchema = z
  .object({
    adapter: z.string().min(1),
    author_session_id: z.string().min(1).nullable().default(null),
    author_label: z.string().min(1).nullable().default(null),
    app_version: z.string().min(1).nullable().default(null),
  })
  .strict();

const LegacyVisitorLobbyMetadataSchema = z
  .object({
    summary: z.string().min(1).nullable().default(null),
    tags: z.array(z.string().min(1)).default([]),
  })
  .strict();

const LegacyVisitorLobbyHeaderSchema = z
  .object({
    packet_id: z.string().min(1),
    revision_id: z.string().min(1),
    family: z.enum(['DiscussionThread', 'DiscussionPost']),
    schema_version: z.literal('visitor-lobby-faux-v1'),
    created_at: z.string().min(1),
    authority_scope_ref: LegacyVisitorLobbyPacketRefSchema.nullable().default(null),
    applicable_scope_refs: z.array(LegacyVisitorLobbyPacketRefSchema).default([]),
    producer: LegacyVisitorLobbyProducerSchema,
    metadata: LegacyVisitorLobbyMetadataSchema,
  })
  .strict();

const LegacyVisitorLobbyThreadRecordSchema = z
  .object({
    header: LegacyVisitorLobbyHeaderSchema.extend({
      family: z.literal('DiscussionThread'),
    }),
    body: z
      .object({
        title: z.string().min(1),
        summary: z.string().min(1).nullable().default(null),
        thread_kind: z.string().min(1),
        status: z.string().min(1),
        related_refs: z.array(LegacyVisitorLobbyPacketRefSchema).default([]),
        scope_id: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const LegacyVisitorLobbyPostRecordSchema = z
  .object({
    header: LegacyVisitorLobbyHeaderSchema.extend({
      family: z.literal('DiscussionPost'),
    }),
    body: z
      .object({
        title: z.string().min(1),
        thread_ref: LegacyVisitorLobbyPacketRefSchema,
        thread_id: z.string().min(1),
        post_kind: z.string().min(1),
        content_markdown: z.string().min(1),
        reply_to_ref: LegacyVisitorLobbyPacketRefSchema.nullable().default(null),
        scope_id: z.string().min(1),
      })
      .strict(),
  })
  .strict();

const LegacyVisitorLobbyBundleSchema = z
  .object({
    version: z.literal(1),
    updated_at: z.string().min(1),
    threads: z.array(LegacyVisitorLobbyThreadRecordSchema).default([]),
    posts: z.array(LegacyVisitorLobbyPostRecordSchema).default([]),
  })
  .strict();

export const AnonymousSessionSchema = z
  .object({
    session_id: z.string().min(1),
    short_label: z.string().min(1),
    started_at: z.string().min(1),
  })
  .strict();

export const VisitorLobbyPostInputSchema = z
  .object({
    session_id: z.string().min(1),
    short_label: z.string().min(1),
    title: z.string().trim().max(160).optional().default(''),
    body: z.string().trim().min(1).max(4000),
  })
  .strict();

export type VisitorLobbyThreadRecord =
  PacketEnvelopeByType['DiscussionThread'];
export type VisitorLobbyPostRecord = PacketEnvelopeByType['DiscussionPost'];

export interface VisitorLobbyBundle {
  version: typeof VISITOR_LOBBY_BUNDLE_VERSION;
  updated_at: string;
  threads: VisitorLobbyThreadRecord[];
  posts: VisitorLobbyPostRecord[];
}

export interface VisitorLobbyPostResponse {
  post: VisitorLobbyPostRecord;
}

export type AnonymousSession = z.infer<typeof AnonymousSessionSchema>;

export interface VisitorLobbyScopeFeed {
  thread: VisitorLobbyThreadRecord;
  posts: VisitorLobbyPostRecord[];
}

export interface VisitorLobbyRepository {
  getLobby(scopeId: string): Promise<VisitorLobbyScopeFeed>;
  createLobbyPost(input: {
    scopeId: string;
    session: AnonymousSession;
    title: string;
    body: string;
  }): Promise<VisitorLobbyPostRecord>;
}

/**
 * Inputs: none.
 * Output: a new empty visitor-lobby bundle with the current update timestamp.
 */
export function createEmptyVisitorLobbyBundle(): VisitorLobbyBundle {
  return {
    version: VISITOR_LOBBY_BUNDLE_VERSION,
    updated_at: new Date().toISOString(),
    threads: [],
    posts: [],
  };
}

/**
 * Inputs: a Nexus scope id.
 * Output: the packet-like id used for a scope ref inside the visitor-lobby bundle.
 */
export function createScopePacketId(scopeId: string): string {
  return `nexus:element/${scopeId}`;
}

function normalizeScopeSlug(scopeId: string): string {
  const decodedScopeId = (() => {
    try {
      return decodeURIComponent(scopeId);
    } catch {
      return scopeId;
    }
  })();
  const canonicalScopeId = decodedScopeId.startsWith('nexus:element/')
    ? decodedScopeId.slice('nexus:element/'.length)
    : decodedScopeId;

  return canonicalScopeId.trim().toLowerCase();
}

/**
 * Inputs: a scope id.
 * Output: the stable visitor-lobby thread packet id for that scope.
 */
export function createVisitorLobbyThreadPacketId(scopeId: string): string {
  const scopeSlug = normalizeScopeSlug(scopeId);

  if (scopeSlug === 'global-commons') {
    return 'nexus:discussion-thread/global-visitor-lobby';
  }

  return `nexus:discussion-thread/${scopeSlug}-visitor-lobby`;
}

/**
 * Inputs: a scope id, creation timestamp, and random suffix.
 * Output: a unique visitor-lobby post packet id.
 */
export function createVisitorLobbyPostPacketId(
  scopeId: string,
  createdAt: string,
  suffix: string,
): string {
  const compactTimestamp = createdAt.replace(/[^0-9]/g, '').slice(0, 14);
  const scopeSlug = normalizeScopeSlug(scopeId);

  return `nexus:discussion-post/${scopeSlug}-${compactTimestamp}-${suffix}`;
}

/**
 * Inputs: a packet id.
 * Output: a packet ref object suitable for visitor-lobby scope and thread links.
 */
export function createVisitorLobbyPacketRef(packetId: string): PacketRef {
  return createPacketRef(packetId);
}

/**
 * Inputs: an anonymous browser session.
 * Output: an external ref that preserves session-scoped guest labeling without treating it as packet authorship.
 */
export function createAnonymousSessionExternalRef(
  session: AnonymousSession,
): PacketHeader['external_refs'][number] {
  return {
    adapter: VISITOR_LOBBY_SESSION_ADAPTER,
    ref_type: VISITOR_LOBBY_SESSION_REF_TYPE,
    ref_id: session.session_id,
    url: null,
    metadata: {
      short_label: session.short_label,
      started_at: session.started_at,
    },
  };
}

/**
 * Inputs: a canonical packet envelope.
 * Output: the packet narrowed to a discussion thread record.
 */
export function parseVisitorLobbyThreadRecord(
  input: unknown,
): VisitorLobbyThreadRecord {
  const packet = parsePacketEnvelope(input);

  if (packet.header.family !== 'DiscussionThread') {
    throw new Error('Visitor lobby thread must be a canonical DiscussionThread packet.');
  }

  return packet as VisitorLobbyThreadRecord;
}

/**
 * Inputs: a canonical packet envelope.
 * Output: the packet narrowed to a discussion post record.
 */
export function parseVisitorLobbyPostRecord(
  input: unknown,
): VisitorLobbyPostRecord {
  const packet = parsePacketEnvelope(input);

  if (packet.header.family !== 'DiscussionPost') {
    throw new Error('Visitor lobby post must be a canonical DiscussionPost packet.');
  }

  return packet as VisitorLobbyPostRecord;
}

/**
 * Inputs: a response payload from the visitor-lobby feed API.
 * Output: a validated visitor-lobby feed using canonical discussion packets.
 */
export function parseVisitorLobbyScopeFeed(
  input: unknown,
): VisitorLobbyScopeFeed {
  const envelope = VisitorLobbyFeedEnvelopeSchema.parse(input);

  return {
    thread: parseVisitorLobbyThreadRecord(envelope.thread),
    posts: envelope.posts.map(parseVisitorLobbyPostRecord),
  };
}

/**
 * Inputs: a response payload from the visitor-lobby post API.
 * Output: a validated visitor-lobby post response using canonical discussion packets.
 */
export function parseVisitorLobbyPostResponse(
  input: unknown,
): VisitorLobbyPostResponse {
  const envelope = VisitorLobbyPostEnvelopeSchema.parse(input);

  return {
    post: parseVisitorLobbyPostRecord(envelope.post),
  };
}

/**
 * Inputs: a visitor-lobby post packet.
 * Output: the best available anonymous label for display in the UI.
 */
export function getVisitorLobbyPostAuthorLabel(
  post: VisitorLobbyPostRecord,
): string {
  const sessionRef = post.header.external_refs.find(
    (externalRef) =>
      externalRef.adapter === VISITOR_LOBBY_SESSION_ADAPTER &&
      externalRef.ref_type === VISITOR_LOBBY_SESSION_REF_TYPE,
  );
  const shortLabel = sessionRef?.metadata.short_label;

  if (typeof shortLabel === 'string' && shortLabel.trim().length > 0) {
    return shortLabel;
  }

  return 'Anonymous guest';
}

/**
 * Inputs: legacy faux thread record.
 * Output: the migrated canonical discussion thread packet.
 */
function migrateLegacyThreadRecord(
  legacyRecord: z.infer<typeof LegacyVisitorLobbyThreadRecordSchema>,
): VisitorLobbyThreadRecord {
  return createDiscussionThreadPacket({
    packet_id: legacyRecord.header.packet_id,
    revision_id: legacyRecord.header.revision_id,
    created_at: legacyRecord.header.created_at,
    authority_scope_ref: legacyRecord.header.authority_scope_ref,
    applicable_scope_refs: legacyRecord.header.applicable_scope_refs,
    adapter: legacyRecord.header.producer.adapter,
    app_version: legacyRecord.header.producer.app_version,
    metadata_tags: legacyRecord.header.metadata.tags,
    metadata_summary: legacyRecord.header.metadata.summary,
    title: legacyRecord.body.title,
    summary: legacyRecord.body.summary,
    thread_kind: legacyRecord.body.thread_kind,
    status: legacyRecord.body.status,
    related_refs: legacyRecord.body.related_refs,
  });
}

/**
 * Inputs: legacy faux post record.
 * Output: the migrated canonical discussion post packet.
 */
function migrateLegacyPostRecord(
  legacyRecord: z.infer<typeof LegacyVisitorLobbyPostRecordSchema>,
): VisitorLobbyPostRecord {
  const externalRefs =
    legacyRecord.header.producer.author_session_id === null
      ? []
      : [
          {
            adapter: VISITOR_LOBBY_SESSION_ADAPTER,
            ref_type: VISITOR_LOBBY_SESSION_REF_TYPE,
            ref_id: legacyRecord.header.producer.author_session_id,
            url: null,
        metadata: {
          short_label: legacyRecord.header.producer.author_label,
        },
          } satisfies PacketHeader['external_refs'][number],
        ];

  return createDiscussionPostPacket({
    packet_id: legacyRecord.header.packet_id,
    revision_id: legacyRecord.header.revision_id,
    created_at: legacyRecord.header.created_at,
    authority_scope_ref: legacyRecord.header.authority_scope_ref,
    applicable_scope_refs: legacyRecord.header.applicable_scope_refs,
    adapter: legacyRecord.header.producer.adapter,
    app_version: legacyRecord.header.producer.app_version,
    metadata_tags: legacyRecord.header.metadata.tags,
    metadata_summary: legacyRecord.header.metadata.summary,
    external_refs: externalRefs,
    title: legacyRecord.body.title,
    thread_ref: legacyRecord.body.thread_ref,
    post_kind: legacyRecord.body.post_kind,
    content_markdown: legacyRecord.body.content_markdown,
    reply_to_ref: legacyRecord.body.reply_to_ref,
  });
}

/**
 * Inputs: raw legacy bundle data.
 * Output: the bundle migrated into canonical discussion packets.
 */
function migrateLegacyVisitorLobbyBundle(
  input: unknown,
): VisitorLobbyBundle {
  const legacyBundle = LegacyVisitorLobbyBundleSchema.parse(input);

  return {
    version: VISITOR_LOBBY_BUNDLE_VERSION,
    updated_at: legacyBundle.updated_at,
    threads: legacyBundle.threads.map(migrateLegacyThreadRecord),
    posts: legacyBundle.posts.map(migrateLegacyPostRecord),
  };
}

/**
 * Inputs: raw bundle data from disk or an API boundary.
 * Output: a canonical visitor-lobby bundle, migrating the old faux schema when necessary.
 */
export function parseVisitorLobbyBundle(input: unknown): VisitorLobbyBundle {
  const envelope = VisitorLobbyBundleEnvelopeSchema.parse(input);

  if (envelope.version === 1) {
    return migrateLegacyVisitorLobbyBundle(input);
  }

  return {
    version: VISITOR_LOBBY_BUNDLE_VERSION,
    updated_at: envelope.updated_at,
    threads: envelope.threads.map(parseVisitorLobbyThreadRecord),
    posts: envelope.posts.map(parseVisitorLobbyPostRecord),
  };
}

/**
 * Inputs: markdown or plain text plus an optional max length.
 * Output: a compact excerpt for visitor-lobby metadata summaries.
 */
export function createVisitorLobbyExcerpt(
  content: string,
  maxLength = 140,
): string {
  return createTextExcerpt(content, maxLength);
}
