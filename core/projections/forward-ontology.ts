/**
 * File: forward-ontology.ts
 * Description: Projects canonical and legacy packets into the forward Nexus type/subtype ontology.
 */

import type {
  CanonicalRelationSubtype,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketFamily,
  PacketRef,
} from '@core/schema/packet-schema';
import { getCanonicalElementSubtype } from '@core/schema/packet-schema';

import { getPacketStatus, getPacketSummary, getPacketTitle } from './labels.ts';

export type ForwardPacketType =
  | 'element'
  | 'location'
  | 'role'
  | 'claim'
  | 'relation'
  | 'report'
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
  relation_subtype: CanonicalRelationSubtype | string;
  subject_ref: PacketRef;
  target_ref: PacketRef;
  scope_ref: PacketRef | null;
  status: PacketEnvelopeByType['Claim']['body']['status'];
  note: string | null;
  claim_subtype: PacketEnvelopeByType['Claim']['body']['subtype'];
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
    case 'Report':
      return 'report';
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
      return getCanonicalElementSubtype({
        kind: packet.body.kind ?? null,
        subtype: packet.body.subtype ?? null,
      });
    case 'Location':
    case 'Cause':
    case 'Action':
    case 'Relation':
    case 'Report':
      return packet.body.subtype;
    case 'Claim':
      return packet.body.subtype ?? packet.body.claim_kind ?? null;
    case 'Policy':
      return packet.body.policy_kind;
    case 'Role':
      return packet.body.role_kind;
    case 'Signal':
      return packet.body.signal_kind;
    case 'Proposal':
      return packet.body.proposal_kind;
    case 'Attestation':
      return packet.body.subtype ?? packet.body.attestation_kind;
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
  const relationAssertion =
    claimPacket.body.relation_assertion ??
    (claimPacket.body.claim_kind &&
    claimPacket.body.subject_ref &&
    claimPacket.body.target_ref
      ? {
          subtype: claimPacket.body.claim_kind,
          subject_ref: claimPacket.body.subject_ref,
          target_ref: claimPacket.body.target_ref,
          scope_ref: claimPacket.body.scope_ref ?? null,
        }
      : null);

  if (!relationAssertion) {
    throw new Error('Claim does not carry a relation assertion projection.');
  }

  return {
    relation_subtype: relationAssertion.subtype,
    subject_ref: relationAssertion.subject_ref,
    target_ref: relationAssertion.target_ref,
    scope_ref: relationAssertion.scope_ref ?? null,
    status: claimPacket.body.status,
    note: claimPacket.body.claim_markdown ?? claimPacket.body.note ?? null,
    claim_subtype: claimPacket.body.subtype,
    source_claim_packet_id: claimPacket.header.packet_id,
  };
}
