/**
 * File: fortress-handler-domain-locality.ts
 * Description: Locality-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createLocalityPrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<
  FortressPrepareHandlerMap,
  'prepareLocalityPathCreate' | 'prepareLocalityGraphApply'
> {
  return {
    prepareLocalityPathCreate: async ({ intent, actorPacket }) =>
      handlers.prepareLocalityPathCreate({
        intent: intent as Extract<MutationIntent, { kind: 'locality.path.create' }>,
        actorPacket,
      }),
    prepareLocalityGraphApply: async ({ intent, actorPacket }) =>
      handlers.prepareLocalityGraphApply({
        intent: intent as Extract<MutationIntent, { kind: 'locality.graph.apply' }>,
        actorPacket,
      }),
  };
}

export function createLocalityFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<
  FortressFinalizeHandlerMap,
  'finalizeLocalityPathCreate' | 'finalizeLocalityGraphApply'
> {
  return {
    finalizeLocalityPathCreate: async ({ storedTicket, actorContext, signedPackets }) =>
      handlers.finalizeLocalityPathCreate({
        actorContext,
        signedPackets,
        storedTicket,
      }),
    finalizeLocalityGraphApply: async ({ storedTicket, actorContext, signedPackets }) =>
      handlers.finalizeLocalityGraphApply({
        actorContext,
        signedPackets,
        storedTicket,
      }),
  };
}
