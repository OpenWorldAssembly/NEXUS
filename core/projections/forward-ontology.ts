/**
 * File: forward-ontology.ts
 * Description: Projects canonical and legacy packets into the forward Nexus type/subtype ontology.
 */

import type {
  CanonicalRelationSubtype,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketType,
  PacketRef,
} from '@core/schema/packet-schema';
import { getCanonicalElementSubtype } from '@core/schema/packet-schema';

import { getPacketStatus, getPacketSummary, getPacketTitle } from './labels.ts';

export type ForwardPacketType =
  | 'definition'
  | 'bundle'
  | 'element'
  | 'location'
  | 'role'
  | 'claim'
  | 'relation'
  | 'report'
  | 'signal'
  | 'proposal'
  | 'vote'
  | 'reaction'
  | 'decision'
  | 'action'
  | 'discussion'
  | 'policy'
  | 'preference';

export type ForwardPacketProjection = {
  type: ForwardPacketType;
  subtype: string | null;
  title: string;
  summary: string | null;
  status: string | null;
  source_type: PacketType;
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

function toForwardType(type: PacketType): ForwardPacketType {
  switch (type) {
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
    case 'Proposal':
      return 'proposal';
    case 'Reaction':
      return 'reaction';
    case 'Decision':
      return 'decision';
    case 'Action':
      return 'action';
    case 'Discussion':
      return 'discussion';
    case 'Policy':
      return 'policy';
    case 'Preference':
      return 'preference';
    case 'Definition':
      return 'definition';
    case 'Bundle':
      return 'bundle';
  }
}

function toForwardSubtype(packet: PacketEnvelope): string | null {
  switch (packet.header.type) {
    case 'Element':
      return getCanonicalElementSubtype({
        subtype: packet.body.subtype ?? null,
      });
    case 'Location':
    case 'Action':
    case 'Relation':
    case 'Report':
      return packet.body.subtype;
    case 'Claim':
      return packet.body.subtype;
    case 'Role':
      return packet.body.subtype;
    case 'Reaction':
      return packet.body.subtype;
    case 'Discussion':
    case 'Preference':
    case 'Definition':
    case 'Bundle':
    case 'Policy':
    case 'Proposal':
    case 'Reaction':
    case 'Decision':
      return packet.body.subtype;
  }
}

export function projectPacketToForwardOntology(
  packet: PacketEnvelope
): ForwardPacketProjection {
  return {
    type: toForwardType(packet.header.type),
    subtype: toForwardSubtype(packet),
    title: getPacketTitle(packet),
    summary: getPacketSummary(packet),
    status: getPacketStatus(packet),
    source_type: packet.header.type,
    is_legacy_projection: false,
  };
}

export function projectClaimAsRelationAssertion(
  claimPacket: PacketEnvelopeByType['Claim']
): ClaimRelationAssertionProjection {
  const relationAssertion =
    claimPacket.body.relation_assertion ??
    (claimPacket.body.subtype &&
    claimPacket.body.subject_ref &&
    claimPacket.body.target_ref
      ? {
          subtype: claimPacket.body.subtype,
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
