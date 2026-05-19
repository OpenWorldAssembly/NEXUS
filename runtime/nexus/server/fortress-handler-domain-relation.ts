/**
 * File: fortress-handler-domain-relation.ts
 * Description: Relation-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createRelationPrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<
  FortressPrepareHandlerMap,
  | 'prepareAssemblyAssociationClaimCompatibilityAlias'
  | 'prepareAssemblyAssociationRelation'
  | 'prepareHomeLocalityRelation'
  | 'prepareHomeLocalityClaimCompatibilityAlias'
  | 'prepareFollowRelation'
> {
  return {
    prepareAssemblyAssociationClaimCompatibilityAlias: async ({
      intent,
      actorPacket,
    }) =>
      handlers.prepareAssemblyAssociationClaimCompatibilityAlias({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'assembly_association.claim.set' }
        >,
        actorPacket,
      }),
    prepareAssemblyAssociationRelation: async ({ intent, actorPacket }) =>
      handlers.prepareAssemblyAssociationRelation({
        intent: intent as Extract<
          MutationIntent,
          {
            kind:
              | 'assembly_association.relation.set'
              | 'assembly_association.relation.clear';
          }
        >,
        actorPacket,
      }),
    prepareHomeLocalityRelation: async ({ intent, actorPacket }) =>
      handlers.prepareHomeLocalityRelation({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'home_locality.relation.set' }
        >,
        actorPacket,
      }),
    prepareHomeLocalityClaimCompatibilityAlias: async ({ intent, actorPacket }) =>
      handlers.prepareHomeLocalityClaimCompatibilityAlias({
        intent: intent as Extract<MutationIntent, { kind: 'home_locality.claim.set' }>,
        actorPacket,
      }),
    prepareFollowRelation: async ({ intent, actorPacket }) =>
      handlers.prepareFollowRelation({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'follows.relation.set' | 'follows.relation.clear' }
        >,
        actorPacket,
      }),
  };
}

export function createRelationFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<
  FortressFinalizeHandlerMap,
  | 'finalizeAssociationRelationUpdate'
  | 'finalizeHomeLocalityRelation'
  | 'finalizeFollowRelationUpdate'
> {
  return {
    finalizeAssociationRelationUpdate: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeAssociationRelationUpdate({
        actorContext,
        signedPackets,
        storedTicket,
      }),
    finalizeHomeLocalityRelation: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeHomeLocalityRelation({
        actorContext,
        signedPackets,
        storedTicket,
      }),
    finalizeFollowRelationUpdate: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeFollowRelationUpdate({
        actorContext,
        signedPackets,
        storedTicket,
      }),
  };
}
