import assert from 'node:assert/strict';
import test from 'node:test';

import { PACKET_TYPES, type PacketEnvelopeByType } from '@core/schema/packet-schema';

import { buildPacket, GENERIC_PACKET_BUILD_TYPES } from './packet-build-pipeline.ts';
import { createPacketEdge } from './builders.ts';
import { listPacketPipelineInventory } from './pipeline-inventory.ts';

const CREATED_AT = '2026-04-28T00:00:00.000Z';

test('generic builder pipeline type list matches active packet canon', () => {
  assert.deepEqual([...GENERIC_PACKET_BUILD_TYPES].sort(), [...PACKET_TYPES].sort());
});

test('packet pipeline inventory covers exactly the active packet type set', () => {
  const inventoryTypes = listPacketPipelineInventory().map((entry) => entry.type);

  assert.deepEqual(inventoryTypes.sort(), [...PACKET_TYPES].sort());
  assert.equal(inventoryTypes.includes('Cause' as never), false);
});

test('generic builder pipeline builds canonical subtype Discussion posts', () => {
  const packet = buildPacket({
    type: 'Discussion',
    body: {
      packet_id: 'nexus:discussion/post/a-general',
      created_at: CREATED_AT,
      subtype: 'post',
      role: 'thread_root',
      title: 'General post',
      parent_ref: { packet_id: 'nexus:discussion/forum/a-general' },
      status: 'open',
      content_markdown: 'General body',
      attachment_refs: [{ packet_id: 'nexus:bundle/example-media' }],
    },
    header: {
      packet_id: 'nexus:discussion/post/a-general',
      created_at: CREATED_AT,
    },
  } as unknown as Parameters<typeof buildPacket>[0]) as PacketEnvelopeByType['Discussion'];

  assert.equal(packet.header.type, 'Discussion');
  assert.equal(packet.body.subtype, 'post');
  assert.equal(Object.hasOwn(packet.body, 'kind'), false);
  assert.equal(
    packet.header.edges.some((edge) => edge.edge_type === 'belongs_to'),
    true
  );
  assert.equal(
    packet.header.edges.some(
      (edge) =>
        edge.edge_type === 'references' &&
        edge.target.packet_id === 'nexus:bundle/example-media'
    ),
    true
  );
});

test('canonical direct discussion messages emit one semantic belongs_to edge when parent and root match', () => {
  const reply = buildPacket({
    type: 'Discussion',
    body: {
      packet_id: 'nexus:discussion/message/a-general-reply',
      created_at: '2026-04-28T00:02:00.000Z',
      subtype: 'message',
      role: 'reply',
      title: 'Reply',
      parent_ref: { packet_id: 'nexus:discussion/post/a-general-root' },
      topic_ref: { packet_id: 'nexus:discussion/post/a-general-root' },
      root_message_ref: { packet_id: 'nexus:discussion/post/a-general-root' },
      content_markdown: 'Reply body',
    },
    header: {
      packet_id: 'nexus:discussion/message/a-general-reply',
      created_at: '2026-04-28T00:02:00.000Z',
    },
  } as unknown as Parameters<typeof buildPacket>[0]) as PacketEnvelopeByType['Discussion'];
  const belongsToTargets = reply.header.edges
    .filter((edge) => edge.edge_type === 'belongs_to')
    .map((edge) => edge.target.packet_id);
  const replyToTargets = reply.header.edges
    .filter((edge) => edge.edge_type === 'reply_to')
    .map((edge) => edge.target.packet_id);

  assert.deepEqual(belongsToTargets, ['nexus:discussion/post/a-general-root']);
  assert.deepEqual(replyToTargets, ['nexus:discussion/post/a-general-root']);
});

test('builder dedupes semantic edges without relying on legacy classifiers', () => {
  const packet = buildPacket({
    type: 'Element' as const,
    body: {
      subtype: 'assembly' as const,
      name: 'Test Scope',
      tags: [],
      claimed_role_refs: [],
    },
    header: {
      packet_id: 'nexus:element/test-scope',
      created_at: CREATED_AT,
      edges: [
        createPacketEdge('belongs_to', { packet_id: 'nexus:element/parent-scope' }, {
          source_field: 'authority_scope_ref',
        }),
        createPacketEdge('belongs_to', { packet_id: 'nexus:element/parent-scope' }, {
          source_field: 'applicable_scope_refs',
        }),
      ],
    },
  } as unknown as Parameters<typeof buildPacket>[0]) as PacketEnvelopeByType['Element'];

  assert.equal(packet.header.edges.length, 1);
  assert.equal(packet.header.edges[0]?.edge_type, 'belongs_to');
});

test('generic builder pipeline emits active subtype bodies for current core types', () => {
  const packets = [
    buildPacket({
      type: 'Element',
      body: {
        packet_id: 'nexus:element/person/alice',
        created_at: CREATED_AT,
        subtype: 'person',
        name: 'Alice',
        identity: {
          alias: 'alice',
          claim_status: 'claimed',
        },
        tags: ['person'],
      },
      header: {
        packet_id: 'nexus:element/person/alice',
        created_at: CREATED_AT,
      },
    }),
    buildPacket({
      type: 'Policy',
      body: {
        packet_id: 'nexus:policy/write-lock/a',
        created_at: CREATED_AT,
        title: 'Write lock',
        subtype: 'write_lock',
        body_markdown: 'Policy body',
        status: 'active',
        write_policy: {
          default_proof_level: 'reauth',
          action_overrides: {},
        },
      },
      header: {
        packet_id: 'nexus:policy/write-lock/a',
        created_at: CREATED_AT,
      },
    }),
    buildPacket({
      type: 'Claim',
      body: {
        packet_id: 'nexus:claim/role-association/alice-facilitator',
        created_at: CREATED_AT,
        subtype: 'relation_assertion',
        subject_ref: { packet_id: 'nexus:element/person/alice' },
        target_ref: { packet_id: 'nexus:role/facilitator' },
        scope_ref: { packet_id: 'nexus:element/global' },
        relation_assertion: {
          subtype: 'role_association',
          subject_ref: { packet_id: 'nexus:element/person/alice' },
          target_ref: { packet_id: 'nexus:role/facilitator' },
          scope_ref: { packet_id: 'nexus:element/global' },
        },
      },
      header: {
        packet_id: 'nexus:claim/role-association/alice-facilitator',
        created_at: CREATED_AT,
      },
    }),
    buildPacket({
      type: 'Attestation',
      body: {
        packet_id: 'nexus:attestation/packet-signal/a',
        created_at: CREATED_AT,
        subtype: 'packet_signal',
        target_ref: { packet_id: 'nexus:discussion/post/a' },
        value: 1,
        status: 'active',
      },
      header: {
        packet_id: 'nexus:attestation/packet-signal/a',
        created_at: CREATED_AT,
      },
    }),
    buildPacket({
      type: 'Action',
      body: {
        packet_id: 'nexus:action/initiative/owa',
        created_at: CREATED_AT,
        subtype: 'initiative',
        title: 'Open World Assembly',
        status: 'active',
        policy_refs: [{ packet_id: 'nexus:policy/owa-defaults' }],
      },
      header: {
        packet_id: 'nexus:action/initiative/owa',
        created_at: CREATED_AT,
      },
    }),
  ];

  for (const packet of packets) {
    assert.equal(typeof packet.body.subtype, 'string', packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'policy_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'role_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'proposal_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'claim_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'attestation_kind'), false, packet.header.type);
  }
});
