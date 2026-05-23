import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPacketStatus,
  getPacketTitle,
  getPacketTitleFallbackFromPacketId,
} from './labels.ts';
import { createAssociationClaimPacket } from '@core/packets/claims';
import { createElementPacket } from '@core/packets/builders';

test('packet-id title fallback humanizes role association claims', () => {
  assert.equal(
    getPacketTitleFallbackFromPacketId(
      'nexus:claim/role_association/nexus%3Aelement%2Ftesty-mcgee--nexus%3Arole%2Fcoordinator--nexus%3Aelement%2Fglobal-commons'
    ),
    'Role Association claim'
  );
});

test('claim packet titles stay human-readable through the shared projection helper', () => {
  const packet = createAssociationClaimPacket({
    claimKind: 'role_association',
    subjectPacketId: 'nexus:element/testy-mcgee',
    targetPacketId: 'nexus:role/coordinator',
    scopePacketId: 'nexus:element/global-commons',
    applicableScopeRefs: [{ packet_id: 'nexus:element/global-commons' }],
    createdByPacketId: 'nexus:element/testy-mcgee',
  });

  assert.equal(getPacketTitle(packet), 'Role Association claim');
});

test('element packet status is exposed through the shared label projection helper', () => {
  const packet = createElementPacket({
    packet_id: 'nexus:element/test-operator',
    created_at: '2026-05-07T00:00:00.000Z',
    subtype: 'operator',
    name: 'Test Operator',
    status: 'active',
  });

  assert.equal(getPacketStatus(packet), 'active');
});
