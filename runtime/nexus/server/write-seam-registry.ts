/**
 * File: write-seam-registry.ts
 * Description: Explicit classification for every runtime packet writer that remains outside pure read/query code.
 */

export type DirectPacketWriteCategory =
  | 'fortress_actor_write'
  | 'fortress_internal_helper'
  | 'bootstrap_or_seed'
  | 'identity_bootstrap'
  | 'system_backfill'
  | 'temporary_bridge';

export interface DirectPacketWriteSeam {
  category: DirectPacketWriteCategory;
  reason: string;
}

export const DIRECT_PACKET_WRITE_SEAMS = {
  'signed-packet-finalizer.ts': {
    category: 'fortress_actor_write',
    reason: 'Canonical finalized-packet persistence seam for actor-authored mutation corridor writes.',
  },
  'discussion-service.ts': {
    category: 'fortress_internal_helper',
    reason: 'Fortress-internal discussion persistence helper used by finalized discussion mutations.',
  },
  'attestation-service.ts': {
    category: 'fortress_internal_helper',
    reason: 'Fortress-internal attestation persistence helper used by finalized attestation mutations.',
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
    category: 'fortress_internal_helper',
    reason: 'Fortress-internal Preference.element planner/persistence helper; claimed writes enter through the preference fortress workflow while the legacy scope-display table remains a compatibility cache.',
  },
} satisfies Record<string, DirectPacketWriteSeam>;
