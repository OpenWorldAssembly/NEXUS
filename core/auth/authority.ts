/**
 * File: authority.ts
 * Description: Centralizes type-specific mutation authority checks for the first Dispatch write pilot.
 */

import type { DiscussionViewerContext } from '@core/contracts';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';

export type DiscussionAuthorityAction =
  | 'discussion.thread.create'
  | 'discussion.post.create'
  | 'discussion.reply.create';

export function assertDiscussionViewerAuthority(input: {
  viewer: DiscussionViewerContext;
  actionId: DiscussionAuthorityAction;
}): void {
  if (
    (input.actionId === 'discussion.thread.create' ||
      input.actionId === 'discussion.post.create') &&
    !input.viewer.can_create_top_level
  ) {
    throw new Error('Top-level posting is not open to your current actor here.');
  }

  if (
    input.actionId === 'discussion.reply.create' &&
    !input.viewer.can_reply
  ) {
    throw new Error('Replies are not open to your current actor class here.');
  }
}

export function assertCandidateAuthoredByActor(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  packets: PacketEnvelope[];
}): void {
  for (const packet of input.packets) {
    if (
      packet.header.provenance.created_by?.packet_id !==
      input.actorPacket.header.packet_id
    ) {
      throw new Error(
        'Canonical mutation candidate provenance does not match the actor packet.'
      );
    }
  }
}
