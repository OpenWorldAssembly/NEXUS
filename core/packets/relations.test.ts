import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createRelationPacketId,
  createScopedRelationPacket,
} from './relations.ts';

test('relation packet ids are deterministic by subtype, subject, target, and scope', () => {
  const firstId = createRelationPacketId({
    subtype: 'home_locality',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/scope-a',
    scopePacketId: 'nexus:element/scope-a',
  });
  const secondId = createRelationPacketId({
    subtype: 'home_locality',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/scope-a',
    scopePacketId: 'nexus:element/scope-a',
  });

  assert.equal(firstId, secondId);
});

test('scoped relation packets keep the relation scope as the authority scope', () => {
  const packet = createScopedRelationPacket({
    subtype: 'home_locality',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/moreno-valley',
    scopePacketId: 'nexus:element/moreno-valley',
    applicableScopeRefs: [{ packet_id: 'nexus:element/global-commons' }],
    createdByPacketId: 'nexus:element/person-a',
    note: 'Canonical home locality relation.',
  });

  assert.equal(packet.header.family, 'Relation');
  assert.equal(
    packet.header.authority_scope_ref?.packet_id,
    'nexus:element/moreno-valley'
  );
  assert.equal(packet.body.subtype, 'home_locality');
  assert.equal(packet.body.target_ref.packet_id, 'nexus:element/moreno-valley');
  assert.equal(packet.body.note, 'Canonical home locality relation.');
});

test('relation revisions preserve compact parent revision refs', () => {
  const packet = createScopedRelationPacket({
    subtype: 'home_locality',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/moreno-valley',
    scopePacketId: 'nexus:element/moreno-valley',
    applicableScopeRefs: [{ packet_id: 'nexus:element/global-commons' }],
    createdByPacketId: 'nexus:element/person-a',
    status: 'withdrawn',
    packetId: 'nexus:relation/home-locality-test',
    parentRevisionRefs: [
      {
        packet_id: 'nexus:relation/home-locality-test',
        revision_id: 'nexus:relation/home-locality-test@r1',
      },
    ],
  });

  assert.deepEqual(packet.header.parent_revision_refs, [
    {
      packet_id: 'nexus:relation/home-locality-test',
      revision_id: 'nexus:relation/home-locality-test@r1',
    },
  ]);
  assert.equal(packet.header.revision_id, 'nexus:relation/home-locality-test@r2');
});
