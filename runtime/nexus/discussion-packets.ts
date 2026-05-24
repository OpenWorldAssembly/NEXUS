/**
 * File: discussion-packets.ts
 * Description: Re-export surface for canonical discussion packet helpers now owned by domain packets.
 */

export {
  buildDiscussionReplyPacket,
  buildDiscussionRootPostPacket,
  buildDiscussionThreadPacket,
  buildPacketVoteReactionPacket,
  createReactionPacketId,
  createDiscussionReplyPacketId,
  createDiscussionRevisionId,
  createDiscussionRootPostPacketId,
  createDiscussionThreadPacketId,
  createFallbackDiscussionTitle,
  resolveDiscussionScopePacketId,
} from '@core/packets/discussion';
