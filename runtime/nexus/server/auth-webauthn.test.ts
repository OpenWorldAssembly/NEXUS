import test from 'node:test';
import assert from 'node:assert/strict';
import type { KeyObject } from 'node:crypto';
import { createHash, createSign, generateKeyPairSync } from 'node:crypto';

import {
  decodeBase64Url,
  encodeBase64Url,
  verifyPasskeyAssertion,
} from './auth-webauthn.ts';

type TestKeyPair = {
  publicKey: KeyObject;
  privateKey: KeyObject;
};

function createAuthenticatorData(input: {
  rpId: string;
  signCount: number;
}): Uint8Array {
  const rpIdHash = createHash('sha256').update(input.rpId).digest();
  const authenticatorData = new Uint8Array(37);

  authenticatorData.set(rpIdHash, 0);
  authenticatorData[32] = 0x05;
  new DataView(authenticatorData.buffer).setUint32(33, input.signCount);

  return authenticatorData;
}

function createAssertionFixture(input?: {
  challenge?: string;
  origin?: string;
  rpId?: string;
  signCount?: number;
  keyPair?: TestKeyPair;
}) {
  const keyPair =
    input?.keyPair ??
    generateKeyPairSync('ec', {
      namedCurve: 'prime256v1',
    });
  const challenge = input?.challenge ?? 'passkey-challenge';
  const origin = input?.origin ?? 'https://nexus.local';
  const rpId = input?.rpId ?? 'nexus.local';
  const signCount = input?.signCount ?? 1;
  const clientDataJsonBytes = new TextEncoder().encode(
    JSON.stringify({
      type: 'webauthn.get',
      challenge,
      origin,
    })
  );
  const authenticatorData = createAuthenticatorData({
    rpId,
    signCount,
  });
  const signedPayload = Buffer.concat([
    Buffer.from(authenticatorData),
    createHash('sha256').update(clientDataJsonBytes).digest(),
  ]);
  const signer = createSign('SHA256');

  signer.update(signedPayload);
  signer.end();

  return {
    challenge,
    origin,
    rpId,
    signCount,
    keyPair,
    publicKeySpki: encodeBase64Url(
      (keyPair.publicKey as KeyObject).export({
        type: 'spki',
        format: 'der',
      }) as Buffer
    ),
    credential: {
      credential_id: 'test-passkey',
      raw_id: encodeBase64Url(new TextEncoder().encode('test-passkey-raw')),
      client_data_json: encodeBase64Url(clientDataJsonBytes),
      authenticator_data: encodeBase64Url(authenticatorData),
      signature: encodeBase64Url(signer.sign(keyPair.privateKey as KeyObject)),
      user_handle: null,
    },
  };
}

test('verifyPasskeyAssertion accepts DER-encoded ES256 authenticator signatures', async () => {
  const fixture = createAssertionFixture();

  const result = await verifyPasskeyAssertion({
    credential: fixture.credential,
    expectedChallenge: fixture.challenge,
    expectedOrigin: fixture.origin,
    expectedRpId: fixture.rpId,
    publicKeySpki: fixture.publicKeySpki,
    previousCounter: 0,
  });

  assert.equal(result.credentialId, fixture.credential.credential_id);
  assert.equal(result.nextCounter, fixture.signCount);
});

test('the same registered passkey can verify successive sign-in and reauth assertions', async () => {
  const sharedKeyPair = generateKeyPairSync('ec', {
    namedCurve: 'prime256v1',
  });
  const signInFixture = createAssertionFixture({
    challenge: 'signin-challenge',
    signCount: 1,
    keyPair: sharedKeyPair,
  });
  const reauthFixture = createAssertionFixture({
    challenge: 'reauth-challenge',
    signCount: 2,
    keyPair: sharedKeyPair,
  });

  await assert.doesNotReject(async () => {
    await verifyPasskeyAssertion({
      credential: signInFixture.credential,
      expectedChallenge: signInFixture.challenge,
      expectedOrigin: signInFixture.origin,
      expectedRpId: signInFixture.rpId,
      publicKeySpki: signInFixture.publicKeySpki,
      previousCounter: 0,
    });

    await verifyPasskeyAssertion({
      credential: reauthFixture.credential,
      expectedChallenge: reauthFixture.challenge,
      expectedOrigin: reauthFixture.origin,
      expectedRpId: reauthFixture.rpId,
      publicKeySpki: reauthFixture.publicKeySpki,
      previousCounter: 1,
    });
  });
});

test('verifyPasskeyAssertion rejects mismatched challenges', async () => {
  const fixture = createAssertionFixture();

  await assert.rejects(
    verifyPasskeyAssertion({
      credential: fixture.credential,
      expectedChallenge: 'other-challenge',
      expectedOrigin: fixture.origin,
      expectedRpId: fixture.rpId,
      publicKeySpki: fixture.publicKeySpki,
      previousCounter: 0,
    }),
    /challenge does not match/
  );
});

test('verifyPasskeyAssertion rejects wrong origins', async () => {
  const fixture = createAssertionFixture();

  await assert.rejects(
    verifyPasskeyAssertion({
      credential: fixture.credential,
      expectedChallenge: fixture.challenge,
      expectedOrigin: 'https://wrong.local',
      expectedRpId: fixture.rpId,
      publicKeySpki: fixture.publicKeySpki,
      previousCounter: 0,
    }),
    /origin does not match/
  );
});

test('verifyPasskeyAssertion rejects tampered signatures', async () => {
  const fixture = createAssertionFixture();
  const signatureBytes = decodeBase64Url(fixture.credential.signature);

  signatureBytes[signatureBytes.length - 1] ^= 0x01;

  await assert.rejects(
    verifyPasskeyAssertion({
      credential: {
        ...fixture.credential,
        signature: encodeBase64Url(signatureBytes),
      },
      expectedChallenge: fixture.challenge,
      expectedOrigin: fixture.origin,
      expectedRpId: fixture.rpId,
      publicKeySpki: fixture.publicKeySpki,
      previousCounter: 0,
    }),
    /signature verification failed/
  );
});

test('verifyPasskeyAssertion rejects non-advancing signature counters', async () => {
  const fixture = createAssertionFixture({
    signCount: 4,
  });

  await assert.rejects(
    verifyPasskeyAssertion({
      credential: fixture.credential,
      expectedChallenge: fixture.challenge,
      expectedOrigin: fixture.origin,
      expectedRpId: fixture.rpId,
      publicKeySpki: fixture.publicKeySpki,
      previousCounter: 4,
    }),
    /counter did not advance/
  );
});
