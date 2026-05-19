/**
 * File: fortress-handler-domain-assembly.ts
 * Description: Assembly-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createAssemblyPrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<FortressPrepareHandlerMap, 'prepareAssemblyElementCreate'> {
  return {
    prepareAssemblyElementCreate: async ({ intent, actorPacket }) =>
      handlers.prepareAssemblyElementCreate({
        intent: intent as Extract<MutationIntent, { kind: 'assembly.element.create' }>,
        actorPacket,
      }),
  };
}

export function createAssemblyFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<FortressFinalizeHandlerMap, 'finalizeAssemblyElementCreate'> {
  return {
    finalizeAssemblyElementCreate: async ({ actorContext, signedPackets }) =>
      handlers.finalizeAssemblyElementCreate({
        actorContext,
        signedPackets,
      }),
  };
}
