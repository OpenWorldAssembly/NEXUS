/**
 * File: webauthn.ts
 * Description: Provides browser-side helpers for Nexus passkey registration, sign-in, and re-auth ceremonies.
 */

import type {
  NexusPasskeyRequestOptionsPayload,
  NexusPasskeyRegistrationCredentialPayload,
  NexusPasskeyRegistrationOptionsPayload,
  NexusPasskeyAssertionCredentialPayload,
} from '@runtime/nexus/nexus-api-types';

function encodeBase64Url(bytes: ArrayBuffer | Uint8Array): string {
  const value = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);

  let binary = '';
  value.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function decodeBase64Url(value: string): ArrayBuffer {
  const normalizedValue = value.replace(/-/g, '+').replace(/_/g, '/');
  const paddedValue =
    normalizedValue + '='.repeat((4 - (normalizedValue.length % 4 || 4)) % 4);
  const binary = atob(paddedValue);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes.buffer.slice(0);
}

type AttestationResponseWithHelpers = AuthenticatorAttestationResponse & {
  getPublicKey?: () => ArrayBuffer | null;
  getPublicKeyAlgorithm?: () => number;
  getAuthenticatorData?: () => ArrayBuffer;
  getTransports?: () => string[];
};

function requirePasskeySupport(): void {
  if (
    typeof window === 'undefined' ||
    typeof navigator === 'undefined' ||
    !('credentials' in navigator) ||
    typeof PublicKeyCredential === 'undefined'
  ) {
    throw new Error('Passkeys are unavailable in this environment.');
  }
}

export async function isPasskeySupported(): Promise<boolean> {
  if (
    typeof window === 'undefined' ||
    typeof PublicKeyCredential === 'undefined' ||
    typeof PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable !==
      'function'
  ) {
    return false;
  }

  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch {
    return false;
  }
}

export async function registerPasskey(
  optionsPayload: NexusPasskeyRegistrationOptionsPayload
): Promise<NexusPasskeyRegistrationCredentialPayload> {
  requirePasskeySupport();

  const credential = (await navigator.credentials.create({
    publicKey: {
      ...optionsPayload.public_key,
      challenge: decodeBase64Url(optionsPayload.public_key.challenge),
      user: {
        ...optionsPayload.public_key.user,
        id: decodeBase64Url(optionsPayload.public_key.user.id),
      },
      excludeCredentials: optionsPayload.public_key.excludeCredentials.map(
        (credentialDescriptor) => ({
          ...credentialDescriptor,
          id: decodeBase64Url(credentialDescriptor.id),
        })
      ),
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey registration was cancelled.');
  }

  const response = credential.response as AttestationResponseWithHelpers;
  const publicKey = response.getPublicKey?.() ?? null;
  const authenticatorData = response.getAuthenticatorData?.() ?? null;

  if (!publicKey || !authenticatorData) {
    throw new Error('This browser cannot expose the registered passkey public key.');
  }

  return {
    challenge_id: optionsPayload.challenge_id,
    credential: {
      credential_id: credential.id,
      raw_id: encodeBase64Url(credential.rawId),
      client_data_json: encodeBase64Url(response.clientDataJSON),
      authenticator_data: encodeBase64Url(authenticatorData),
      public_key_spki: encodeBase64Url(publicKey),
      algorithm: response.getPublicKeyAlgorithm?.() ?? -7,
      transports: response.getTransports?.() ?? [],
    },
  };
}

export async function completePasskeyAssertion(
  optionsPayload: NexusPasskeyRequestOptionsPayload
): Promise<NexusPasskeyAssertionCredentialPayload> {
  requirePasskeySupport();

  const credential = (await navigator.credentials.get({
    publicKey: {
      ...optionsPayload.public_key,
      challenge: decodeBase64Url(optionsPayload.public_key.challenge),
      allowCredentials: optionsPayload.public_key.allowCredentials.map(
        (credentialDescriptor) => ({
          ...credentialDescriptor,
          id: decodeBase64Url(credentialDescriptor.id),
        })
      ),
    },
  })) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Passkey verification was cancelled.');
  }

  const response = credential.response as AuthenticatorAssertionResponse;

  return {
    challenge_id: optionsPayload.challenge_id,
    credential: {
      credential_id: credential.id,
      raw_id: encodeBase64Url(credential.rawId),
      client_data_json: encodeBase64Url(response.clientDataJSON),
      authenticator_data: encodeBase64Url(response.authenticatorData),
      signature: encodeBase64Url(response.signature),
      user_handle: response.userHandle
        ? encodeBase64Url(response.userHandle)
        : null,
    },
  };
}
