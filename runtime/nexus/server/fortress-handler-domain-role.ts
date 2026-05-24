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
  'prepareRoleParticipationRelation'
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
  };
}

export function createRoleFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<
  FortressFinalizeHandlerMap,
  'finalizeRoleParticipationRelationUpdate'
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
  };
}
