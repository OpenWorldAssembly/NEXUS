/**
 * File: fortress-handler-domain-discussion.ts
 * Description: Discussion-domain fortress handler composition.
 */

import type { MutationIntent } from '@core/auth/mutation-corridor';
import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';

export function createDiscussionPrepareHandlers(
  handlers: MutationPrepareHandlers
): Pick<
  FortressPrepareHandlerMap,
  | 'prepareDiscussionThreadPost'
  | 'prepareDiscussionReply'
  | 'prepareDiscussionSurfacesEnsure'
> {
  return {
    prepareDiscussionThreadPost: async ({ intent, actorPacket }) =>
      handlers.prepareDiscussionThreadPost({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'discussion.thread_post.create' }
        >,
        actorPacket,
      }),
    prepareDiscussionReply: async ({ intent, actorPacket }) =>
      handlers.prepareDiscussionReply({
        intent: intent as Extract<MutationIntent, { kind: 'discussion.reply.create' }>,
        actorPacket,
      }),
    prepareDiscussionSurfacesEnsure: async ({ intent, actorPacket }) =>
      handlers.prepareDiscussionSurfacesEnsure({
        intent: intent as Extract<
          MutationIntent,
          { kind: 'discussion.surfaces.ensure' }
        >,
        actorPacket,
      }),
  };
}

export function createDiscussionFinalizeHandlers(
  handlers: MutationFinalizeHandlers
): Pick<
  FortressFinalizeHandlerMap,
  | 'finalizeDiscussionThreadPost'
  | 'finalizeDiscussionReply'
  | 'finalizeDiscussionSurfacesEnsure'
> {
  return {
    finalizeDiscussionThreadPost: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeDiscussionThreadPost({
        storedTicket,
        actorContext,
        signedPackets,
      }),
    finalizeDiscussionReply: async ({ storedTicket, actorContext, signedPackets }) =>
      handlers.finalizeDiscussionReply({
        storedTicket,
        actorContext,
        signedPackets,
      }),
    finalizeDiscussionSurfacesEnsure: async ({
      storedTicket,
      actorContext,
      signedPackets,
    }) =>
      handlers.finalizeDiscussionSurfacesEnsure({
        storedTicket,
        actorContext,
        signedPackets,
      }),
  };
}
