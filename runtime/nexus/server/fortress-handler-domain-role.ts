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
  'prepareRoleAssociationClaim' | 'prepareRoleAssociationAttestation'
> {
  return {
    prepareRoleAssociationClaim: async ({ intent, actorPacket }) =>
      handlers.prepareRoleAssociationClaim({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'role_association.claim.set' }
        >,
        actorPacket,
      }),
    prepareRoleAssociationAttestation: async ({ intent, actorPacket }) =>
      handlers.prepareRoleAssociationAttestation({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'role_association.attestation.set' }
        >,
        actorPacket,
      }),
  };
}

export function createRoleFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<
  FortressFinalizeHandlerMap,
  'finalizeClaimUpdate' | 'finalizeRoleAssociationAttestation'
> {
  return {
    finalizeClaimUpdate: async ({ storedTicket, actorContext, signedPackets }) =>
      handlers.finalizeClaimUpdate({
        actorContext,
        signedPackets,
        storedTicket,
      }),
    finalizeRoleAssociationAttestation: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeRoleAssociationAttestation({
        actorContext,
        signedPackets,
        storedTicket,
      }),
  };
}
