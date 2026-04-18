/**
 * File: labels.ts
 * Description: Derives browser and nexus display labels from canonical packet families and subtypes.
 */

import type {
  PacketBodyByType,
  PacketEnvelope,
} from '@core/schema/packet-schema';

const FAMILY_LABELS: Record<PacketEnvelope['header']['family'], string> = {
  Element: 'element packet',
  Role: 'role packet',
  Signal: 'signal packet',
  Proposal: 'proposal packet',
  Vote: 'vote packet',
  Attestation: 'attestation',
  Decision: 'decision packet',
  Initiative: 'initiative packet',
  Program: 'program packet',
  Campaign: 'campaign packet',
  MissionTemplate: 'mission template',
  MissionPlan: 'mission plan',
  MissionReport: 'mission report',
  Module: 'module packet',
  Policy: 'policy packet',
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
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return `${titleCase(body.role_kind)} role`;
    }
    case 'DiscussionForum': {
      const body = packet.body as PacketBodyByType['DiscussionForum'];
      if (body.forum_kind === 'visitor_lobby') {
        return 'visitor lobby';
      }
      return FAMILY_LABELS.DiscussionForum;
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
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return body.title;
    }
    case 'Attestation':
      return 'Attestation';
    case 'DiscussionReply':
      return 'Reply';
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
    case 'Attestation':
      return null;
    case 'MissionReport': {
      const body = packet.body as PacketBodyByType['MissionReport'];
      return body.notes;
    }
    case 'Policy': {
      const body = packet.body as PacketBodyByType['Policy'];
      return body.summary ?? null;
    }
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return body.summary ?? null;
    }
    case 'DiscussionForum': {
      const body = packet.body as PacketBodyByType['DiscussionForum'];
      return body.summary ?? null;
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
      return null;
    case 'Decision': {
      const body = packet.body as PacketBodyByType['Decision'];
      return body.outcome;
    }
    case 'DiscussionPost':
    case 'DiscussionReply':
      return null;
    case 'Attestation':
      return null;
    case 'Minutes':
      return null;
    case 'Artifact':
      return null;
    default:
      return (packet.body as { status?: string | null }).status ?? null;
  }
}
