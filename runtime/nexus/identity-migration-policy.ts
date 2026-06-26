/**
 * File: identity-migration-policy.ts
 * Description: Temporary legacy identity migration policy for the current reseed transition.
 */

export const LEGACY_IDENTITY_MIGRATION_POLICY = {
  enabled: true,
  migration_version: 1,
  legacy_window_label: 'current-reseed-transition',
  sunset_after: null as string | null,
};

export type LegacyIdentityMigrationPolicy =
  typeof LEGACY_IDENTITY_MIGRATION_POLICY;
