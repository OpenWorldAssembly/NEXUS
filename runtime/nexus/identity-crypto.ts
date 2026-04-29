/**
 * File: identity-crypto.ts
 * Description: Shared cryptographic helpers for Nexus identity packets, actor assertions, and encrypted local bundles.
 */

import type {
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketSignatureCandidateSource,
  RawPacketEnvelopeInput,
} from '@core/schema/packet-schema';
import {
  getRawPacketSignatureCanonicalCandidateDetails,
  parsePacketEnvelope,
  parseRawPacketEnvelopeInput,
} from '@core/schema/packet-schema';
import {
  canonicalizeJson,
  sha256Base64Url,
} from '@core/crypto/canonical-json';

export const IDENTITY_SIGNING_ALGORITHM = 'ES256';
export const IDENTITY_ENCRYPTION_VERSION = 1;

export interface IdentityKeyPairJwk {
  publicJwk: JsonWebKey;
  privateJwk: JsonWebKey;
}

export interface EncryptedIdentityBundle {
  version: number;
  salt: string;
  iv: string;
  cipher_text: string;
}

export interface ActorAssertion {
  actor_packet_id: string;
  kid: string;
  method: string;
  path: string;
  body_digest: string;
  issued_at: string;
  signature: string;
}

function getCryptoOrThrow(): Crypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto;
  }

  throw new Error('Web Crypto is unavailable in this environment.');
}

function encodeUtf8(value: string): Uint8Array {
  return new TextEncoder().encode(value);
}

function toArrayBuffer(value: ArrayBuffer | Uint8Array): ArrayBuffer {
  if (value instanceof ArrayBuffer) {
    return value.slice(0);
  }

  return value.buffer.slice(
    value.byteOffset,
    value.byteOffset + value.byteLength
  ) as ArrayBuffer;
}

function decodeUtf8(value: ArrayBuffer | Uint8Array): string {
  return new TextDecoder().decode(value);
}

function arrayBufferToBase64Url(value: ArrayBuffer | Uint8Array): string {
  const bytes = value instanceof Uint8Array ? value : new Uint8Array(value);
  let binary = '';

  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  const base64 =
    typeof btoa === 'function'
      ? btoa(binary)
      : Buffer.from(binary, 'binary').toString('base64');

  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToUint8Array(value: string): Uint8Array {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue =
    normalizedValue + '='.repeat((4 - (normalizedValue.length % 4 || 4)) % 4);
  const binary =
    typeof atob === 'function'
      ? atob(paddedValue)
      : Buffer.from(paddedValue, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function stripPacketSignatures<TPacket extends PacketEnvelope>(
  packet: TPacket
): TPacket {
  return {
    ...packet,
    header: {
      ...packet.header,
      integrity: {
        ...packet.header.integrity,
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
    },
  } as TPacket;
}

function stripRawPacketSignatures<TPacket extends RawPacketEnvelopeInput>(
  packet: TPacket
): TPacket {
  const headerRecord = packet.header as RawPacketEnvelopeInput['header'] &
    Record<string, unknown>;
  const integrityRecord =
    headerRecord.integrity &&
    typeof headerRecord.integrity === 'object' &&
    !Array.isArray(headerRecord.integrity)
      ? (headerRecord.integrity as Record<string, unknown>)
      : {};

  return {
    ...packet,
    header: {
      ...headerRecord,
      integrity: {
        ...integrityRecord,
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
    },
  };
}

function isPersonElementPacketForVerification(
  packet: PacketEnvelope
): packet is PacketEnvelopeByType['Element'] {
  const body = packet.body as Record<string, unknown>;

  return packet.header.family === 'Element' && body.kind === 'person';
}

function readRawEmbeddedSignature(
  packet: RawPacketEnvelopeInput
): {
  kid: string;
  signature: string;
  signerPacketId: string | null;
} | null {
  const integrity =
    packet.header.integrity &&
    typeof packet.header.integrity === 'object' &&
    !Array.isArray(packet.header.integrity)
      ? (packet.header.integrity as Record<string, unknown>)
      : null;

  if (!integrity) {
    return null;
  }

  const embeddedSignatures = integrity.embedded_signatures;

  if (!Array.isArray(embeddedSignatures) || embeddedSignatures.length === 0) {
    return null;
  }

  const signature = embeddedSignatures[0];

  if (!signature || typeof signature !== 'object' || Array.isArray(signature)) {
    return null;
  }

  const signatureRecord = signature as Record<string, unknown>;

  if (
    typeof signatureRecord.kid !== 'string' ||
    typeof signatureRecord.signature !== 'string'
  ) {
    return null;
  }

  const signerPacketRef =
    signatureRecord.signer_packet_ref &&
    typeof signatureRecord.signer_packet_ref === 'object' &&
    !Array.isArray(signatureRecord.signer_packet_ref)
      ? (signatureRecord.signer_packet_ref as Record<string, unknown>)
      : null;

  return {
    kid: signatureRecord.kid,
    signature: signatureRecord.signature,
    signerPacketId:
      signerPacketRef && typeof signerPacketRef.packet_id === 'string'
        ? signerPacketRef.packet_id
        : null,
  };
}

function readRawPacketDigest(packet: RawPacketEnvelopeInput): string | null {
  const integrity =
    packet.header.integrity &&
    typeof packet.header.integrity === 'object' &&
    !Array.isArray(packet.header.integrity)
      ? (packet.header.integrity as Record<string, unknown>)
      : null;

  return integrity && typeof integrity.digest === 'string'
    ? integrity.digest
    : null;
}

export type PacketSignatureVerificationFailureKind =
  | 'missing_signature'
  | 'key_binding_missing'
  | 'signer_mismatch'
  | 'canonicalization_mismatch'
  | 'signature_invalid';

export interface PacketSignatureVerificationResult {
  isValid: boolean;
  matchedCandidateSource?: PacketSignatureCandidateSource;
  failureKind?: PacketSignatureVerificationFailureKind;
}

export async function generateP256KeyPair(): Promise<CryptoKeyPair> {
  const cryptoApi = getCryptoOrThrow();

  return cryptoApi.subtle.generateKey(
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign', 'verify']
  );
}

export async function exportIdentityKeyPairToJwk(
  keyPair: CryptoKeyPair
): Promise<IdentityKeyPairJwk> {
  const cryptoApi = getCryptoOrThrow();

  return {
    publicJwk: (await cryptoApi.subtle.exportKey(
      'jwk',
      keyPair.publicKey
    )) as JsonWebKey,
    privateJwk: (await cryptoApi.subtle.exportKey(
      'jwk',
      keyPair.privateKey
    )) as JsonWebKey,
  };
}

export async function importPublicKeyFromJwk(publicJwk: JsonWebKey): Promise<CryptoKey> {
  const cryptoApi = getCryptoOrThrow();

  return cryptoApi.subtle.importKey(
    'jwk',
    publicJwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
}

export async function importPrivateKeyFromJwk(
  privateJwk: JsonWebKey
): Promise<CryptoKey> {
  const cryptoApi = getCryptoOrThrow();

  return cryptoApi.subtle.importKey(
    'jwk',
    privateJwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['sign']
  );
}

export async function createIdentityKeyBinding(input: {
  publicJwk: JsonWebKey;
  addedAt: string;
}) {
  const kid = await sha256Base64Url(canonicalizeJson(input.publicJwk));

  return {
    kid,
    alg: IDENTITY_SIGNING_ALGORITHM,
    kty: input.publicJwk.kty ?? 'EC',
    crv:
      typeof input.publicJwk.crv === 'string' ? input.publicJwk.crv : 'P-256',
    public_jwk: input.publicJwk as Record<string, unknown>,
    status: 'active' as const,
    added_at: input.addedAt,
    revoked_at: null,
  };
}

export async function signPacketWithIdentity<TPacket extends PacketEnvelope>(input: {
  packet: TPacket;
  signerPacketId: string;
  kid: string;
  privateKey: CryptoKey;
  signedAt?: string;
}): Promise<TPacket>;
export async function signPacketWithIdentity<TPacket extends PacketEnvelope>(input: {
  packet: TPacket;
  signerPacketId: string;
  kid: string;
  privateKey: CryptoKey;
  signedAt?: string;
}): Promise<TPacket> {
  const cryptoApi = getCryptoOrThrow();
  const signedAt = input.signedAt ?? new Date().toISOString();
  const unsignedPacket = stripPacketSignatures(input.packet);
  const canonicalPacket = canonicalizeJson(unsignedPacket);
  const digest = await sha256Base64Url(canonicalPacket);
  const signatureBuffer = await cryptoApi.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    input.privateKey,
    toArrayBuffer(encodeUtf8(canonicalPacket))
  );

  return {
    ...unsignedPacket,
    header: {
      ...unsignedPacket.header,
      integrity: {
        ...unsignedPacket.header.integrity,
        digest,
        embedded_signatures: [
          {
            kid: input.kid,
            signer_packet_ref: {
              packet_id: input.signerPacketId,
            },
            alg: IDENTITY_SIGNING_ALGORITHM,
            signature: arrayBufferToBase64Url(signatureBuffer),
            signed_at: signedAt,
          },
        ],
      },
    },
  } as TPacket;
}

export async function verifyPacketSignature(input: {
  packet: unknown;
  signerPacket: unknown;
}): Promise<boolean> {
  const result = await verifyPacketSignatureDetailed(input);

  return result.isValid;
}

export async function verifyPacketSignatureDetailed(input: {
  packet: unknown;
  signerPacket: unknown;
}): Promise<PacketSignatureVerificationResult> {
  const cryptoApi = getCryptoOrThrow();
  // Verify against the raw signed envelope first. Adapted packets are a
  // runtime convenience view and must not replace the historical bytes that
  // produced the stored digest/signature.
  const rawPacket = parseRawPacketEnvelopeInput(input.packet);
  const signature = readRawEmbeddedSignature(rawPacket);

  if (!signature) {
    return {
      isValid: false,
      failureKind: 'missing_signature',
    };
  }

  let signerPacket: PacketEnvelopeByType['Element'];

  try {
    const parsedSignerPacket = parsePacketEnvelope(input.signerPacket);

    if (!isPersonElementPacketForVerification(parsedSignerPacket)) {
      return {
        isValid: false,
        failureKind: 'key_binding_missing',
      };
    }

    signerPacket = parsedSignerPacket;
  } catch {
    return {
      isValid: false,
      failureKind: 'key_binding_missing',
    };
  }

  const keyBinding = signerPacket.body.identity?.public_key_bindings.find(
    (binding) => binding.kid === signature.kid && binding.status === 'active'
  );

  if (!keyBinding) {
    return {
      isValid: false,
      failureKind: 'key_binding_missing',
    };
  }

  if (
    signature.signerPacketId &&
    signature.signerPacketId !== signerPacket.header.packet_id
  ) {
    return {
      isValid: false,
      failureKind: 'signer_mismatch',
    };
  }

  const publicKey = await cryptoApi.subtle.importKey(
    'jwk',
    keyBinding.public_jwk as JsonWebKey,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );

  const unsignedPacket = stripRawPacketSignatures(rawPacket);
  const candidatePackets =
    getRawPacketSignatureCanonicalCandidateDetails(unsignedPacket);
  const expectedDigest = readRawPacketDigest(rawPacket);
  let matchedDigestSource: PacketSignatureCandidateSource | undefined;

  if (!expectedDigest) {
    return {
      isValid: false,
      failureKind: 'signature_invalid',
    };
  }

  for (const candidate of candidatePackets) {
    const canonicalPacket = canonicalizeJson(candidate.packet);
    const digest = await sha256Base64Url(canonicalPacket);

    if (digest !== expectedDigest) {
      continue;
    }

    matchedDigestSource = candidate.source;

    const signatureIsValid = await cryptoApi.subtle.verify(
      {
        name: 'ECDSA',
        hash: 'SHA-256',
      },
      publicKey,
      toArrayBuffer(base64UrlToUint8Array(signature.signature)),
      toArrayBuffer(encodeUtf8(canonicalPacket))
    );

    if (signatureIsValid) {
      return {
        isValid: true,
        matchedCandidateSource: candidate.source,
      };
    }
  }

  return {
    isValid: false,
    matchedCandidateSource: matchedDigestSource,
    failureKind: matchedDigestSource
      ? 'signature_invalid'
      : 'canonicalization_mismatch',
  };
}

export async function createActorAssertion(input: {
  actorPacketId: string;
  kid: string;
  privateKey: CryptoKey;
  method: string;
  path: string;
  body: unknown;
  issuedAt?: string;
}): Promise<ActorAssertion> {
  const cryptoApi = getCryptoOrThrow();
  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const bodyDigest = await sha256Base64Url(canonicalizeJson(input.body ?? null));
  const payload = canonicalizeJson({
    actor_packet_id: input.actorPacketId,
    kid: input.kid,
    method: input.method.toUpperCase(),
    path: input.path,
    body_digest: bodyDigest,
    issued_at: issuedAt,
  });
  const signatureBuffer = await cryptoApi.subtle.sign(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    input.privateKey,
    toArrayBuffer(encodeUtf8(payload))
  );

  return {
    actor_packet_id: input.actorPacketId,
    kid: input.kid,
    method: input.method.toUpperCase(),
    path: input.path,
    body_digest: bodyDigest,
    issued_at: issuedAt,
    signature: arrayBufferToBase64Url(signatureBuffer),
  };
}

export async function verifyActorAssertion(input: {
  assertion: ActorAssertion;
  publicJwk: JsonWebKey;
  body: unknown;
}): Promise<boolean> {
  const cryptoApi = getCryptoOrThrow();
  const bodyDigest = await sha256Base64Url(canonicalizeJson(input.body ?? null));

  if (bodyDigest !== input.assertion.body_digest) {
    return false;
  }

  const publicKey = await cryptoApi.subtle.importKey(
    'jwk',
    input.publicJwk,
    {
      name: 'ECDSA',
      namedCurve: 'P-256',
    },
    true,
    ['verify']
  );
  const payload = canonicalizeJson({
    actor_packet_id: input.assertion.actor_packet_id,
    kid: input.assertion.kid,
    method: input.assertion.method.toUpperCase(),
    path: input.assertion.path,
    body_digest: input.assertion.body_digest,
    issued_at: input.assertion.issued_at,
  });

  return cryptoApi.subtle.verify(
    {
      name: 'ECDSA',
      hash: 'SHA-256',
    },
    publicKey,
    toArrayBuffer(base64UrlToUint8Array(input.assertion.signature)),
    toArrayBuffer(encodeUtf8(payload))
  );
}

async function derivePassphraseKey(
  passphrase: string,
  salt: Uint8Array
): Promise<CryptoKey> {
  const cryptoApi = getCryptoOrThrow();
  const baseKey = await cryptoApi.subtle.importKey(
    'raw',
    toArrayBuffer(encodeUtf8(passphrase)),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  return cryptoApi.subtle.deriveKey(
    {
      name: 'PBKDF2',
      hash: 'SHA-256',
      salt: toArrayBuffer(salt),
      iterations: 250000,
    },
    baseKey,
    {
      name: 'AES-GCM',
      length: 256,
    },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptIdentityBundle(input: {
  passphrase: string;
  bundle: unknown;
}): Promise<EncryptedIdentityBundle> {
  const cryptoApi = getCryptoOrThrow();
  const salt = cryptoApi.getRandomValues(new Uint8Array(16));
  const iv = cryptoApi.getRandomValues(new Uint8Array(12));
  const key = await derivePassphraseKey(input.passphrase, salt);
  const cipherText = await cryptoApi.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(iv),
    },
    key,
    toArrayBuffer(encodeUtf8(canonicalizeJson(input.bundle)))
  );

  return {
    version: IDENTITY_ENCRYPTION_VERSION,
    salt: arrayBufferToBase64Url(salt),
    iv: arrayBufferToBase64Url(iv),
    cipher_text: arrayBufferToBase64Url(cipherText),
  };
}

export async function decryptIdentityBundle<TValue>(input: {
  passphrase: string;
  encryptedBundle: EncryptedIdentityBundle;
}): Promise<TValue> {
  const cryptoApi = getCryptoOrThrow();
  const key = await derivePassphraseKey(
    input.passphrase,
    base64UrlToUint8Array(input.encryptedBundle.salt)
  );
  const plainBuffer = await cryptoApi.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: toArrayBuffer(base64UrlToUint8Array(input.encryptedBundle.iv)),
    },
    key,
    toArrayBuffer(base64UrlToUint8Array(input.encryptedBundle.cipher_text))
  );

  return JSON.parse(decodeUtf8(plainBuffer)) as TValue;
}
