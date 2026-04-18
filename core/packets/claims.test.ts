import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createAssociationClaimPacket,
  createClaimPacketId,
} from './claims.ts';

test('claim packet ids are deterministic by subject, target, scope, and kind', () => {
  const firstId = createClaimPacketId({
    claimKind: 'role_association',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:role/facilitator',
    scopePacketId: 'nexus:element/scope-a',
  });
  const secondId = createClaimPacketId({
    claimKind: 'role_association',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:role/facilitator',
    scopePacketId: 'nexus:element/scope-a',
  });

  assert.equal(firstId, secondId);
});

test('association claim packets keep the claim scope as the authority scope', () => {
  const packet = createAssociationClaimPacket({
    claimKind: 'assembly_association',
    subjectPacketId: 'nexus:element/person-a',
    targetPacketId: 'nexus:element/scope-a',
    scopePacketId: 'nexus:element/scope-a',
    applicableScopeRefs: [{ packet_id: 'nexus:element/global-commons' }],
    createdByPacketId: 'nexus:element/person-a',
    note: 'Lives here.',
  });

  assert.equal(packet.header.family, 'Claim');
  assert.equal(
    packet.header.authority_scope_ref?.packet_id,
    'nexus:element/scope-a'
  );
  assert.equal(packet.body.status, 'active');
});

