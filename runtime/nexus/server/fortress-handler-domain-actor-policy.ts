/**
 * File: fortress-handler-domain-actor-policy.ts
 * Description: Actor-policy-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createActorPolicyPrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<FortressPrepareHandlerMap, 'prepareActorWritePolicyUpdate'> {
  return {
    prepareActorWritePolicyUpdate: async ({ intent, actorPacket }) =>
      handlers.prepareActorWritePolicyUpdate({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'actor.write_policy.update' }
        >,
        actorPacket,
      }),
  };
}

export function createActorPolicyFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<FortressFinalizeHandlerMap, 'finalizeActorWritePolicyUpdate'> {
  return {
    finalizeActorWritePolicyUpdate: async ({ actorContext, signedPackets }) =>
      handlers.finalizeActorWritePolicyUpdate({
        actorContext,
        signedPackets,
      }),
  };
}
