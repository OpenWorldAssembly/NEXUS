/**
 * File: mutating-service-audit-registry.ts
 * Description: Route-audit registry of server methods that should not be called from non-canonical API routes.
 */

export interface MutatingServiceAuditEntry {
  pattern: string;
  reason: string;
}

export const MUTATING_SERVICE_AUDIT_ENTRIES: MutatingServiceAuditEntry[] = [
  {
    pattern: 'discussionService.createPost(',
    reason: 'Discussion writes must enter through the shared mutation corridor.',
  },
  {
    pattern: 'discussionService.createReply(',
    reason: 'Discussion writes must enter through the shared mutation corridor.',
  },
  {
    pattern: 'reactionService.setReaction(',
    reason: 'Reaction writes must enter through the shared mutation corridor.',
  },
  {
    pattern: 'reactionService.persistSignedReaction(',
    reason: 'Reaction persistence is fortress-internal and should not be route-invoked directly.',
  },
];
