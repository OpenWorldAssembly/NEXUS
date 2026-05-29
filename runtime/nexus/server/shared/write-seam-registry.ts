/**
 * File: write-seam-registry.ts
 * Description: Explicit classification for every runtime packet writer that remains outside pure read/query code.
 */

export type DirectPacketWriteCategory =
  | 'adapter_internal_helper'
  | 'bootstrap_or_seed'
  | 'identity_bootstrap'
  | 'system_backfill'
  | 'temporary_bridge';

export interface DirectPacketWriteSeam {
  category: DirectPacketWriteCategory;
  reason: string;
}

export const DIRECT_PACKET_WRITE_SEAMS = {
  'discussion-service.ts': {
    category: 'adapter_internal_helper',
    reason: 'Transitional discussion adapter persistence helper; remaining discussion writes should migrate behind Dispatch/Archive or become explicit derived-state cache writes.',
  },
  'reaction-service.ts': {
    category: 'adapter_internal_helper',
    reason: 'Transitional reaction adapter persistence/helper surface used for derived reaction state and compatibility response decoration.',
  },
  'default-discussion-surfaces.ts': {
    category: 'bootstrap_or_seed',
    reason: 'Bootstrap helper that seeds canonical discussion surfaces for empty scopes.',
  },
  'locality-directory-service.ts': {
    category: 'bootstrap_or_seed',
    reason: 'Bootstrap helper that creates canonical locality element paths.',
  },
  'auth-service.ts': {
    category: 'identity_bootstrap',
    reason: 'Identity bootstrap writer that creates the actor element during claimed identity setup.',
  },
  'verification-service.ts': {
    category: 'system_backfill',
    reason: 'System verification writer that stores verification reports and verification-status revisions.',
  },
  'nexus-packet-service-bootstrap.ts': {
    category: 'system_backfill',
    reason: 'System bootstrap/backfill writer for initial packet dataset seeding and recovery.',
  },
  'element-preference-packets.ts': {
    category: 'adapter_internal_helper',
    reason: 'Transitional Preference.element planner/persistence helper; claimed preference writes should migrate behind the trusted write chain while the legacy scope-display table remains a compatibility cache.',
  },
} satisfies Record<string, DirectPacketWriteSeam>;
