import test from 'node:test';
import assert from 'node:assert/strict';

import { createPolicyPacket } from '@core/packets/builders';
import { createPersonIdentityPacket } from '@core/packets/identity';
import { parsePacketEnvelope } from '@core/schema/packet-schema';
import {
  createIdentityKeyBinding,
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
    header: {
      ...actorPacket.header,
      metadata: Object.fromEntries(
        Object.entries(actorPacket.header.metadata).filter(
          ([key]) => key !== 'compatibility'
        )
      ),
    },
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

test('verifyPacketSignature accepts adapted packets when the original signed packet omitted additive header defaults', async () => {
  const keyPair = await generateP256KeyPair();
  const jwks = await exportIdentityKeyPairToJwk(keyPair);
  const packetId = 'nexus:element/test-header-compat';
  const createdAt = '2026-04-28T09:00:00.000Z';
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: jwks.publicJwk,
    addedAt: createdAt,
  });
  const actorPacket = createPersonIdentityPacket({
    alias: 'Header Compat',
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId,
    createdAt,
  });
  const legacyUnsignedPacket = {
    ...actorPacket,
    header: {
      ...actorPacket.header,
      metadata: Object.fromEntries(
        Object.entries(actorPacket.header.metadata).filter(
          ([key]) => key !== 'compatibility'
        )
      ),
    },
  };
  const signedPacket = await signPacketWithIdentity({
    packet: legacyUnsignedPacket as typeof actorPacket,
    signerPacketId: packetId,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: createdAt,
  });
  const adaptedPacket = parsePacketEnvelope(signedPacket);

  const signatureIsValid = await verifyPacketSignature({
    packet: adaptedPacket,
    signerPacket: adaptedPacket,
  });

  assert.equal(signatureIsValid, true);
});

test('verifyPacketSignature accepts legacy non-identity packets without additive defaults', async () => {
  const keyPair = await generateP256KeyPair();
  const jwks = await exportIdentityKeyPairToJwk(keyPair);
  const actorPacketId = 'nexus:element/test-policy-signer';
  const createdAt = '2026-04-28T10:00:00.000Z';
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: jwks.publicJwk,
    addedAt: createdAt,
  });
  const signerPacket = createPersonIdentityPacket({
    alias: 'Policy Signer',
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId: actorPacketId,
    createdAt,
  });
  const policyPacket = createPolicyPacket({
    packet_id: 'nexus:policy/test-legacy-policy-signature',
    revision_id: 'nexus:policy/test-legacy-policy-signature@r1',
    created_at: createdAt,
    title: 'Legacy Policy',
    summary: null,
    policy_kind: 'trust_baseline',
    body_markdown: '# Legacy',
    status: 'active',
    metadata_tags: [],
    metadata_summary: null,
    metadata_language: null,
    adapter: 'test',
    app_version: null,
  });
  const legacyUnsignedPolicyPacket = {
    ...policyPacket,
    header: {
      ...policyPacket.header,
      metadata: Object.fromEntries(
        Object.entries(policyPacket.header.metadata).filter(
          ([key]) => key !== 'compatibility'
        )
      ),
    },
    body: Object.fromEntries(
      Object.entries(policyPacket.body).filter(
        ([key]) => key !== 'trust_policy' && key !== 'write_policy'
      )
    ),
  };
  const signedPacket = await signPacketWithIdentity({
    packet: legacyUnsignedPolicyPacket as typeof policyPacket,
    signerPacketId: signerPacket.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: createdAt,
  });
  const adaptedPacket = parsePacketEnvelope(signedPacket);

  const signatureIsValid = await verifyPacketSignature({
    packet: adaptedPacket,
    signerPacket,
  });

  assert.equal(signatureIsValid, true);
});
