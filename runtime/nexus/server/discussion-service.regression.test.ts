import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createAssemblyPacket,
  createDiscussionForumPacket,
  createDiscussionPacket,
  createDiscussionPostPacket,
  createDiscussionReplyPacket,
  createDiscussionSpacePacket,
  createDiscussionThreadPacket,
} from '@core/packets/builders';
import { createCanonicalDiscussionMirrorPacket } from '@core/packets/discussion-compat';
import { createPersonIdentityPacket } from '@core/packets/identity';
import type { MutationProofBundle } from '@core/auth/proof-types';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

import { SQLiteAttestationService } from './attestation-service.ts';
import { SQLiteDiscussionService } from './discussion-service.ts';

const SCOPE_PACKET_ID = 'nexus:element/global-commons';
const SCOPE_ROUTE_ID = 'global-commons';

async function writePreferredPacket(
  packetStore: NodeSQLitePacketStore,
  packet: PacketEnvelope
) {
  await packetStore.writeRevision(packet);
  await packetStore.publishRevision({
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  });
}

async function createSignedGuestActor(input: {
  alias: string;
  packetId: string;
  createdAt?: string;
}): Promise<{
  actorPacket: PacketEnvelopeByType['Element'];
  privateJwk: JsonWebKey;
}> {
  const createdAt = input.createdAt ?? '2026-04-28T00:00:00.000Z';
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: createdAt,
  });
  const actorPacket = createPersonIdentityPacket({
    alias: input.alias,
    claimStatus: 'ephemeral_guest',
    publicKeyBinding: keyBinding,
    createdAt,
    packetId: input.packetId,
  });

  return {
    actorPacket: await signPacketWithIdentity({
      packet: actorPacket,
      signerPacketId: actorPacket.header.packet_id,
      kid: keyBinding.kid,
      privateKey: keyPair.privateKey,
      signedAt: createdAt,
    }),
    privateJwk: exportedKeys.privateJwk,
  };
}

async function signPacketForActor<TPacket extends PacketEnvelope>(
  packet: TPacket,
  actorPacket: PacketEnvelopeByType['Element'],
  privateJwk: JsonWebKey
): Promise<TPacket> {
  return signPacketWithIdentity({
    packet,
    signerPacketId: actorPacket.header.packet_id,
    kid:
      actorPacket.body.identity?.public_key_bindings[0]?.kid ??
      (() => {
        throw new Error('Missing actor key binding.');
      })(),
    privateKey: await importPrivateKeyFromJwk(privateJwk),
    signedAt: packet.header.created_at,
  });
}

function createGuestProofBundle(
  actorPacket: PacketEnvelopeByType['Element']
): MutationProofBundle {
  return {
    actor_packet_id: actorPacket.header.packet_id,
    is_claimed_identity: false,
    has_actor_assertion: true,
    has_claimed_session: false,
    has_unlocked_identity: true,
    has_recent_reauth: false,
    has_passkey_confirmation: false,
    proof_methods: ['bundle_unlocked'],
  };
}

function createDiscussionHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'owa-discussion-regression-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-discussion.db'),
  });
  const attestationService = new SQLiteAttestationService(packetStore);
  const discussionService = new SQLiteDiscussionService(
    packetStore,
    attestationService
  );

  return {
    packetStore,
    discussionService,
    cleanup() {
      packetStore.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

async function seedVisitorLobbyContext(packetStore: NodeSQLitePacketStore) {
  const assemblyPacket = createAssemblyPacket({
    packet_id: SCOPE_PACKET_ID,
    created_at: '2026-04-28T00:00:00.000Z',
    name: 'Global Commons',
    subtype: 'global',
    summary: 'Global Commons scope.',
  });
  const legacySpacePacket = createDiscussionSpacePacket({
    packet_id: 'nexus:discussion-space/global-commons',
    created_at: '2026-04-28T00:00:00.000Z',
    authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
    applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
    title: 'Global Commons discussions',
    scope_ref: { packet_id: SCOPE_PACKET_ID },
    status: 'open',
  });
  const legacyForumPacket = createDiscussionForumPacket({
    packet_id: 'nexus:discussion-forum/global-commons-visitor-lobby',
    created_at: '2026-04-28T00:00:00.000Z',
    authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
    applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
    title: 'Global Commons visitor lobby',
    summary: 'Signed guest posting',
    discussion_space_ref: { packet_id: legacySpacePacket.header.packet_id },
    forum_kind: 'visitor_lobby',
    status: 'open',
  });
  const canonicalSpacePacket = createCanonicalDiscussionMirrorPacket(
    legacySpacePacket
  );
  const canonicalForumPacket = createCanonicalDiscussionMirrorPacket(
    legacyForumPacket
  );

  const packetsById = new Map(
    [
      assemblyPacket,
      legacySpacePacket,
      legacyForumPacket,
      canonicalSpacePacket,
      canonicalForumPacket,
    ].map((packet) => [packet.header.packet_id, packet])
  );

  for (const packet of packetsById.values()) {
    await writePreferredPacket(packetStore, packet);
  }

  return {
    legacyForumPacket,
    canonicalForumPacket,
  };
}

test('guest top-level canonical posts stay visible and navigable under a legacy visitor-lobby forum', async () => {
  const harness = createDiscussionHarness();

  try {
    const { legacyForumPacket, canonicalForumPacket } =
      await seedVisitorLobbyContext(harness.packetStore);
    const guestActor = await createSignedGuestActor({
      alias: 'Guest 9DRW',
      packetId: 'nexus:element/guest-9drw',
    });
    const topicPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/topic/global-commons-visitor-lobby-topic-1',
      revision_id:
        'nexus:discussion/topic/global-commons-visitor-lobby-topic-1@r1',
      created_at: '2026-04-28T19:42:41.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'nexus-web',
      created_by: { packet_id: guestActor.actorPacket.header.packet_id },
      subtype: 'topic',
      role: 'visitor_lobby',
      title: 'for all your testing needs',
      summary: 'for all your testing needs',
      parent_ref: { packet_id: canonicalForumPacket.header.packet_id },
      status: 'open',
      default_sort: 'new',
      edges: [
        {
          edge_type: 'references',
          target: { packet_id: legacyForumPacket.header.packet_id },
          metadata: {
            source_field: 'legacy_context_packet_ids',
            adapter_profile: 'discussion-type-unification',
          },
        },
      ],
    });
    const rootPostPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/message/global-commons-visitor-lobby-root-1',
      revision_id:
        'nexus:discussion/message/global-commons-visitor-lobby-root-1@r1',
      created_at: '2026-04-28T19:42:41.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'nexus-web',
      created_by: { packet_id: guestActor.actorPacket.header.packet_id },
      subtype: 'message',
      role: 'forum_post',
      title: 'for all your testing needs',
      parent_ref: { packet_id: topicPacket.header.packet_id },
      topic_ref: { packet_id: topicPacket.header.packet_id },
      root_message_ref: null,
      status: 'open',
      content_markdown: 'for all your testing needs',
      edges: [
        {
          edge_type: 'references',
          target: { packet_id: legacyForumPacket.header.packet_id },
          metadata: {
            source_field: 'legacy_context_packet_ids',
            adapter_profile: 'discussion-type-unification',
          },
        },
      ],
    });

    const result = await harness.discussionService.createPost({
      scope_id: SCOPE_ROUTE_ID,
      actor_key: `element:${guestActor.actorPacket.header.packet_id}`,
      actor_class: 'anonymous_guest',
      actor_packet: guestActor.actorPacket,
      proof_bundle: createGuestProofBundle(guestActor.actorPacket),
      intent: {
        kind: 'discussion.thread_post.create',
        scope_id: SCOPE_ROUTE_ID,
        mutation_nonce: 'top-level-post-1',
        created_at: '2026-04-28T19:42:41.000Z',
        forum_packet_id: legacyForumPacket.header.packet_id,
        forum_kind: 'visitor_lobby',
        authority_scope_packet_id: SCOPE_PACKET_ID,
        applicable_scope_packet_ids: [SCOPE_PACKET_ID],
        default_sort: 'new',
        thread_title: 'for all your testing needs',
        post_markdown: 'for all your testing needs',
        thread_kind: 'visitor_lobby',
        related_packet_ids: [],
        legacy_context_packet_ids: [legacyForumPacket.header.packet_id],
      },
      signed_thread_packet: await signPacketForActor(
        topicPacket,
        guestActor.actorPacket,
        guestActor.privateJwk
      ),
      signed_post_packet: await signPacketForActor(
        rootPostPacket,
        guestActor.actorPacket,
        guestActor.privateJwk
      ),
    });

    const feed = await harness.discussionService.getForumFeed({
      scope_id: SCOPE_ROUTE_ID,
      forum_id: 'visitor-lobby',
      sort: 'new',
      show_hidden: true,
      viewer_actor_key: null,
    });
    const thread = await harness.discussionService.getThreadDetail({
      scope_id: SCOPE_ROUTE_ID,
      post_packet_id: result.post.packet.packet_id,
      reply_sort: 'top',
      show_hidden: true,
      viewer_actor_key: null,
    });

    assert.equal(result.post.packet.packet_id, rootPostPacket.header.packet_id);
    assert.equal(feed.top_level_posts.length, 1);
    assert.equal(feed.top_level_posts[0]?.packet.packet_id, rootPostPacket.header.packet_id);
    assert.equal(thread.root_post.packet.packet_id, rootPostPacket.header.packet_id);
    assert.equal(thread.forum.id, 'visitor-lobby');
  } finally {
    harness.cleanup();
  }
});

test('guest replies to canonical roots and nested replies without duplicate semantic edge inserts', async () => {
  const harness = createDiscussionHarness();

  try {
    const { canonicalForumPacket } = await seedVisitorLobbyContext(
      harness.packetStore
    );
    const topicPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/topic/global-commons-visitor-lobby-topic-2',
      revision_id:
        'nexus:discussion/topic/global-commons-visitor-lobby-topic-2@r1',
      created_at: '2026-04-28T20:00:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'seed',
      subtype: 'topic',
      role: 'visitor_lobby',
      title: 'OP',
      summary: 'OP',
      parent_ref: { packet_id: canonicalForumPacket.header.packet_id },
      status: 'open',
      default_sort: 'new',
    });
    const rootPostPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/message/global-commons-visitor-lobby-root-2',
      revision_id:
        'nexus:discussion/message/global-commons-visitor-lobby-root-2@r1',
      created_at: '2026-04-28T20:00:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'seed',
      subtype: 'message',
      role: 'forum_post',
      title: 'OP',
      parent_ref: { packet_id: topicPacket.header.packet_id },
      topic_ref: { packet_id: topicPacket.header.packet_id },
      root_message_ref: null,
      status: 'open',
      content_markdown: 'OP body',
    });
    const guestActor = await createSignedGuestActor({
      alias: 'Guest Reply',
      packetId: 'nexus:element/guest-reply',
      createdAt: '2026-04-28T20:01:00.000Z',
    });

    await writePreferredPacket(harness.packetStore, topicPacket);
    await writePreferredPacket(harness.packetStore, rootPostPacket);

    const firstReplyPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/message/global-commons-visitor-lobby-reply-1',
      revision_id:
        'nexus:discussion/message/global-commons-visitor-lobby-reply-1@r1',
      created_at: '2026-04-28T20:01:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'nexus-web',
      created_by: { packet_id: guestActor.actorPacket.header.packet_id },
      subtype: 'message',
      role: 'reply',
      title: 'Reply from Guest Reply',
      parent_ref: { packet_id: rootPostPacket.header.packet_id },
      topic_ref: { packet_id: topicPacket.header.packet_id },
      root_message_ref: { packet_id: rootPostPacket.header.packet_id },
      status: 'open',
      content_markdown: 'First reply',
    });

    const firstReplyResult = await harness.discussionService.createReply({
      scope_id: SCOPE_ROUTE_ID,
      actor_key: `element:${guestActor.actorPacket.header.packet_id}`,
      actor_class: 'anonymous_guest',
      actor_packet: guestActor.actorPacket,
      proof_bundle: createGuestProofBundle(guestActor.actorPacket),
      intent: {
        kind: 'discussion.reply.create',
        scope_id: SCOPE_ROUTE_ID,
        mutation_nonce: 'reply-1',
        created_at: '2026-04-28T20:01:00.000Z',
        forum_kind: 'visitor_lobby',
        authority_scope_packet_id: SCOPE_PACKET_ID,
        applicable_scope_packet_ids: [SCOPE_PACKET_ID],
        thread_packet_id: topicPacket.header.packet_id,
        root_post_packet_id: rootPostPacket.header.packet_id,
        parent_post_packet_id: rootPostPacket.header.packet_id,
        reply_markdown: 'First reply',
        legacy_context_packet_ids: [],
      },
      signed_reply_packet: await signPacketForActor(
        firstReplyPacket,
        guestActor.actorPacket,
        guestActor.privateJwk
      ),
    });

    const nestedReplyPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/message/global-commons-visitor-lobby-reply-2',
      revision_id:
        'nexus:discussion/message/global-commons-visitor-lobby-reply-2@r1',
      created_at: '2026-04-28T20:02:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'nexus-web',
      created_by: { packet_id: guestActor.actorPacket.header.packet_id },
      subtype: 'message',
      role: 'reply',
      title: 'Reply from Guest Reply',
      parent_ref: { packet_id: firstReplyResult.post.packet.packet_id },
      topic_ref: { packet_id: topicPacket.header.packet_id },
      root_message_ref: { packet_id: rootPostPacket.header.packet_id },
      status: 'open',
      content_markdown: 'Nested reply',
    });

    const nestedReplyResult = await harness.discussionService.createReply({
      scope_id: SCOPE_ROUTE_ID,
      actor_key: `element:${guestActor.actorPacket.header.packet_id}`,
      actor_class: 'anonymous_guest',
      actor_packet: guestActor.actorPacket,
      proof_bundle: createGuestProofBundle(guestActor.actorPacket),
      intent: {
        kind: 'discussion.reply.create',
        scope_id: SCOPE_ROUTE_ID,
        mutation_nonce: 'reply-2',
        created_at: '2026-04-28T20:02:00.000Z',
        forum_kind: 'visitor_lobby',
        authority_scope_packet_id: SCOPE_PACKET_ID,
        applicable_scope_packet_ids: [SCOPE_PACKET_ID],
        thread_packet_id: topicPacket.header.packet_id,
        root_post_packet_id: rootPostPacket.header.packet_id,
        parent_post_packet_id: firstReplyResult.post.packet.packet_id,
        reply_markdown: 'Nested reply',
        legacy_context_packet_ids: [],
      },
      signed_reply_packet: await signPacketForActor(
        nestedReplyPacket,
        guestActor.actorPacket,
        guestActor.privateJwk
      ),
    });

    const thread = await harness.discussionService.getThreadDetail({
      scope_id: SCOPE_ROUTE_ID,
      post_packet_id: rootPostPacket.header.packet_id,
      reply_sort: 'new',
      show_hidden: true,
      viewer_actor_key: null,
    });

    assert.equal(firstReplyResult.post.packet.packet_id, firstReplyPacket.header.packet_id);
    assert.equal(nestedReplyResult.post.packet.packet_id, nestedReplyPacket.header.packet_id);
    assert.equal(thread.root_post.reply_count, 1);
    assert.equal(thread.replies[0]?.packet.packet_id, firstReplyPacket.header.packet_id);
  } finally {
    harness.cleanup();
  }
});

test('mixed legacy and canonical discussion ids resolve as one operational thread tree for reply paging', async () => {
  const harness = createDiscussionHarness();

  try {
    await writePreferredPacket(
      harness.packetStore,
      createAssemblyPacket({
        packet_id: SCOPE_PACKET_ID,
        created_at: '2026-04-28T00:00:00.000Z',
        name: 'Global Commons',
        subtype: 'global',
        summary: 'Global Commons scope.',
      })
    );
    const legacySpacePacket = createDiscussionSpacePacket({
      packet_id: 'nexus:discussion-space/global-commons',
      created_at: '2026-04-28T00:00:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Global Commons discussions',
      scope_ref: { packet_id: SCOPE_PACKET_ID },
      status: 'open',
    });
    const legacyForumPacket = createDiscussionForumPacket({
      packet_id: 'nexus:discussion-forum/global-commons-visitor-lobby',
      created_at: '2026-04-28T00:00:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Global Commons visitor lobby',
      summary: 'Signed guest posting',
      discussion_space_ref: { packet_id: legacySpacePacket.header.packet_id },
      forum_kind: 'visitor_lobby',
      status: 'open',
    });
    const legacyThreadPacket = createDiscussionThreadPacket({
      packet_id: 'nexus:discussion-thread/global-commons-thread',
      created_at: '2026-04-28T00:01:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Test thread',
      forum_ref: { packet_id: legacyForumPacket.header.packet_id },
      thread_kind: 'visitor_lobby',
      status: 'open',
    });
    const legacyRootPostPacket = createDiscussionPostPacket({
      packet_id: 'nexus:discussion-post/global-commons-root',
      created_at: '2026-04-28T00:02:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Root post',
      thread_ref: { packet_id: legacyThreadPacket.header.packet_id },
      post_kind: 'forum_post',
      content_markdown: 'Root body',
    });
    const legacyReplyPacket = createDiscussionReplyPacket({
      packet_id: 'nexus:discussion-reply/global-commons-reply',
      created_at: '2026-04-28T00:03:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      title: 'Legacy reply',
      thread_ref: { packet_id: legacyThreadPacket.header.packet_id },
      root_post_ref: { packet_id: legacyRootPostPacket.header.packet_id },
      reply_to_ref: { packet_id: legacyRootPostPacket.header.packet_id },
      content_markdown: 'Reply body',
    });
    const canonicalPackets = [
      createCanonicalDiscussionMirrorPacket(legacySpacePacket),
      createCanonicalDiscussionMirrorPacket(legacyForumPacket),
      createCanonicalDiscussionMirrorPacket(legacyThreadPacket),
      createCanonicalDiscussionMirrorPacket(legacyRootPostPacket),
      createCanonicalDiscussionMirrorPacket(legacyReplyPacket),
    ];

    const packetsById = new Map(
      [
        legacySpacePacket,
        legacyForumPacket,
        legacyThreadPacket,
        legacyRootPostPacket,
        legacyReplyPacket,
        ...canonicalPackets,
      ].map((packet) => [packet.header.packet_id, packet])
    );

    for (const packet of packetsById.values()) {
      await writePreferredPacket(harness.packetStore, packet);
    }

    const thread = await harness.discussionService.getThreadDetail({
      scope_id: SCOPE_ROUTE_ID,
      post_packet_id: legacyRootPostPacket.header.packet_id,
      reply_sort: 'top',
      show_hidden: true,
      viewer_actor_key: null,
    });
    const replyChildren = await harness.discussionService.getReplyChildren({
      scope_id: SCOPE_ROUTE_ID,
      thread_post_packet_id: legacyRootPostPacket.header.packet_id,
      parent_post_packet_id: canonicalPackets[4]!.header.packet_id,
      reply_sort: 'top',
      show_hidden: true,
      viewer_actor_key: null,
    });

    assert.equal(
      thread.root_post.packet.packet_id,
      canonicalPackets[3]!.header.packet_id
    );
    assert.equal(thread.replies[0]?.packet.packet_id, canonicalPackets[4]!.header.packet_id);
    assert.deepEqual(replyChildren.replies, []);
    assert.equal(replyChildren.has_more, false);
  } finally {
    harness.cleanup();
  }
});

test('discussion workspace projections expose runtime-owned action maps and descriptors', async () => {
  const harness = createDiscussionHarness();

  try {
    const { legacyForumPacket } = await seedVisitorLobbyContext(harness.packetStore);
    const guestActor = await createSignedGuestActor({
      alias: 'Guest Workspace',
      packetId: 'nexus:element/guest-workspace',
    });
    const topicPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/topic/global-commons-workspace-topic',
      revision_id:
        'nexus:discussion/topic/global-commons-workspace-topic@r1',
      created_at: '2026-04-28T21:00:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'nexus-web',
      created_by: { packet_id: guestActor.actorPacket.header.packet_id },
      subtype: 'topic',
      role: 'visitor_lobby',
      title: 'Workspace topic',
      summary: 'Workspace topic',
      parent_ref: { packet_id: legacyForumPacket.header.packet_id },
      status: 'open',
    });
    const rootPostPacket = createDiscussionPacket({
      packet_id: 'nexus:discussion/message/global-commons-workspace-root',
      revision_id:
        'nexus:discussion/message/global-commons-workspace-root@r1',
      created_at: '2026-04-28T21:00:00.000Z',
      authority_scope_ref: { packet_id: SCOPE_PACKET_ID },
      applicable_scope_refs: [{ packet_id: SCOPE_PACKET_ID }],
      adapter: 'nexus-web',
      created_by: { packet_id: guestActor.actorPacket.header.packet_id },
      subtype: 'message',
      role: 'forum_post',
      title: 'Workspace root',
      parent_ref: { packet_id: topicPacket.header.packet_id },
      topic_ref: { packet_id: topicPacket.header.packet_id },
      root_message_ref: null,
      status: 'open',
      content_markdown: 'Workspace root body',
    });

    await writePreferredPacket(harness.packetStore, guestActor.actorPacket);
    await writePreferredPacket(harness.packetStore, topicPacket);
    await writePreferredPacket(harness.packetStore, rootPostPacket);
    await harness.discussionService.syncDerivedState();

    const workspace = await harness.discussionService.getWorkspace({
      scope_id: SCOPE_ROUTE_ID,
      forum_id: 'visitor-lobby',
      view: 'thread',
      post_packet_id: rootPostPacket.header.packet_id,
      reply_target_packet_id: rootPostPacket.header.packet_id,
      sort: 'new',
      reply_sort: 'top',
      show_hidden: true,
      viewer_actor_key: `element:${guestActor.actorPacket.header.packet_id}`,
      feed_limit: 20,
      reply_limit: 10,
    });

    assert.equal(
      workspace.workspace_actions['discussion.create_top_level']?.enabled,
      true
    );
    assert.equal(
      workspace.thread_root?.actions['discussion.reply']?.enabled,
      true
    );
    assert.equal(workspace.thread_root?.state.is_selected_thread, true);
    assert.equal(workspace.thread_root?.state.is_reply_target, true);
    assert.equal(
      workspace.action_descriptors.some(
        (descriptor) => descriptor.id === 'discussion.reply'
      ),
      true
    );
  } finally {
    harness.cleanup();
  }
});
