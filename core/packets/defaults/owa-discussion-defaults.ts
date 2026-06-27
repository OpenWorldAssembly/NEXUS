/**
 * File: owa-discussion-defaults.ts
 * Description: OWA initiative-specific discussion default overrides.
 */

import type {
  ElementDiscussionForumSummaryOverrides,
  ElementDiscussionStarterThreadInput,
} from '@core/packets/defaults/element-discussion-defaults.ts';
import type { PacketRef } from '@core/schema/packet-schema.ts';

export const OWA_INITIATIVE_PACKET_ID = 'nexus:action/owa';
export const LEGACY_OWA_INITIATIVE_PACKET_ID = 'nexus:action/initiative/owa';

export type OwaElementDiscussionDefaultOverrides = {
  welcomeThread: ElementDiscussionStarterThreadInput;
  forumSummaryOverrides: ElementDiscussionForumSummaryOverrides;
};

export function isOwaInitiativePacketId(packetId?: string | null): boolean {
  return (
    packetId === OWA_INITIATIVE_PACKET_ID ||
    packetId === LEGACY_OWA_INITIATIVE_PACKET_ID
  );
}

export function hasOwaInitiativeRef(
  refs: readonly PacketRef[] | null | undefined
): boolean {
  return (refs ?? []).some((ref) => isOwaInitiativePacketId(ref.packet_id));
}

export function createOwaElementDiscussionDefaultOverrides(input: {
  elementName: string;
  relatedRefs?: PacketRef[];
}): OwaElementDiscussionDefaultOverrides {
  return {
    welcomeThread: {
      forumKind: 'visitor_lobby',
      suffix: 'welcome',
      title: `${input.elementName} community welcome`,
      body: [
        `This is the public community space for ${input.elementName}.`,
        '',
        'Use it to introduce yourself, share local context, invite neighbors into Nexus, and show how packet-backed discussion can help the community coordinate openly.',
      ].join('\n\n'),
      relatedRefs: input.relatedRefs ?? [],
    },
    forumSummaryOverrides: {
      visitor_lobby:
        'Public community welcome space for introductions, local context, and locality discovery.',
    },
  };
}

export function resolveOwaElementDiscussionDefaultOverrides(input: {
  elementName: string;
  initiativeRef?: PacketRef | null;
  applicableScopeRefs?: readonly PacketRef[];
  relatedRefs?: PacketRef[];
}): OwaElementDiscussionDefaultOverrides | null {
  if (
    isOwaInitiativePacketId(input.initiativeRef?.packet_id) ||
    hasOwaInitiativeRef(input.applicableScopeRefs)
  ) {
    return createOwaElementDiscussionDefaultOverrides({
      elementName: input.elementName,
      relatedRefs: input.relatedRefs,
    });
  }

  return null;
}
