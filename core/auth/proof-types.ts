/**
 * File: proof-types.ts
 * Description: Declares portable mutation proof levels and proof-bundle helpers for core write admission.
 */

export const WRITE_PROOF_LEVELS = [
  'session',
  'unlocked',
  'reauth',
  'passkey',
] as const;

export type WriteProofLevel = (typeof WRITE_PROOF_LEVELS)[number];

export const MUTATION_PROOF_METHODS = [
  'claimed_session',
  'bundle_unlocked',
  'bundle_passphrase_unlock',
  'signed_reauth',
  'passkey_confirmation',
] as const;

export type MutationProofMethod = (typeof MUTATION_PROOF_METHODS)[number];

export const DEFAULT_REAUTH_PROOF_METHODS = [
  'signed_reauth',
  'bundle_passphrase_unlock',
  'passkey_confirmation',
] as const satisfies readonly MutationProofMethod[];

export const STRONG_REAUTH_PROOF_METHODS = [
  'bundle_passphrase_unlock',
  'passkey_confirmation',
] as const satisfies readonly MutationProofMethod[];

export interface MutationProofBundle {
  actor_packet_id: string | null;
  is_claimed_identity: boolean;
  has_actor_assertion: boolean;
  has_claimed_session: boolean;
  has_unlocked_identity: boolean;
  has_recent_reauth: boolean;
  has_passkey_confirmation: boolean;
  proof_methods: MutationProofMethod[];
}

const WRITE_PROOF_LEVEL_RANK: Record<WriteProofLevel, number> = {
  session: 0,
  unlocked: 1,
  reauth: 2,
  passkey: 3,
};

export function maxWriteProofLevel(
  left: WriteProofLevel,
  right: WriteProofLevel
): WriteProofLevel {
  return WRITE_PROOF_LEVEL_RANK[left] >= WRITE_PROOF_LEVEL_RANK[right]
    ? left
    : right;
}

export function doesProofBundleSatisfyLevel(
  proofs: MutationProofBundle,
  requiredLevel: WriteProofLevel
): boolean {
  switch (requiredLevel) {
    case 'session':
      return (
        proofs.has_actor_assertion &&
        (proofs.has_claimed_session || !proofs.is_claimed_identity)
      );
    case 'unlocked':
      return proofs.has_actor_assertion && proofs.has_unlocked_identity;
    case 'reauth':
      return (
        proofs.has_actor_assertion &&
        proofs.has_unlocked_identity &&
        proofs.has_recent_reauth
      );
    case 'passkey':
      return (
        proofs.has_actor_assertion &&
        proofs.has_unlocked_identity &&
        proofs.has_recent_reauth &&
        proofs.has_passkey_confirmation
      );
    default:
      return false;
  }
}

export function normalizeProofMethods(
  methods: readonly MutationProofMethod[]
): MutationProofMethod[] {
  return [...new Set(methods)];
}

export function getAcceptedProofMethodsForLevel(
  level: WriteProofLevel
): MutationProofMethod[] {
  switch (level) {
    case 'session':
      return ['claimed_session'];
    case 'unlocked':
      return ['bundle_unlocked'];
    case 'reauth':
      return [...DEFAULT_REAUTH_PROOF_METHODS];
    case 'passkey':
      return ['passkey_confirmation'];
    default:
      return [];
  }
}

export function doesProofBundleSatisfyRequirement(input: {
  proofs: MutationProofBundle;
  requiredLevel: WriteProofLevel;
  acceptedMethods?: readonly MutationProofMethod[] | null;
}): boolean {
  if (!doesProofBundleSatisfyLevel(input.proofs, input.requiredLevel)) {
    return false;
  }

  if (input.requiredLevel === 'session' || input.requiredLevel === 'unlocked') {
    return true;
  }

  const acceptedMethods = normalizeProofMethods(
    input.acceptedMethods?.length
      ? input.acceptedMethods
      : getAcceptedProofMethodsForLevel(input.requiredLevel)
  );

  if (acceptedMethods.length === 0) {
    return true;
  }

  return acceptedMethods.some((method) =>
    input.proofs.proof_methods.includes(method)
  );
}

export function describeWriteProofLevel(level: WriteProofLevel): string {
  switch (level) {
    case 'session':
      return 'an active claimed session';
    case 'unlocked':
      return 'an unlocked local identity';
    case 'reauth':
      return 'fresh re-approval';
    case 'passkey':
      return 'fresh passkey confirmation';
    default:
      return 'required proof';
  }
}
