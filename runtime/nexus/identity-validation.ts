/**
 * File: identity-validation.ts
 * Description: Defines shared validation and normalization rules for Nexus identity auth forms.
 */

import type { IdentityLocationDisclosure } from '@runtime/nexus/identity-shell';

export const DISPLAY_ALIAS_MIN_LENGTH = 3;
export const DISPLAY_ALIAS_MAX_LENGTH = 48;
export const PASSPHRASE_MIN_LENGTH = 12;
export const PASSPHRASE_EXPORT_MIN_LENGTH = 12;
export const RESERVED_DISPLAY_ALIASES = new Set([
  'admin',
  'administrator',
  'guest',
  'nexus',
  'owa',
  'system',
  'support',
]);
export const ALLOWED_LOCATION_DISCLOSURE_SCOPES = new Set([
  'nation',
  'region',
  'city',
  'district',
]);

export type IdentityFieldErrors = {
  alias?: string;
  passphrase?: string;
  passphraseConfirmation?: string;
  location?: string;
  restoreBundle?: string;
  restorePassphrase?: string;
  signInPassphrase?: string;
  exportPassphrase?: string;
};

/**
 * Inputs: a display alias string.
 * Output: a normalized alias with internal whitespace collapsed.
 */
export function normalizeDisplayAlias(alias: string): string {
  return alias.replace(/\s+/g, ' ').trim();
}

/**
 * Inputs: a display alias string.
 * Output: an error message when the alias is invalid, otherwise null.
 */
export function validateDisplayAlias(alias: string): string | null {
  const normalizedAlias = normalizeDisplayAlias(alias);

  if (normalizedAlias.length < DISPLAY_ALIAS_MIN_LENGTH) {
    return `Display alias must be at least ${DISPLAY_ALIAS_MIN_LENGTH} characters.`;
  }

  if (normalizedAlias.length > DISPLAY_ALIAS_MAX_LENGTH) {
    return `Display alias must stay under ${DISPLAY_ALIAS_MAX_LENGTH} characters.`;
  }

  if (!/^[A-Za-z0-9](?:[A-Za-z0-9 ._'-]*[A-Za-z0-9])?$/.test(normalizedAlias)) {
    return 'Display alias can use letters, numbers, spaces, apostrophes, periods, dashes, and underscores.';
  }

  if (RESERVED_DISPLAY_ALIASES.has(normalizedAlias.toLowerCase())) {
    return 'Choose a different display alias.';
  }

  return null;
}

/**
 * Inputs: a passphrase string and optional minimum length.
 * Output: an error message when the passphrase is invalid, otherwise null.
 */
export function validatePassphrase(
  passphrase: string,
  minimumLength = PASSPHRASE_MIN_LENGTH
): string | null {
  const trimmedPassphrase = passphrase.trim();

  if (trimmedPassphrase.length < minimumLength) {
    return `Passphrase must be at least ${minimumLength} characters.`;
  }

  if (trimmedPassphrase.length !== passphrase.length) {
    return 'Passphrase cannot start or end with spaces.';
  }

  return null;
}

/**
 * Inputs: a passphrase and confirmation string.
 * Output: an error message when the confirmation does not match, otherwise null.
 */
export function validatePassphraseConfirmation(
  passphrase: string,
  confirmation: string
): string | null {
  if (confirmation.trim().length === 0) {
    return 'Confirm the passphrase for this encrypted bundle.';
  }

  if (passphrase !== confirmation) {
    return 'The passphrase confirmation does not match.';
  }

  return null;
}

/**
 * Inputs: optional location disclosure metadata.
 * Output: an error message when the disclosure is invalid, otherwise null.
 */
export function validateLocationDisclosure(
  locationDisclosure: IdentityLocationDisclosure | null | undefined
): string | null {
  if (!locationDisclosure) {
    return null;
  }

  if (!ALLOWED_LOCATION_DISCLOSURE_SCOPES.has(locationDisclosure.scope)) {
    return 'Choose a valid location disclosure level.';
  }

  if (locationDisclosure.value.trim().length < 2) {
    return 'Choose a valid location result before sharing it.';
  }

  return null;
}

/**
 * Inputs: an encrypted bundle JSON string.
 * Output: an error message when the bundle text is obviously invalid, otherwise null.
 */
export function validateEncryptedBundleJson(bundleJson: string): string | null {
  if (bundleJson.trim().length === 0) {
    return 'Paste an encrypted identity bundle.';
  }

  try {
    JSON.parse(bundleJson);
    return null;
  } catch {
    return 'Encrypted bundle must be valid JSON.';
  }
}
