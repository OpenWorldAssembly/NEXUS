/**
 * File: discussion-format.ts
 * Description: Presentation formatting helpers for Nexus discussion feature UI.
 */

export function formatDiscussionTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export function formatDiscussionReplyLabel(replyCount: number): string {
  return `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
}
