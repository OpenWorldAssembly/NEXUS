/**
 * File: mutation-intent-registry.ts
 * Description: Central registry mapping fortress mutation intent kinds to their typed prepare/finalize handlers.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';

export type MutationPrepareHandlerKey =
  | 'prepareLocalityPathCreate'
  | 'prepareLocalityGraphApply'
  | 'prepareDiscussionThreadPost'
  | 'prepareDiscussionReply'
  | 'preparePacketSignal'
  | 'prepareAssemblyElementCreate'
  | 'prepareAssemblyAssociationRelation'
  | 'prepareHomeLocalityRelation'
  | 'prepareFollowRelation'
  | 'prepareRoleAssociationClaim'
  | 'prepareRoleAssociationAttestation'
  | 'prepareDiscussionSurfacesEnsure'
  | 'prepareActorWritePolicyUpdate';

export type MutationFinalizeHandlerKey =
  | 'finalizeLocalityPathCreate'
  | 'finalizeLocalityGraphApply'
  | 'finalizeDiscussionThreadPost'
  | 'finalizeDiscussionReply'
  | 'finalizePacketSignal'
  | 'finalizeAssemblyElementCreate'
  | 'finalizeAssociationRelationUpdate'
  | 'finalizeHomeLocalityRelation'
  | 'finalizeFollowRelationUpdate'
  | 'finalizeClaimUpdate'
  | 'finalizeRoleAssociationAttestation'
  | 'finalizeDiscussionSurfacesEnsure'
  | 'finalizeActorWritePolicyUpdate';

export type MutationIntentDescriptor = {
  kind: MutationIntent['kind'];
  domain: 'locality' | 'discussion' | 'attestation' | 'assembly' | 'relation' | 'role' | 'actor_policy';
  prepare: MutationPrepareHandlerKey;
  finalize: MutationFinalizeHandlerKey;
};

const MUTATION_INTENT_DESCRIPTORS = [
  {
    kind: 'locality.path.create',
    domain: 'locality',
    prepare: 'prepareLocalityPathCreate',
    finalize: 'finalizeLocalityPathCreate',
  },
  {
    kind: 'locality.graph.apply',
    domain: 'locality',
    prepare: 'prepareLocalityGraphApply',
    finalize: 'finalizeLocalityGraphApply',
  },
  {
    kind: 'discussion.thread_post.create',
    domain: 'discussion',
    prepare: 'prepareDiscussionThreadPost',
    finalize: 'finalizeDiscussionThreadPost',
  },
  {
    kind: 'discussion.reply.create',
    domain: 'discussion',
    prepare: 'prepareDiscussionReply',
    finalize: 'finalizeDiscussionReply',
  },
  {
    kind: 'discussion.surfaces.ensure',
    domain: 'discussion',
    prepare: 'prepareDiscussionSurfacesEnsure',
    finalize: 'finalizeDiscussionSurfacesEnsure',
  },
  {
    kind: 'attestation.packet_signal.set',
    domain: 'attestation',
    prepare: 'preparePacketSignal',
    finalize: 'finalizePacketSignal',
  },
  {
    kind: 'assembly.element.create',
    domain: 'assembly',
    prepare: 'prepareAssemblyElementCreate',
    finalize: 'finalizeAssemblyElementCreate',
  },
  {
    kind: 'assembly_association.relation.set',
    domain: 'relation',
    prepare: 'prepareAssemblyAssociationRelation',
    finalize: 'finalizeAssociationRelationUpdate',
  },
  {
    kind: 'assembly_association.relation.clear',
    domain: 'relation',
    prepare: 'prepareAssemblyAssociationRelation',
    finalize: 'finalizeAssociationRelationUpdate',
  },
  {
    kind: 'home_locality.relation.set',
    domain: 'relation',
    prepare: 'prepareHomeLocalityRelation',
    finalize: 'finalizeHomeLocalityRelation',
  },
  {
    kind: 'follows.relation.set',
    domain: 'relation',
    prepare: 'prepareFollowRelation',
    finalize: 'finalizeFollowRelationUpdate',
  },
  {
    kind: 'follows.relation.clear',
    domain: 'relation',
    prepare: 'prepareFollowRelation',
    finalize: 'finalizeFollowRelationUpdate',
  },
  {
    kind: 'role_association.claim.set',
    domain: 'role',
    prepare: 'prepareRoleAssociationClaim',
    finalize: 'finalizeClaimUpdate',
  },
  {
    kind: 'role_association.attestation.set',
    domain: 'role',
    prepare: 'prepareRoleAssociationAttestation',
    finalize: 'finalizeRoleAssociationAttestation',
  },
  {
    kind: 'actor.write_policy.update',
    domain: 'actor_policy',
    prepare: 'prepareActorWritePolicyUpdate',
    finalize: 'finalizeActorWritePolicyUpdate',
  },
] as const satisfies readonly MutationIntentDescriptor[];

const MUTATION_INTENT_DESCRIPTOR_BY_KIND = new Map<
  MutationIntent['kind'],
  MutationIntentDescriptor
>(
  MUTATION_INTENT_DESCRIPTORS.map((descriptor) => [
    descriptor.kind,
    descriptor as MutationIntentDescriptor,
  ])
);

export function getMutationIntentDescriptor(
  kind: MutationIntent['kind']
): MutationIntentDescriptor {
  const descriptor = MUTATION_INTENT_DESCRIPTOR_BY_KIND.get(kind);

  if (!descriptor) {
    throw new Error(`Unsupported mutation kind: ${kind}`);
  }

  return descriptor;
}

export function listMutationIntentDescriptors(): readonly MutationIntentDescriptor[] {
  return MUTATION_INTENT_DESCRIPTORS;
}
