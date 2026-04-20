import test from 'node:test';
import assert from 'node:assert/strict';

import { createPersonIdentityPacket } from '@core/packets/identity';
import { parsePacketEnvelope } from '@core/schema/packet-schema';
import { createIdentityKeyBinding } from '@runtime/nexus/identity-crypto';
import {
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
  verifyPacketSignature,
} from '@runtime/nexus/identity-crypto';

test('verifyPacketSignature accepts legacy identity packets without additive Element defaults', async () => {
  const keyPair = await generateP256KeyPair();
  const jwks = await exportIdentityKeyPairToJwk(keyPair);
  const packetId = 'nexus:element/test-legacy-identity';
  const createdAt = '2026-04-18T08:00:00.000Z';
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: jwks.publicJwk,
    addedAt: createdAt,
  });
  const actorPacket = createPersonIdentityPacket({
    alias: 'Legacy Packet',
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId,
    createdAt,
    locationDisclosure: {
      scope: 'region',
      value: 'California',
    },
  });
  const legacyUnsignedPacket = {
    ...actorPacket,
    body: Object.fromEntries(
      Object.entries(actorPacket.body).filter(
        ([key]) => key !== 'claimed_role_refs' && key !== 'locality'
      )
    ),
  };
  const privateKey = await importPrivateKeyFromJwk(jwks.privateJwk);
  const signedPacket = await signPacketWithIdentity({
    packet: legacyUnsignedPacket as typeof actorPacket,
    signerPacketId: packetId,
    kid: keyBinding.kid,
    privateKey,
    signedAt: createdAt,
  });
  const parsedLegacyPacket = parsePacketEnvelope(signedPacket);

  await assert.doesNotReject(async () => {
    const signatureIsValid = await verifyPacketSignature({
      packet: parsedLegacyPacket as typeof actorPacket,
      signerPacket: parsedLegacyPacket as typeof actorPacket,
    });

    assert.equal(signatureIsValid, true);
  });
});
