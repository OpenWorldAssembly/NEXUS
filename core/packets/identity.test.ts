import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createElementPolicyRefsRevision,
  createElementRoleClaimsRevision,
  createPersonIdentityPacket,
} from './identity.ts';
import {
  createIdentityKeyBinding,
  generateP256KeyPair,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';

test('element role claim and policy revisions preserve structured locality', async () => {
  const publicKeyBinding = await createIdentityKeyBinding({
    publicJwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'x-local',
      y: 'y-local',
    },
    addedAt: '2026-04-28T00:00:00.000Z',
  });
  const actorPacket = createPersonIdentityPacket({
    alias: 'Local Tester',
    claimStatus: 'claimed',
    createdAt: '2026-04-28T00:00:00.000Z',
    publicKeyBinding,
    locationDisclosure: {
      scope: 'region',
      value: 'California',
    },
  });
  const actorWithLocality = {
    ...actorPacket,
    body: {
      ...actorPacket.body,
      locality: {
        level: 'region' as const,
        canonical_name_key: 'california',
        alias_keys: [],
        display_aliases: [],
      },
    },
  };

  const roleRevision = createElementRoleClaimsRevision({
    actorPacket: actorWithLocality,
    claimedRoleRefs: [{ packet_id: 'nexus:role/local-organizer' }],
  });
  const policyRevision = createElementPolicyRefsRevision({
    actorPacket: roleRevision,
    policyRefs: [{ packet_id: 'nexus:policy/write-lock/local-tester' }],
  });

  assert.deepEqual(roleRevision.body.locality, actorWithLocality.body.locality);
  assert.deepEqual(policyRevision.body.locality, actorWithLocality.body.locality);
});

test('element revisions do not carry forward embedded signatures from prior signed packets', async () => {
  const publicKeyBinding = await createIdentityKeyBinding({
    publicJwk: {
      kty: 'EC',
      crv: 'P-256',
      x: 'x-signed',
      y: 'y-signed',
    },
    addedAt: '2026-04-28T00:00:00.000Z',
  });
  const actorPacket = createPersonIdentityPacket({
    alias: 'Signed Local Tester',
    claimStatus: 'claimed',
    createdAt: '2026-04-28T00:00:00.000Z',
    packetId: 'nexus:element/signed-local-tester',
    publicKeyBinding,
  });
  const privateKey = await generateP256KeyPair();
  const signedActorPacket = await signPacketWithIdentity({
    packet: actorPacket,
    signerPacketId: actorPacket.header.packet_id,
    kid: publicKeyBinding.kid,
    privateKey: privateKey.privateKey,
    signedAt: actorPacket.header.created_at,
  });

  const roleRevision = createElementRoleClaimsRevision({
    actorPacket: signedActorPacket,
    claimedRoleRefs: [{ packet_id: 'nexus:role/local-organizer' }],
  });
  const policyRevision = createElementPolicyRefsRevision({
    actorPacket: signedActorPacket,
    policyRefs: [{ packet_id: 'nexus:policy/write-lock/signed-local-tester' }],
  });

  assert.deepEqual(
    roleRevision.header.integrity.embedded_signatures,
    []
  );
  assert.deepEqual(
    policyRevision.header.integrity.embedded_signatures,
    []
  );
});
