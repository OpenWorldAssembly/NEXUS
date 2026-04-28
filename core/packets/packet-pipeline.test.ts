import assert from 'node:assert/strict';
import test from 'node:test';

import type { PacketEnvelope } from '@core/schema/packet-schema';

import { buildPacket } from './packet-build-pipeline.ts';
import {
  createDiscussionPacket,
  createDiscussionPostPacket,
  createDiscussionThreadPacket,
} from './builders.ts';
import {
  createCanonicalDiscussionPacketId,
  resolveCanonicalDiscussionTarget,
} from './discussion-compat.ts';
import { interpretPacket } from './packet-interpreter.ts';

test('generic builder pipeline builds canonical Discussion packets', () => {
  const packet = buildPacket({
    family: 'Discussion',
    body: {
      packet_id: 'nexus:discussion/topic/a-general',
      created_at: '2026-04-28T00:00:00.000Z',
      kind: 'topic',
      role: 'general',
      title: 'General topic',
      parent_ref: { packet_id: 'nexus:discussion/forum/a-general' },
      status: 'open',
    },
    header: {
      packet_id: 'nexus:discussion/topic/a-general',
      created_at: '2026-04-28T00:00:00.000Z',
    },
  });

  assert.equal(packet.header.family, 'Discussion');
  assert.equal(packet.body.kind, 'topic');
  assert.equal(
    packet.header.edges.some((edge) => edge.edge_type === 'belongs_to'),
    true
  );
});

test('generic builder pipeline builds canonical Policy packets', () => {
  const packet = buildPacket({
    family: 'Policy',
    body: {
      packet_id: 'nexus:policy/write-lock/a',
      created_at: '2026-04-28T00:00:00.000Z',
      title: 'Write lock',
      policy_kind: 'write_lock',
      body_markdown: 'Policy body',
      status: 'active',
      write_policy: {
        default_proof_level: 'reauth',
        action_overrides: {},
      },
    },
    header: {
      packet_id: 'nexus:policy/write-lock/a',
      created_at: '2026-04-28T00:00:00.000Z',
    },
  });

  assert.equal(packet.header.family, 'Policy');
  assert.equal(packet.body.policy_kind, 'write_lock');
});

test('unified interpreter adapts legacy discussion packets into canonical and legacy targets', () => {
  const legacyThread = createDiscussionThreadPacket({
    packet_id: 'nexus:discussion-thread/a-general',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'General thread',
    forum_ref: { packet_id: 'nexus:discussion-forum/a-general' },
    thread_kind: 'general',
    status: 'open',
  });
  const canonicalMessage = createDiscussionPacket({
    packet_id: 'nexus:discussion/message/a-general-root',
    created_at: '2026-04-28T00:01:00.000Z',
    kind: 'message',
    role: 'forum_post',
    title: 'Root',
    parent_ref: { packet_id: 'nexus:discussion/topic/a-general' },
    topic_ref: { packet_id: 'nexus:discussion/topic/a-general' },
    root_message_ref: null,
    content_markdown: 'Root body',
  });

  const canonicalInterpretation = interpretPacket({
    packet: legacyThread,
    target: { mode: 'canonical', family: 'Discussion' },
  });
  const legacyInterpretation = interpretPacket({
    packet: canonicalMessage,
    target: { mode: 'legacy', family: 'DiscussionPost' },
  });

  assert.equal(
    (canonicalInterpretation.interpreted as { header: { family: string } }).header
      .family,
    'Discussion'
  );
  assert.equal(canonicalInterpretation.compatibility_mode, 'adapted');
  assert.equal(
    (legacyInterpretation.interpreted as { header: { family: string } }).header
      .family,
    'DiscussionPost'
  );
  assert.equal(legacyInterpretation.compatibility_mode, 'downcast');
});

test('canonical discussion target resolver prefers existing canonical mirrors', async () => {
  const legacyThread = createDiscussionThreadPacket({
    packet_id: 'nexus:discussion-thread/a-general',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'General thread',
    forum_ref: { packet_id: 'nexus:discussion-forum/a-general' },
    thread_kind: 'general',
    status: 'open',
  });
  const canonicalTopic = createDiscussionPacket({
    packet_id: createCanonicalDiscussionPacketId(legacyThread.header.packet_id),
    created_at: '2026-04-28T00:01:00.000Z',
    kind: 'topic',
    role: 'general',
    title: 'General thread',
    parent_ref: { packet_id: 'nexus:discussion/forum/a-general' },
    status: 'open',
  });
  const packets = new Map<string, PacketEnvelope>([
    [legacyThread.header.packet_id, legacyThread],
    [canonicalTopic.header.packet_id, canonicalTopic],
  ]);

  const resolution = await resolveCanonicalDiscussionTarget({
    packet_id: legacyThread.header.packet_id,
    fetchPacket: async (packetId) => packets.get(packetId) ?? null,
  });

  assert.equal(resolution.canonical_packet_id, canonicalTopic.header.packet_id);
  assert.equal(resolution.canonical_packet?.header.packet_id, canonicalTopic.header.packet_id);
  assert.equal(resolution.should_create_mirror, false);
});

test('canonical discussion target resolver keeps deterministic ids before mirror creation', async () => {
  const legacyPost = createDiscussionPostPacket({
    packet_id: 'nexus:discussion-post/a-general-root',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'Root',
    thread_ref: { packet_id: 'nexus:discussion-thread/a-general' },
    content_markdown: 'Root body',
  });
  const packets = new Map<string, PacketEnvelope>([
    [legacyPost.header.packet_id, legacyPost],
  ]);

  const resolution = await resolveCanonicalDiscussionTarget({
    packet_id: legacyPost.header.packet_id,
    fetchPacket: async (packetId) => packets.get(packetId) ?? null,
  });

  assert.equal(
    resolution.canonical_packet_id,
    createCanonicalDiscussionPacketId(legacyPost.header.packet_id)
  );
  assert.equal(resolution.should_create_mirror, true);
});
