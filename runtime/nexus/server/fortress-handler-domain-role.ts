/**
 * File: fortress-handler-domain-role.ts
 * Description: Role-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createRolePrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<
  FortressPrepareHandlerMap,
  'prepareRoleParticipationRelation' | 'prepareRoleParticipationAttestation'
> {
  return {
    prepareRoleParticipationRelation: async ({ intent, actorPacket }) =>
      handlers.prepareRoleParticipationRelation({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'relation.participation.add' | 'relation.participation.clear' }
        >,
        actorPacket,
      }),
    prepareRoleParticipationAttestation: async ({ intent, actorPacket }) =>
      handlers.prepareRoleParticipationAttestation({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'relation.participation.attestation.set' }
        >,
        actorPacket,
      }),
  };
}

export function createRoleFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<
  FortressFinalizeHandlerMap,
  'finalizeRoleParticipationRelationUpdate' | 'finalizeRoleParticipationAttestation'
> {
  return {
    finalizeRoleParticipationRelationUpdate: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeRoleParticipationRelationUpdate({
        actorContext,
        signedPackets,
        storedTicket,
      }),
    finalizeRoleParticipationAttestation: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeRoleParticipationAttestation({
        actorContext,
        signedPackets,
        storedTicket,
      }),
  };
}
