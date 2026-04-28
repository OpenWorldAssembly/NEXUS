import test from 'node:test';
import assert from 'node:assert/strict';

import {
  type PacketEnvelopeByType,
} from '@core/schema/packet-schema';

import {
  createCanonicalDiscussionMirrorPacket,
  createCanonicalDiscussionPacketId,
  interpretDiscussionPacket,
  projectDiscussionPacketToLegacy,
} from './discussion-compat.ts';
import {
  createDiscussionForumPacket,
  createDiscussionPacket,
  createDiscussionPostPacket,
  createDiscussionReplyPacket,
  createDiscussionSpacePacket,
  createDiscussionThreadPacket,
} from './builders.ts';

test('legacy discussion packets interpret as canonical discussion nodes', () => {
  const space = createDiscussionSpacePacket({
    packet_id: 'nexus:discussion-space/scope-a',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'Scope A discussions',
    summary: null,
    scope_ref: { packet_id: 'nexus:element/scope-a' },
    status: 'open',
  });
  const forum = createDiscussionForumPacket({
    packet_id: 'nexus:discussion-forum/scope-a-general',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'General',
    summary: null,
    discussion_space_ref: { packet_id: space.header.packet_id },
    forum_kind: 'general',
    status: 'open',
  });
  const topic = createDiscussionThreadPacket({
    packet_id: 'nexus:discussion-thread/scope-a-general-topic',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'Hello',
    summary: null,
    forum_ref: { packet_id: forum.header.packet_id },
    thread_kind: 'general',
    status: 'open',
  });
  const post = createDiscussionPostPacket({
    packet_id: 'nexus:discussion-post/scope-a-general-root',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'Hello',
    thread_ref: { packet_id: topic.header.packet_id },
    post_kind: 'forum_post',
    content_markdown: 'Root message',
  });
  const reply = createDiscussionReplyPacket({
    packet_id: 'nexus:discussion-reply/scope-a-general-child',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'Reply',
    thread_ref: { packet_id: topic.header.packet_id },
    root_post_ref: { packet_id: post.header.packet_id },
    reply_to_ref: { packet_id: post.header.packet_id },
    content_markdown: 'Child message',
  });

  assert.equal(interpretDiscussionPacket(space).kind, 'space');
  assert.equal(interpretDiscussionPacket(forum).kind, 'forum');
  assert.equal(interpretDiscussionPacket(topic).kind, 'topic');

  const postNode = interpretDiscussionPacket(post);
  assert.equal(postNode.kind, 'message');
  assert.equal(postNode.parent_packet_id, createCanonicalDiscussionPacketId(topic.header.packet_id));
  assert.equal(postNode.adaptation.direction, 'legacy_to_canonical');

  const replyNode = interpretDiscussionPacket(reply);
  assert.equal(replyNode.kind, 'message');
  assert.equal(replyNode.root_message_packet_id, createCanonicalDiscussionPacketId(post.header.packet_id));
  assert.equal(replyNode.adaptation.is_lossy, false);
});

test('canonical discussion messages can virtually downcast to legacy post and reply views', () => {
  const topic = createDiscussionPacket({
    packet_id: 'nexus:discussion/topic/scope-a-general-topic',
    created_at: '2026-04-28T00:00:00.000Z',
    kind: 'topic',
    role: 'general',
    title: 'Hello',
    summary: null,
    parent_ref: { packet_id: 'nexus:discussion/forum/scope-a-general' },
    status: 'open',
  });
  const rootMessage = createDiscussionPacket({
    packet_id: 'nexus:discussion/message/scope-a-general-root',
    created_at: '2026-04-28T00:01:00.000Z',
    kind: 'message',
    role: 'forum_post',
    title: 'Hello',
    parent_ref: { packet_id: topic.header.packet_id },
    topic_ref: { packet_id: topic.header.packet_id },
    root_message_ref: null,
    content_markdown: 'Root message',
  });
  const reply = createDiscussionPacket({
    packet_id: 'nexus:discussion/message/scope-a-general-reply',
    created_at: '2026-04-28T00:02:00.000Z',
    kind: 'message',
    role: 'reply',
    title: 'Reply',
    parent_ref: { packet_id: rootMessage.header.packet_id },
    topic_ref: { packet_id: topic.header.packet_id },
    root_message_ref: { packet_id: rootMessage.header.packet_id },
    content_markdown: 'Child message',
  });

  const legacyPost = projectDiscussionPacketToLegacy(rootMessage, 'DiscussionPost');
  const legacyReply = projectDiscussionPacketToLegacy(reply, 'DiscussionReply');
  const projectedPost = legacyPost as PacketEnvelopeByType['DiscussionPost'];
  const projectedReply = legacyReply as PacketEnvelopeByType['DiscussionReply'];

  assert.equal(legacyPost?.header.family, 'DiscussionPost');
  assert.equal(projectedPost.body.thread_ref.packet_id, topic.header.packet_id);
  assert.equal(legacyReply?.header.family, 'DiscussionReply');
  assert.equal(projectedReply.body.root_post_ref.packet_id, rootMessage.header.packet_id);
  assert.equal(projectDiscussionPacketToLegacy(topic, 'DiscussionReply'), null);
});

test('legacy discussion mirrors are deterministic canonical Discussion packets', () => {
  const legacyForum = createDiscussionForumPacket({
    packet_id: 'nexus:discussion-forum/scope-a-general',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'General',
    summary: null,
    discussion_space_ref: { packet_id: 'nexus:discussion-space/scope-a' },
    forum_kind: 'general',
    status: 'open',
  });
  const mirror = createCanonicalDiscussionMirrorPacket(legacyForum);

  assert.equal(mirror.header.family, 'Discussion');
  assert.equal(mirror.body.kind, 'forum');
  assert.equal(mirror.body.role, 'general');
  assert.equal(mirror.body.parent_ref.packet_id, createCanonicalDiscussionPacketId('nexus:discussion-space/scope-a'));
  assert.equal(mirror.header.metadata.compatibility?.family_history[0]?.family, 'DiscussionForum');
  assert.equal(mirror.header.edges.some((edge) => edge.edge_type === 'derived_from'), true);
});
