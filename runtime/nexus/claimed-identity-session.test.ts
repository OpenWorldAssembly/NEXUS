import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createClaimedIdentityRevision,
  createPersonIdentityPacket,
} from '@core/packets/identity';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import type { ActiveIdentityState } from '@runtime/nexus/identity-storage';
import type { NexusAuthSessionPayload } from '@runtime/nexus/nexus-api-types';

import {
  adoptClaimedSessionActorPacket,
  assertClaimedActorPacketReady,
  resolveClaimedSessionActorPacket,
} from './claimed-identity-session.ts';

async function createSignedClaimedIdentity(input: {
  alias: string;
  packetId?: string;
  createdAt?: string;
}): Promise<{
  actorPacket: PacketEnvelopeByType['Element'];
  privateJwk: JsonWebKey;
  publicJwk: JsonWebKey;
  kid: string;
}> {
  const createdAt = input.createdAt ?? '2026-04-28T00:00:00.000Z';
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: createdAt,
  });
  const actorPacket = createPersonIdentityPacket({
    alias: input.alias,
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    createdAt,
    packetId: input.packetId,
  });
  const signedPacket = await signPacketWithIdentity({
    packet: actorPacket,
    signerPacketId: actorPacket.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: createdAt,
  });

  return {
    actorPacket: signedPacket,
    privateJwk: exportedKeys.privateJwk,
    publicJwk: exportedKeys.publicJwk,
    kid: keyBinding.kid,
  };
}

async function createSignedClaimedRevision(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  alias: string;
  privateJwk: JsonWebKey;
  kid: string;
}): Promise<PacketEnvelopeByType['Element']> {
  const revisedPacket = createClaimedIdentityRevision({
    actorPacket: input.actorPacket,
    alias: input.alias,
  });
  const privateKey = await importPrivateKeyFromJwk(input.privateJwk);

  return signPacketWithIdentity({
    packet: revisedPacket,
    signerPacketId: revisedPacket.header.packet_id,
    kid: input.kid,
    privateKey,
    signedAt: revisedPacket.header.created_at,
  });
}

function createSession(
  actorPacket: PacketEnvelopeByType['Element']
): NexusAuthSessionPayload {
  return {
    is_authenticated: true,
    session_id: 'session-1',
    actor_packet_id: actorPacket.header.packet_id,
    actor_packet: actorPacket,
    session_expires_at: '2026-04-29T00:00:00.000Z',
    refresh_expires_at: '2026-05-05T00:00:00.000Z',
    csrf_token: 'csrf-token',
    auth_method: 'bundle',
    security_mode: 'standard',
    has_passkey: false,
    requires_passkey_upgrade: false,
    reauth_expires_at: null,
  };
}

test('claimed session actor packet wins over stale local bundle packet for writes', async () => {
  const initialIdentity = await createSignedClaimedIdentity({
    alias: 'Testy McGee',
    packetId: 'nexus:element/testy-mcgee',
    createdAt: '2026-04-28T00:00:00.000Z',
  });
  const revisedActorPacket = await createSignedClaimedRevision({
    actorPacket: initialIdentity.actorPacket,
    alias: 'Testy McGee',
    privateJwk: initialIdentity.privateJwk,
    kid: initialIdentity.kid,
  });
  const activeIdentity: ActiveIdentityState = {
    actorPacket: initialIdentity.actorPacket,
    publicJwk: initialIdentity.publicJwk,
    privateJwk: initialIdentity.privateJwk,
    claimStatus: 'claimed',
    storedKind: 'claimed',
  };
  const session = createSession(revisedActorPacket);

  const requestActorPacket = resolveClaimedSessionActorPacket({
    actorPacket: activeIdentity.actorPacket,
    session,
  });
  const adoptedIdentity = adoptClaimedSessionActorPacket(activeIdentity, session);

  assert.equal(requestActorPacket.header.revision_id, revisedActorPacket.header.revision_id);
  assert.equal(adoptedIdentity.actorPacket.header.revision_id, revisedActorPacket.header.revision_id);
});

test('claimed session actor packet preflight rejects unsigned and mismatched signer packets', async () => {
  const identity = await createSignedClaimedIdentity({
    alias: 'Signed User',
    packetId: 'nexus:element/signed-user',
    createdAt: '2026-04-28T00:00:00.000Z',
  });
  const unsignedPacket = createPersonIdentityPacket({
    alias: 'Unsigned User',
    claimStatus: 'claimed',
    publicKeyBinding: identity.actorPacket.body.identity?.public_key_bindings[0] ?? (() => {
      throw new Error('Missing key binding.');
    })(),
    packetId: 'nexus:element/unsigned-user',
    createdAt: '2026-04-28T00:00:00.000Z',
  });
  const mismatchedSignerPacket = await signPacketWithIdentity({
    packet: createPersonIdentityPacket({
      alias: 'Wrong Signer',
      claimStatus: 'claimed',
      publicKeyBinding: identity.actorPacket.body.identity?.public_key_bindings[0] ?? (() => {
        throw new Error('Missing key binding.');
      })(),
      packetId: 'nexus:element/wrong-signer',
      createdAt: '2026-04-28T00:00:00.000Z',
    }),
    signerPacketId: 'nexus:element/not-the-actor',
    kid: identity.kid,
    privateKey: await importPrivateKeyFromJwk(identity.privateJwk),
    signedAt: '2026-04-28T00:00:00.000Z',
  });

  assert.throws(
    () => assertClaimedActorPacketReady(unsignedPacket),
    /missing its embedded signature/i
  );
  assert.throws(
    () => assertClaimedActorPacketReady(mismatchedSignerPacket),
    /signature signer does not match/i
  );
  assert.doesNotThrow(() => assertClaimedActorPacketReady(identity.actorPacket));
});
