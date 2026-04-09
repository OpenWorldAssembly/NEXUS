/**
 * File: labels.ts
 * Description: Derives browser and nexus display labels from canonical packet families and subtypes.
 */

import type {
  PacketBodyByType,
  PacketEnvelope,
} from '@/domain/schema/packet-schema';

const FAMILY_LABELS: Record<PacketEnvelope['header']['family'], string> = {
  Element: 'element packet',
  Signal: 'signal packet',
  Proposal: 'proposal packet',
  Vote: 'vote packet',
  PacketVote: 'packet vote',
  Decision: 'decision packet',
  Initiative: 'initiative packet',
  Program: 'program packet',
  Campaign: 'campaign packet',
  MissionTemplate: 'mission template',
  MissionPlan: 'mission plan',
  MissionReport: 'mission report',
  Module: 'module packet',
  Policy: 'policy packet',
  DiscussionThread: 'discussion thread',
  DiscussionPost: 'discussion post',
  Minutes: 'minutes packet',
  Artifact: 'artifact packet',
};

function titleCase(value: string): string {
  return value
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1))
    .join(' ');
}

export function getPacketDisplayLabel(packet: PacketEnvelope): string {
  switch (packet.header.family) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return `${body.kind} packet`;
    }
    case 'Policy': {
      const body = packet.body as PacketBodyByType['Policy'];
      if (body.policy_kind === 'charter') {
        return 'charter';
      }
      return FAMILY_LABELS.Policy;
    }
    case 'DiscussionPost': {
      const body = packet.body as PacketBodyByType['DiscussionPost'];
      if (body.post_kind === 'forum_post') {
        return 'forum post';
      }
      return FAMILY_LABELS.DiscussionPost;
    }
    case 'PacketVote':
      return FAMILY_LABELS.PacketVote;
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
    case 'PacketVote':
      return 'Packet vote';
    default:
      return (packet.body as { title: string }).title;
  }
}

export function getPacketSummary(packet: PacketEnvelope): string | null {
  switch (packet.header.family) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return body.summary ?? null;
    }
    case 'Vote':
    case 'PacketVote':
      return null;
    case 'MissionReport': {
      const body = packet.body as PacketBodyByType['MissionReport'];
      return body.notes;
    }
    case 'Policy': {
      const body = packet.body as PacketBodyByType['Policy'];
      return body.summary ?? null;
    }
    default:
      return (packet.body as { summary?: string | null }).summary ?? null;
  }
}

export function getPacketStatus(packet: PacketEnvelope): string | null {
  switch (packet.header.family) {
    case 'Element':
      return null;
    case 'Decision': {
      const body = packet.body as PacketBodyByType['Decision'];
      return body.outcome;
    }
    case 'DiscussionPost':
      return null;
    case 'PacketVote':
      return null;
    case 'Minutes':
      return null;
    case 'Artifact':
      return null;
    default:
      return (packet.body as { status?: string | null }).status ?? null;
  }
}
