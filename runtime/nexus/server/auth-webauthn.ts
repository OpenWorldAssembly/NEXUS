/**
 * File: auth-webauthn.ts
 * Description: Provides shared WebAuthn helpers for Nexus passkey registration, sign-in, and re-auth verification.
 */

import { createHash, webcrypto } from 'node:crypto';

const COSE_ALGORITHM_ES256 = -7;
const AUTH_DATA_FLAG_USER_PRESENT = 0x01;
const AUTH_DATA_FLAG_USER_VERIFIED = 0x04;
const AUTH_DATA_FLAG_ATTESTED_CREDENTIAL = 0x40;

export interface SerializedPasskeyRegistrationCredential {
  credential_id: string;
  raw_id: string;
  client_data_json: string;
  authenticator_data: string;
  public_key_spki: string;
  algorithm: number;
  transports: string[];
}

export interface SerializedPasskeyAssertionCredential {
  credential_id: string;
  raw_id: string;
  client_data_json: string;
  authenticator_data: string;
  signature: string;
  user_handle: string | null;
}

type ParsedAuthenticatorData = {
  rpIdHash: Uint8Array;
  flags: number;
  signCount: number;
};

function getCryptoOrThrow(): Crypto {
  if (webcrypto?.subtle) {
    return webcrypto as Crypto;
  }

  throw new Error('Web Crypto is unavailable in this environment.');
}

function toBase64(input: string): string {
  return input.replace(/-/g, '+').replace(/_/g, '/');
}

function normalizeBase64Padding(input: string): string {
  return input + '='.repeat((4 - (input.length % 4 || 4)) % 4);
}

export function decodeBase64Url(value: string): Uint8Array {
  const normalizedValue = normalizeBase64Padding(toBase64(value));

  return Uint8Array.from(Buffer.from(normalizedValue, 'base64'));
}

export function encodeBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);

  return Buffer.from(bytes)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/g, '');
}

function decodeUtf8(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes);
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength
  ) as ArrayBuffer;
}

function sha256Bytes(input: Uint8Array): Uint8Array {
  return new Uint8Array(createHash('sha256').update(input).digest());
}

function sha256Text(input: string): Uint8Array {
  return sha256Bytes(new TextEncoder().encode(input));
}

function parseClientDataJson(input: string): {
  type: string;
  challenge: string;
  origin: string;
  crossOrigin?: boolean;
} {
  try {
    return JSON.parse(decodeUtf8(decodeBase64Url(input))) as {
      type: string;
      challenge: string;
      origin: string;
      crossOrigin?: boolean;
    };
  } catch {
    throw new Error('Passkey client data is invalid JSON.');
  }
}

function parseAuthenticatorData(authenticatorData: string): ParsedAuthenticatorData {
  const bytes = decodeBase64Url(authenticatorData);

  if (bytes.length < 37) {
    throw new Error('Authenticator data is too short.');
  }

  const signCountView = new DataView(
    bytes.buffer,
    bytes.byteOffset + 33,
    4
  );

  return {
    rpIdHash: bytes.slice(0, 32),
    flags: bytes[32] ?? 0,
    signCount: signCountView.getUint32(0),
  };
}

function requireExpectedOrigin(input: {
  actualOrigin: string;
  expectedOrigin: string;
}): void {
  if (input.actualOrigin !== input.expectedOrigin) {
    throw new Error('Passkey origin does not match this request origin.');
  }
}

function requireExpectedChallenge(input: {
  actualChallenge: string;
  expectedChallenge: string;
}): void {
  if (input.actualChallenge !== input.expectedChallenge) {
    throw new Error('Passkey challenge does not match the stored challenge.');
  }
}

function requireRpIdHash(input: {
  rpId: string;
  actualRpIdHash: Uint8Array;
}): void {
  const expectedHash = sha256Text(input.rpId);

  if (!Buffer.from(expectedHash).equals(Buffer.from(input.actualRpIdHash))) {
    throw new Error('Passkey RP ID hash does not match this request host.');
  }
}

function requireUserVerified(flags: number): void {
  if ((flags & AUTH_DATA_FLAG_USER_PRESENT) === 0) {
    throw new Error('Passkey interaction must prove user presence.');
  }

  if ((flags & AUTH_DATA_FLAG_USER_VERIFIED) === 0) {
    throw new Error('Passkey interaction must prove user verification.');
  }
}

export function getRequestOrigin(request: Request): string {
  const requestUrl = new URL(request.url);

  return requestUrl.origin;
}

export function getRequestRpId(request: Request): string {
  const requestUrl = new URL(request.url);

  return requestUrl.hostname;
}

export function createWebAuthnRegistrationOptions(input: {
  actorPacketId: string;
  alias: string;
  challenge: string;
  rpId: string;
  rpName?: string;
  existingCredentialIds?: string[];
}) {
  return {
    challenge: input.challenge,
    rp: {
      id: input.rpId,
      name: input.rpName ?? 'OWA Nexus',
    },
    user: {
      id: encodeBase64Url(new TextEncoder().encode(input.actorPacketId)),
      name: input.actorPacketId,
      displayName: input.alias,
    },
    pubKeyCredParams: [
      {
        type: 'public-key' as const,
        alg: COSE_ALGORITHM_ES256,
      },
    ],
    timeout: 60_000,
    attestation: 'none' as const,
    authenticatorSelection: {
      authenticatorAttachment: 'platform' as const,
      residentKey: 'preferred' as const,
      userVerification: 'required' as const,
    },
    excludeCredentials: (input.existingCredentialIds ?? []).map(
      (credentialId) => ({
        id: credentialId,
        type: 'public-key' as const,
      })
    ),
  };
}

export function createWebAuthnRequestOptions(input: {
  challenge: string;
  rpId: string;
  allowCredentialIds?: string[];
}) {
  return {
    challenge: input.challenge,
    timeout: 60_000,
    rpId: input.rpId,
    userVerification: 'required' as const,
    allowCredentials: (input.allowCredentialIds ?? []).map((credentialId) => ({
      id: credentialId,
      type: 'public-key' as const,
    })),
  };
}

export function verifyPasskeyRegistration(input: {
  credential: SerializedPasskeyRegistrationCredential;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
}): {
  credentialId: string;
  publicKeySpki: string;
  counter: number;
  transports: string[];
} {
  const clientData = parseClientDataJson(input.credential.client_data_json);

  if (clientData.type !== 'webauthn.create') {
    throw new Error('Passkey registration client data type is invalid.');
  }

  requireExpectedChallenge({
    actualChallenge: clientData.challenge,
    expectedChallenge: input.expectedChallenge,
  });
  requireExpectedOrigin({
    actualOrigin: clientData.origin,
    expectedOrigin: input.expectedOrigin,
  });

  const authenticatorData = parseAuthenticatorData(
    input.credential.authenticator_data
  );

  requireUserVerified(authenticatorData.flags);
  requireRpIdHash({
    rpId: input.expectedRpId,
    actualRpIdHash: authenticatorData.rpIdHash,
  });

  if ((authenticatorData.flags & AUTH_DATA_FLAG_ATTESTED_CREDENTIAL) === 0) {
    throw new Error('Passkey registration is missing attested credential data.');
  }

  if (input.credential.algorithm !== COSE_ALGORITHM_ES256) {
    throw new Error('Only ES256 passkeys are supported in this build.');
  }

  return {
    credentialId: input.credential.credential_id,
    publicKeySpki: input.credential.public_key_spki,
    counter: authenticatorData.signCount,
    transports: input.credential.transports,
  };
}

export async function verifyPasskeyAssertion(input: {
  credential: SerializedPasskeyAssertionCredential;
  expectedChallenge: string;
  expectedOrigin: string;
  expectedRpId: string;
  publicKeySpki: string;
  previousCounter: number;
}): Promise<{
  credentialId: string;
  nextCounter: number;
}> {
  const cryptoApi = getCryptoOrThrow();
  const clientData = parseClientDataJson(input.credential.client_data_json);

  if (clientData.type !== 'webauthn.get') {
    throw new Error('Passkey assertion client data type is invalid.');
  }

  requireExpectedChallenge({
    actualChallenge: clientData.challenge,
    expectedChallenge: input.expectedChallenge,
  });
  requireExpectedOrigin({
    actualOrigin: clientData.origin,
    expectedOrigin: input.expectedOrigin,
  });

  const authenticatorData = parseAuthenticatorData(
    input.credential.authenticator_data
  );

  requireUserVerified(authenticatorData.flags);
  requireRpIdHash({
    rpId: input.expectedRpId,
    actualRpIdHash: authenticatorData.rpIdHash,
  });

  if (authenticatorData.signCount !== 0) {
    if (authenticatorData.signCount <= input.previousCounter) {
      throw new Error('Passkey signature counter did not advance.');
    }
  }

  const clientDataHash = sha256Bytes(decodeBase64Url(input.credential.client_data_json));
  const signedPayload = new Uint8Array(
    decodeBase64Url(input.credential.authenticator_data).length +
      clientDataHash.length
  );

  signedPayload.set(decodeBase64Url(input.credential.authenticator_data), 0);
  signedPayload.set(
    clientDataHash,
    decodeBase64Url(input.credential.authenticator_data).length
  );

  const publicKey = await cryptoApi.subtle.importKey(
    'spki',
    toArrayBuffer(decodeBase64Url(input.publicKeySpki)),
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
  const signatureIsValid = await cryptoApi.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    publicKey,
    toArrayBuffer(decodeBase64Url(input.credential.signature)),
    toArrayBuffer(signedPayload)
  );

  if (!signatureIsValid) {
    throw new Error('Passkey signature verification failed.');
  }

  return {
    credentialId: input.credential.credential_id,
    nextCounter: authenticatorData.signCount,
  };
}
