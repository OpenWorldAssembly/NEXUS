/**
 * File: labels.ts
 * Description: Derives browser and nexus display labels from canonical packet families and subtypes.
 */

import type {
  PacketBodyByType,
  PacketEnvelope,
} from '@core/schema/packet-schema';
import {
  getCanonicalElementSubtype,
  getElementSubtypeLeaf,
} from '@core/schema/packet-schema';

const FAMILY_LABELS: Record<PacketEnvelope['header']['family'], string> = {
  Element: 'element packet',
  Location: 'location packet',
  Role: 'role packet',
  Claim: 'claim packet',
  Relation: 'relation packet',
  Report: 'report packet',
  Signal: 'signal packet',
  Proposal: 'proposal packet',
  Vote: 'vote packet',
  Attestation: 'attestation',
  Decision: 'decision packet',
  Cause: 'cause packet',
  Action: 'action packet',
  Initiative: 'initiative packet',
  Program: 'program packet',
  Campaign: 'campaign packet',
  MissionTemplate: 'mission template',
  MissionPlan: 'mission plan',
  MissionReport: 'mission report',
  Module: 'module packet',
  Policy: 'policy packet',
  Discussion: 'discussion packet',
  DiscussionSpace: 'discussion space',
  DiscussionForum: 'discussion forum',
  DiscussionThread: 'discussion thread',
  DiscussionPost: 'discussion post',
  DiscussionReply: 'discussion reply',
  Minutes: 'minutes packet',
  Artifact: 'artifact packet',
};

function titleCase(value: string): string {
  return value
    .split(/[._\s-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ');
}

function safeDecodePacketId(packetId: string): string {
  try {
    return decodeURIComponent(packetId);
  } catch {
    return packetId;
  }
}

function getClaimDisplaySubtype(body: PacketBodyByType['Claim']): string {
  if (body.subtype === 'relation_assertion' && body.claim_kind) {
    return body.claim_kind;
  }

  return body.subtype ?? body.claim_kind ?? 'claim';
}

/**
 * Inputs: a canonical packet id string.
 * Output: a display-only fallback title when no better packet title exists.
 */
export function getPacketTitleFallbackFromPacketId(packetId: string): string {
  const decodedPacketId = safeDecodePacketId(packetId);
  const normalizedPath = decodedPacketId.startsWith('nexus:')
    ? decodedPacketId.slice('nexus:'.length)
    : decodedPacketId;
  const [familySegment = '', subtypeSegment = ''] = normalizedPath.split('/');

  if (familySegment === 'claim' && subtypeSegment) {
    return `${titleCase(subtypeSegment)} claim`;
  }

  if (familySegment === 'attestation' && subtypeSegment) {
    return `${titleCase(subtypeSegment)} attestation`;
  }

  if (familySegment === 'role' && subtypeSegment) {
    return `${titleCase(subtypeSegment)} role`;
  }

  const trailingSegment = normalizedPath.split('/').pop() ?? normalizedPath;

  return titleCase(trailingSegment);
}

export function getPacketDisplayLabel(packet: PacketEnvelope): string {
  switch (packet.header.family) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return `${getElementSubtypeLeaf(
        getCanonicalElementSubtype({
          kind: body.kind,
          subtype: body.subtype ?? null,
        })
      ) ?? body.kind} packet`;
    }
    case 'Cause': {
      const body = packet.body as PacketBodyByType['Cause'];
      return `${titleCase(body.subtype)} cause`;
    }
    case 'Action': {
      const body = packet.body as PacketBodyByType['Action'];
      return `${titleCase(body.subtype)} action`;
    }
    case 'Location': {
      const body = packet.body as PacketBodyByType['Location'];
      return `${titleCase(body.subtype)} location`;
    }
    case 'Relation': {
      const body = packet.body as PacketBodyByType['Relation'];
      return `${titleCase(body.subtype)} relation`;
    }
    case 'Report': {
      const body = packet.body as PacketBodyByType['Report'];
      return `${titleCase(body.subtype)} report`;
    }
    case 'Policy': {
      const body = packet.body as PacketBodyByType['Policy'];
      if (body.policy_kind === 'charter') {
        return 'charter';
      }
      return FAMILY_LABELS.Policy;
    }
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return `${titleCase(body.role_kind)} role`;
    }
    case 'Claim': {
      const body = packet.body as PacketBodyByType['Claim'];
      return `${titleCase(getClaimDisplaySubtype(body))} claim`;
    }
    case 'DiscussionForum': {
      const body = packet.body as PacketBodyByType['DiscussionForum'];
      if (body.forum_kind === 'visitor_lobby') {
        return 'visitor lobby';
      }
      return FAMILY_LABELS.DiscussionForum;
    }
    case 'Discussion': {
      const body = packet.body as PacketBodyByType['Discussion'];
      if (body.kind === 'topic') {
        return 'discussion topic';
      }
      if (body.kind === 'message') {
        return body.role === 'reply' ? 'discussion reply' : 'discussion message';
      }
      return `${body.kind} discussion`;
    }
    case 'DiscussionPost': {
      const body = packet.body as PacketBodyByType['DiscussionPost'];
      if (body.post_kind === 'forum_post') {
        return 'thread root post';
      }
      return FAMILY_LABELS.DiscussionPost;
    }
    case 'DiscussionReply':
      return FAMILY_LABELS.DiscussionReply;
    case 'Attestation':
      return FAMILY_LABELS.Attestation;
    case 'Artifact': {
      const body = packet.body as PacketBodyByType['Artifact'];
      return `${titleCase(body.artifact_kind)} artifact`;
    }
    default:
      return FAMILY_LABELS[packet.header.family];
  }
}

export function getPacketTitle(packet: PacketEnvelope): string {
  switch (packet.header.family) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return body.name;
    }
    case 'Cause': {
      const body = packet.body as PacketBodyByType['Cause'];
      return body.title;
    }
    case 'Action': {
      const body = packet.body as PacketBodyByType['Action'];
      return body.title;
    }
    case 'Location': {
      const body = packet.body as PacketBodyByType['Location'];
      return body.title;
    }
    case 'Relation': {
      const body = packet.body as PacketBodyByType['Relation'];
      return `${titleCase(body.subtype)} relation`;
    }
    case 'Report': {
      const body = packet.body as PacketBodyByType['Report'];
      return `${titleCase(body.subtype)} report`;
    }
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return body.title;
    }
    case 'Claim': {
      const body = packet.body as PacketBodyByType['Claim'];
      return `${titleCase(getClaimDisplaySubtype(body))} claim`;
    }
    case 'Attestation': {
      const body = packet.body as PacketBodyByType['Attestation'];
      return `${titleCase(body.subtype ?? body.attestation_kind)} attestation`;
    }
    case 'Discussion': {
      const body = packet.body as PacketBodyByType['Discussion'];
      return body.kind === 'message' && body.role === 'reply' ? 'Reply' : body.title;
    }
    case 'DiscussionReply':
      return 'Reply';
    default: {
      const body = packet.body as { title?: string; name?: string };

      if (typeof body.title === 'string' && body.title.trim().length > 0) {
        return body.title;
      }

      if (typeof body.name === 'string' && body.name.trim().length > 0) {
        return body.name;
      }

      return getPacketTitleFallbackFromPacketId(packet.header.packet_id);
    }
  }
}

export function getPacketSummary(packet: PacketEnvelope): string | null {
  switch (packet.header.family) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return body.summary ?? null;
    }
    case 'Cause': {
      const body = packet.body as PacketBodyByType['Cause'];
      return body.summary ?? body.purpose_markdown ?? null;
    }
    case 'Action': {
      const body = packet.body as PacketBodyByType['Action'];
      return body.summary ?? body.objective_markdown ?? null;
    }
    case 'Location': {
      const body = packet.body as PacketBodyByType['Location'];
      return body.summary ?? body.descriptor_markdown ?? null;
    }
    case 'Vote':
    case 'Attestation':
      return null;
    case 'MissionReport': {
      const body = packet.body as PacketBodyByType['MissionReport'];
      return body.notes;
    }
    case 'Report': {
      const body = packet.body as PacketBodyByType['Report'];
      return body.summary_markdown ?? body.report_markdown ?? null;
    }
    case 'Policy': {
      const body = packet.body as PacketBodyByType['Policy'];
      return body.summary ?? null;
    }
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return body.summary ?? null;
    }
    case 'Claim': {
      const body = packet.body as PacketBodyByType['Claim'];
      return body.claim_markdown ?? body.note ?? null;
    }
    case 'DiscussionForum': {
      const body = packet.body as PacketBodyByType['DiscussionForum'];
      return body.summary ?? null;
    }
    case 'Discussion': {
      const body = packet.body as PacketBodyByType['Discussion'];
      return body.kind === 'message'
        ? body.content_markdown
        : body.summary ?? null;
    }
    case 'DiscussionSpace': {
      const body = packet.body as PacketBodyByType['DiscussionSpace'];
      return body.summary ?? null;
    }
    default:
      return (packet.body as { summary?: string | null }).summary ?? null;
  }
}

export function getPacketStatus(packet: PacketEnvelope): string | null {
  switch (packet.header.family) {
    case 'Element':
      return (packet.body as PacketBodyByType['Element']).status ?? null;
    case 'Location': {
      const body = packet.body as PacketBodyByType['Location'];
      return body.status;
    }
    case 'Relation': {
      const body = packet.body as PacketBodyByType['Relation'];
      return body.status;
    }
    case 'Report': {
      const body = packet.body as PacketBodyByType['Report'];
      return body.status;
    }
    case 'Decision': {
      const body = packet.body as PacketBodyByType['Decision'];
      return body.outcome;
    }
    case 'Claim': {
      const body = packet.body as PacketBodyByType['Claim'];
      return body.status;
    }
    case 'DiscussionPost':
    case 'DiscussionReply':
      return null;
    case 'Attestation':
      return (packet.body as PacketBodyByType['Attestation']).status;
    case 'Minutes':
      return null;
    case 'Artifact':
      return null;
    default:
      return (packet.body as { status?: string | null }).status ?? null;
  }
}
