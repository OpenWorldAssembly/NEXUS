/**
 * File: discussion-packets.ts
 * Description: Backward-compatible re-export surface for canonical discussion packet helpers now owned by domain packets.
 */

export {
  buildDiscussionReplyPacket,
  buildDiscussionRootPostPacket,
  buildDiscussionThreadPacket,
  buildPacketSignalAttestationPacket,
  createAttestationPacketId,
  createDiscussionReplyPacketId,
  createDiscussionRevisionId,
  createDiscussionRootPostPacketId,
  createDiscussionThreadPacketId,
  createFallbackDiscussionTitle,
  resolveDiscussionScopePacketId,
} from '@core/packets/discussion';
