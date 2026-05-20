/**
 * File: fortress-handler-domain-preference.ts
 * Description: Preference mutation handler bindings for the signed fortress corridor.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';

export function createPreferencePrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<FortressPrepareHandlerMap, 'preparePreferenceElementSet'> {
  return {
    preparePreferenceElementSet: ({ intent, actorPacket }) =>
      handlers.preparePreferenceElementSet({
        intent: intent as Extract<MutationIntent, { kind: 'preference.element.set' }>,
        actorPacket,
      }),
  };
}

export function createPreferenceFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<FortressFinalizeHandlerMap, 'finalizePreferenceElementSet'> {
  return {
    finalizePreferenceElementSet: ({ storedTicket, actorContext, signedPackets }) =>
      handlers.finalizePreferenceElementSet({
        storedTicket,
        actorContext,
        signedPackets,
      }),
  };
}
