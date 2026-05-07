/**
 * File: forward-ontology.ts
 * Description: Projects canonical and legacy packets into the forward Nexus type/subtype ontology.
 */

import type {
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketFamily,
  PacketRef,
} from '@core/schema/packet-schema';

import { getPacketStatus, getPacketSummary, getPacketTitle } from './labels.ts';

export type ForwardPacketType =
  | 'element'
  | 'location'
  | 'role'
  | 'claim'
  | 'relation'
  | 'signal'
  | 'proposal'
  | 'vote'
  | 'attestation'
  | 'decision'
  | 'cause'
  | 'action'
  | 'module'
  | 'discussion'
  | 'minutes'
  | 'artifact';

export type ForwardPacketProjection = {
  type: ForwardPacketType;
  subtype: string | null;
  title: string;
  summary: string | null;
  status: string | null;
  source_family: PacketFamily;
  is_legacy_projection: boolean;
};

export type ClaimRelationAssertionProjection = {
  relation_subtype: PacketEnvelopeByType['Claim']['body']['claim_kind'];
  subject_ref: PacketRef;
  target_ref: PacketRef;
  scope_ref: PacketRef;
  status: PacketEnvelopeByType['Claim']['body']['status'];
  note: string | null;
  source_claim_packet_id: string;
};

function toForwardType(family: PacketFamily): ForwardPacketType {
  switch (family) {
    case 'Element':
      return 'element';
    case 'Location':
      return 'location';
    case 'Role':
      return 'role';
    case 'Claim':
      return 'claim';
    case 'Relation':
      return 'relation';
    case 'Signal':
      return 'signal';
    case 'Proposal':
      return 'proposal';
    case 'Vote':
      return 'vote';
    case 'Attestation':
      return 'attestation';
    case 'Decision':
      return 'decision';
    case 'Cause':
    case 'Initiative':
    case 'Program':
    case 'Campaign':
      return 'cause';
    case 'Action':
    case 'MissionTemplate':
    case 'MissionPlan':
    case 'MissionReport':
      return 'action';
    case 'Module':
      return 'module';
    case 'Discussion':
    case 'DiscussionSpace':
    case 'DiscussionForum':
    case 'DiscussionThread':
    case 'DiscussionPost':
    case 'DiscussionReply':
      return 'discussion';
    case 'Minutes':
      return 'minutes';
    case 'Artifact':
      return 'artifact';
  }
}

function toForwardSubtype(packet: PacketEnvelope): string | null {
  switch (packet.header.family) {
    case 'Element':
      return packet.body.subtype ?? packet.body.kind ?? null;
    case 'Location':
    case 'Cause':
    case 'Action':
    case 'Relation':
      return packet.body.subtype;
    case 'Claim':
      return packet.body.claim_kind;
    case 'Policy':
      return packet.body.policy_kind;
    case 'Role':
      return packet.body.role_kind;
    case 'Signal':
      return packet.body.signal_kind;
    case 'Proposal':
      return packet.body.proposal_kind;
    case 'Attestation':
      return packet.body.attestation_kind;
    case 'Artifact':
      return packet.body.artifact_kind;
    case 'Discussion':
      return packet.body.kind;
    case 'DiscussionForum':
      return packet.body.forum_kind;
    case 'DiscussionThread':
      return packet.body.thread_kind;
    case 'DiscussionPost':
      return packet.body.post_kind;
    case 'Initiative':
      return 'initiative';
    case 'Program':
      return 'program';
    case 'Campaign':
      return 'campaign';
    case 'MissionTemplate':
      return 'mission_template';
    case 'MissionPlan':
      return 'mission_plan';
    case 'MissionReport':
      return 'mission_report';
    default:
      return null;
  }
}

export function projectPacketToForwardOntology(
  packet: PacketEnvelope
): ForwardPacketProjection {
  return {
    type: toForwardType(packet.header.family),
    subtype: toForwardSubtype(packet),
    title: getPacketTitle(packet),
    summary: getPacketSummary(packet),
    status: getPacketStatus(packet),
    source_family: packet.header.family,
    is_legacy_projection: [
      'Initiative',
      'Program',
      'Campaign',
      'MissionTemplate',
      'MissionPlan',
      'MissionReport',
    ].includes(packet.header.family),
  };
}

export function projectClaimAsRelationAssertion(
  claimPacket: PacketEnvelopeByType['Claim']
): ClaimRelationAssertionProjection {
  return {
    relation_subtype: claimPacket.body.claim_kind,
    subject_ref: claimPacket.body.subject_ref,
    target_ref: claimPacket.body.target_ref,
    scope_ref: claimPacket.body.scope_ref,
    status: claimPacket.body.status,
    note: claimPacket.body.note ?? null,
    source_claim_packet_id: claimPacket.header.packet_id,
  };
}
