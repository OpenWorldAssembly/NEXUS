/**
 * File: labels.ts
 * Description: Derives browser and nexus display labels from canonical packet types and subtypes.
 */

import type {
  PacketBodyByType,
  PacketEnvelope,
} from '@core/schema/packet-schema';
import {
  getCanonicalElementSubtype,
  getElementSubtypeLeaf,
} from '@core/schema/packet-schema';

const TYPE_LABELS: Record<PacketEnvelope['header']['type'], string> = {
  Definition: 'definition packet',
  Element: 'element packet',
  Location: 'location packet',
  Role: 'role packet',
  Claim: 'claim packet',
  Relation: 'relation packet',
  Report: 'report packet',
  Proposal: 'proposal packet',
  Vote: 'vote packet',
  Attestation: 'attestation',
  Decision: 'decision packet',
  Action: 'action packet',
  Policy: 'policy packet',
  Preference: 'preference packet',
  Discussion: 'discussion packet',
  Bundle: 'bundle packet',
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
  if (body.subtype === 'relation_assertion' && body.subtype) {
    return body.subtype;
  }

  return body.subtype ?? body.subtype ?? 'claim';
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
  const [typeSegment = '', subtypeSegment = ''] = normalizedPath.split('/');

  if (typeSegment === 'claim' && subtypeSegment) {
    return `${titleCase(subtypeSegment)} claim`;
  }

  if (typeSegment === 'attestation' && subtypeSegment) {
    return `${titleCase(subtypeSegment)} attestation`;
  }

  if (typeSegment === 'role' && subtypeSegment) {
    return `${titleCase(subtypeSegment)} role`;
  }

  const trailingSegment = normalizedPath.split('/').pop() ?? normalizedPath;

  return titleCase(trailingSegment);
}

export function getPacketDisplayLabel(packet: PacketEnvelope): string {
  switch (packet.header.type) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return `${getElementSubtypeLeaf(
        getCanonicalElementSubtype({
          subtype: body.subtype ?? null,
        })
      ) ?? body.subtype} packet`;
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
      if (body.subtype === 'charter') {
        return 'charter';
      }
      return TYPE_LABELS.Policy;
    }
    case 'Preference': {
      const body = packet.body as PacketBodyByType['Preference'];
      return `${titleCase(body.subtype)} preference`;
    }
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return `${titleCase(body.subtype)} role`;
    }
    case 'Claim': {
      const body = packet.body as PacketBodyByType['Claim'];
      return `${titleCase(getClaimDisplaySubtype(body))} claim`;
    }
    case 'Discussion': {
      const body = packet.body as PacketBodyByType['Discussion'];
      if (body.subtype === 'topic') {
        return 'discussion topic';
      }
      if (body.subtype === 'message') {
        return body.role === 'reply' ? 'discussion reply' : 'discussion message';
      }
      return `${body.subtype} discussion`;
    }
    case 'Attestation':
      return TYPE_LABELS.Attestation;
    default:
      return TYPE_LABELS[packet.header.type];
  }
}

export function getPacketTitle(packet: PacketEnvelope): string {
  switch (packet.header.type) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return body.name;
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
      return `${titleCase(body.subtype ?? body.subtype)} attestation`;
    }
    case 'Preference': {
      const body = packet.body as PacketBodyByType['Preference'];
      return `${titleCase(body.subtype)} preference`;
    }
    case 'Discussion': {
      const body = packet.body as PacketBodyByType['Discussion'];
      return body.subtype === 'message' && body.role === 'reply' ? 'Reply' : body.title;
    }
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
  switch (packet.header.type) {
    case 'Element': {
      const body = packet.body as PacketBodyByType['Element'];
      return body.summary ?? null;
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
    case 'Report': {
      const body = packet.body as PacketBodyByType['Report'];
      return body.summary_markdown ?? body.report_markdown ?? null;
    }
    case 'Policy': {
      const body = packet.body as PacketBodyByType['Policy'];
      return body.summary ?? null;
    }
    case 'Preference': {
      const body = packet.body as PacketBodyByType['Preference'];
      return body.note ?? null;
    }
    case 'Role': {
      const body = packet.body as PacketBodyByType['Role'];
      return body.summary ?? null;
    }
    case 'Claim': {
      const body = packet.body as PacketBodyByType['Claim'];
      return body.claim_markdown ?? body.note ?? null;
    }
    case 'Discussion': {
      const body = packet.body as PacketBodyByType['Discussion'];
      return body.subtype === 'message'
        ? body.content_markdown
        : body.summary ?? null;
    }
    default:
      return (packet.body as { summary?: string | null }).summary ?? null;
  }
}

export function getPacketStatus(packet: PacketEnvelope): string | null {
  switch (packet.header.type) {
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
    case 'Attestation':
      return (packet.body as PacketBodyByType['Attestation']).status;
    case 'Preference':
      return (packet.body as PacketBodyByType['Preference']).status;
    default:
      return (packet.body as { status?: string | null }).status ?? null;
  }
}
