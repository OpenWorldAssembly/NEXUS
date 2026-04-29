import assert from 'node:assert/strict';
import test from 'node:test';

import type { PacketEnvelope } from '@core/schema/packet-schema';

import { buildPacket } from './packet-build-pipeline.ts';
import {
  createPacket,
  createPacketEdge,
  createAttestationPacket,
  createDiscussionPacket,
  createDiscussionPostPacket,
  createDiscussionThreadPacket,
  createElementPacket,
} from './builders.ts';
import { createCanonicalDiscussionPacketId } from './discussion-compat.ts';
import { interpretPacket } from './packet-interpreter.ts';
import {
  planPacketTargetMigration,
  resolvePacketTarget,
} from './packet-target-resolver.ts';

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

test('canonical direct replies emit one semantic belongs_to edge when parent and root match', () => {
  const reply = createDiscussionPacket({
    packet_id: 'nexus:discussion/message/a-general-reply',
    created_at: '2026-04-28T00:02:00.000Z',
    kind: 'message',
    role: 'reply',
    title: 'Reply',
    parent_ref: { packet_id: 'nexus:discussion/message/a-general-root' },
    topic_ref: { packet_id: 'nexus:discussion/topic/a-general' },
    root_message_ref: { packet_id: 'nexus:discussion/message/a-general-root' },
    content_markdown: 'Reply body',
  });
  const belongsToTargets = reply.header.edges
    .filter((edge) => edge.edge_type === 'belongs_to')
    .map((edge) => edge.target.packet_id);
  const replyToTargets = reply.header.edges
    .filter((edge) => edge.edge_type === 'reply_to')
    .map((edge) => edge.target.packet_id);

  assert.deepEqual(belongsToTargets, ['nexus:discussion/message/a-general-root']);
  assert.deepEqual(replyToTargets, ['nexus:discussion/message/a-general-root']);
});

test('legacy builder dedupes semantic edges even when metadata differs', () => {
  const packet = createPacket({
    family: 'Element',
    packet_id: 'nexus:element/test-scope',
    created_at: '2026-04-28T00:00:00.000Z',
    edges: [
      createPacketEdge('belongs_to', { packet_id: 'nexus:element/parent-scope' }, {
        source_field: 'authority_scope_ref',
      }),
      createPacketEdge('belongs_to', { packet_id: 'nexus:element/parent-scope' }, {
        source_field: 'applicable_scope_refs',
      }),
    ],
    body: {
      kind: 'assembly',
      name: 'Test Scope',
      subtype: null,
      summary: null,
      locality_label: null,
      locality: null,
      identity: null,
      tags: [],
      claimed_role_refs: [],
    },
  });

  assert.equal(packet.header.edges.length, 1);
  assert.equal(packet.header.edges[0]?.edge_type, 'belongs_to');
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

test('interpreter keeps non-discussion families on same-family stages for canonical and read_model targets', () => {
  const element = createElementPacket({
    packet_id: 'nexus:element/person/alice',
    created_at: '2026-04-28T00:00:00.000Z',
    kind: 'person',
    name: 'Alice',
    identity: {
      alias: 'alice',
      claim_status: 'claimed',
    },
  });
  const attestation = createAttestationPacket({
    packet_id: 'nexus:attestation/vote/alice-root',
    created_at: '2026-04-28T00:01:00.000Z',
    target_ref: { packet_id: 'nexus:discussion/message/root' },
    value: 1,
  });

  const canonicalElement = interpretPacket({
    packet: element,
    target: { mode: 'canonical' },
  });
  const readModelAttestation = interpretPacket({
    packet: attestation,
    target: {
      mode: 'read_model',
      read_model_id: 'nexus-interface@1',
    },
  });

  assert.equal(canonicalElement.target_family, 'Element');
  assert.equal(canonicalElement.stages.includes('family_evolution'), false);
  assert.equal(readModelAttestation.target_family, 'Attestation');
  assert.equal(readModelAttestation.stages.includes('family_evolution'), false);
  assert.equal(
    (readModelAttestation.interpreted as { header: { family: string } }).header.family,
    'Attestation'
  );
});

test('unified interpreter adapts legacy discussion packets into canonical, legacy, and read-model targets', () => {
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
  const readModelInterpretation = interpretPacket({
    packet: legacyThread,
    target: {
      mode: 'read_model',
      read_model_id: 'nexus-interface@1',
    },
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
  assert.equal(
    (readModelInterpretation.interpreted as { kind: string }).kind,
    'topic'
  );
  assert.equal(readModelInterpretation.stages.includes('family_evolution'), true);
  assert.equal(
    readModelInterpretation.stages.includes('read_model_projection'),
    true
  );
});

test('resolver returns canonicalized current target when a canonical discussion mirror exists', async () => {
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

  const resolution = await resolvePacketTarget({
    packet_id: legacyThread.header.packet_id,
    fetchPacket: async (packetId) => packets.get(packetId) ?? null,
    fetchRevisionHeads: async (packetId) => ({
      preferred_revision:
        packets.get(packetId) === null
          ? null
          : {
              packet_id: packetId,
              revision_id: packets.get(packetId)!.header.revision_id,
            },
      head_revisions:
        packets.get(packetId) === null
          ? []
          : [
              {
                packet_id: packetId,
                revision_id: packets.get(packetId)!.header.revision_id,
              },
            ],
      revision_state: 'linear',
    }),
  });

  assert.equal(resolution.currentness_status, 'canonicalized');
  assert.equal(resolution.canonical_packet_id, canonicalTopic.header.packet_id);
  assert.equal(resolution.resolved_packet?.header.packet_id, canonicalTopic.header.packet_id);
});

test('resolver returns deterministic missing canonical targets before a discussion mirror exists', async () => {
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

  const resolution = await resolvePacketTarget({
    packet_id: legacyPost.header.packet_id,
    fetchPacket: async (packetId) => packets.get(packetId) ?? null,
    fetchRevisionHeads: async () => null,
  });

  assert.equal(
    resolution.canonical_packet_id,
    createCanonicalDiscussionPacketId(legacyPost.header.packet_id)
  );
  assert.equal(resolution.currentness_status, 'missing');
  assert.equal(resolution.resolved_packet, null);
});

test('resolver returns explicit ambiguity when no defensible current discussion head exists', async () => {
  const canonicalTopic = createDiscussionPacket({
    packet_id: 'nexus:discussion/topic/a-general',
    created_at: '2026-04-28T00:01:00.000Z',
    kind: 'topic',
    role: 'general',
    title: 'General thread',
    parent_ref: { packet_id: 'nexus:discussion/forum/a-general' },
    status: 'open',
  });

  const resolution = await resolvePacketTarget({
    packet_id: canonicalTopic.header.packet_id,
    fetchPacket: async () => canonicalTopic,
    fetchRevisionHeads: async () => ({
      preferred_revision: null,
      head_revisions: [
        {
          packet_id: canonicalTopic.header.packet_id,
          revision_id: 'nexus:discussion/topic/a-general@r1',
        },
        {
          packet_id: canonicalTopic.header.packet_id,
          revision_id: 'nexus:discussion/topic/a-general@r2',
        },
      ],
      revision_state: 'diverged',
    }),
  });

  assert.equal(resolution.currentness_status, 'ambiguous');
  assert.equal(resolution.resolved_packet, null);
});

test('migration planner is side-effect free, corridor-bound, and deduplicates legacy discussion mirrors', async () => {
  const legacyForum = createDiscussionPacket({
    packet_id: 'nexus:discussion/forum/placeholder',
    created_at: '2026-04-28T00:00:00.000Z',
    kind: 'forum',
    role: 'general',
    title: 'Placeholder',
    parent_ref: { packet_id: 'nexus:discussion/space/placeholder' },
    status: 'open',
  });
  void legacyForum;
  const forum = createDiscussionThreadPacket({
    packet_id: 'nexus:discussion-thread/a-general',
    created_at: '2026-04-28T00:00:00.000Z',
    title: 'General thread',
    forum_ref: { packet_id: 'nexus:discussion-forum/a-general' },
    thread_kind: 'general',
    status: 'open',
  });
  const root = createDiscussionPostPacket({
    packet_id: 'nexus:discussion-post/a-general-root',
    created_at: '2026-04-28T00:01:00.000Z',
    title: 'Root',
    thread_ref: { packet_id: forum.header.packet_id },
    content_markdown: 'Root body',
  });
  const packets = new Map<string, PacketEnvelope>([
    [forum.header.packet_id, forum],
    [root.header.packet_id, root],
  ]);

  const firstPlan = await planPacketTargetMigration({
    packet_id: root.header.packet_id,
    fetchPacket: async (packetId) => packets.get(packetId) ?? null,
    fetchRevisionHeads: async () => null,
  });
  const secondPlan = await planPacketTargetMigration({
    packet_id: root.header.packet_id,
    fetchPacket: async (packetId) => packets.get(packetId) ?? null,
    fetchRevisionHeads: async () => null,
  });

  assert.equal(firstPlan.requires_mutation_corridor, true);
  assert.equal(firstPlan.blocked_reason, null);
  assert.equal(firstPlan.canonical_packet_id, createCanonicalDiscussionPacketId(root.header.packet_id));
  assert.deepEqual(
    firstPlan.packets.map((packet) => packet.header.packet_id).sort(),
    secondPlan.packets.map((packet) => packet.header.packet_id).sort()
  );
  assert.equal(
    new Set(firstPlan.packets.map((packet) => packet.header.packet_id)).size,
    firstPlan.packets.length
  );
});
