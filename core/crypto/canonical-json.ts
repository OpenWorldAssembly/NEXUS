/**
 * File: canonical-json.ts
 * Description: Shared canonical JSON and digest helpers used by core mutation and signature logic.
 */

type JsonPrimitive = string | number | boolean | null;
type JsonLike = JsonPrimitive | JsonLike[] | { [key: string]: JsonLike };

function getCryptoOrThrow(): Crypto {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    return crypto;
  }

  throw new Error('Web Crypto is unavailable in this environment.');
}

function toJsonLike(input: unknown): JsonLike {
  if (
    input === null ||
    typeof input === 'string' ||
    typeof input === 'number' ||
    typeof input === 'boolean'
  ) {
    return input;
  }

  if (Array.isArray(input)) {
    return input.map((value) => toJsonLike(value));
  }

  if (typeof input === 'object') {
    return Object.fromEntries(
      Object.entries(input as Record<string, unknown>).map(([key, value]) => [
        key,
        toJsonLike(value),
      ])
    );
  }

  return String(input);
}

function canonicalizeValue(value: JsonLike): string {
  if (value === null) {
    return 'null';
  }

  if (typeof value === 'number') {
    return Number.isFinite(value) ? JSON.stringify(value) : 'null';
  }

  if (typeof value === 'boolean' || typeof value === 'string') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeValue(item)).join(',')}]`;
  }

  const sortedKeys = Object.keys(value).sort();

  return `{${sortedKeys
    .map((key) => `${JSON.stringify(key)}:${canonicalizeValue(value[key])}`)
    .join(',')}}`;
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

export function canonicalizeJson(input: unknown): string {
  return canonicalizeValue(toJsonLike(input));
}

export async function sha256Base64Url(
  input: string | Uint8Array
): Promise<string> {
  const cryptoApi = getCryptoOrThrow();
  const bytes = typeof input === 'string' ? encodeUtf8(input) : input;
  const digest = await cryptoApi.subtle.digest('SHA-256', toArrayBuffer(bytes));

  return arrayBufferToBase64Url(digest);
}
