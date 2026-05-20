/**
 * File: packet-definition-seeds.ts
 * Description: Packet-shaped seed material and audits for manifest-native Definition and Bundle profiles.
 */

import { createHash } from 'node:crypto';

import { listPacketDefinitionParts } from '@core/packets/packet-definition-helpers.ts';
import {
  buildPacketTypeBodyCandidate,
  type PacketTypeBodyCandidate,
} from '@core/packets/packet-type-body-builders.ts';
import type { BundleBody, BundleItem } from '@core/packets/definitions/bundle.ts';
import type { DefinitionBody } from '@core/packets/definitions/definition.ts';
import type {
  PacketDefinitionPartDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  listExperimentalPacketTypeDefinitions,
  PACKET_DEFINITION_MANIFEST,
} from '@core/packets/packet-definition-manifest.ts';
import type { PacketRef, PacketRevisionRef } from '@core/schema/packet-schema';

export const SEEDED_DEFINITION_PROFILE_ID =
  'nexus:definition-profile/pre-reseed-active-manifest';
export const SEEDED_DEFINITION_BUNDLE_PACKET_ID =
  'nexus:bundle/pre-reseed-active-definitions';
export const SEEDED_DEFINITION_CREATED_AT = '2026-05-20T00:00:00.000Z';

export type SeededDefinitionPacketCandidate = {
  seed_kind: 'packet_definition.seed_candidate';
  packet_ref: PacketRef;
  revision_ref: PacketRevisionRef;
  defines_packet_type: string;
  defines_packet_subtype: string | null;
  part_id: string;
  part_subtype: PacketDefinitionPartDescriptor['part_subtype'];
  schema_version: string;
  body_candidate: PacketTypeBodyCandidate<DefinitionBody>;
  body_digest: string;
};

export type SeededDefinitionBundleCandidate = {
  seed_kind: 'packet_definition.bundle_seed_candidate';
  packet_ref: PacketRef;
  revision_ref: PacketRevisionRef;
  body_candidate: PacketTypeBodyCandidate<BundleBody>;
  body_digest: string;
  manifest_digest: string;
};

export type SeededPacketDefinitionProfile = {
  profile_id: typeof SEEDED_DEFINITION_PROFILE_ID;
  manifest_version: string;
  manifest_digest: string;
  definition_packets: SeededDefinitionPacketCandidate[];
  bundle_packet: SeededDefinitionBundleCandidate;
};

export type SeededPacketDefinitionAuditReport = {
  report_kind: 'packet_definition.seed_profile_audit';
  status: 'pass' | 'fail';
  checked_definition_count: number;
  checked_part_count: number;
  bundled_part_count: number;
  manifest_digest: string;
  findings: string[];
};

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }

  if (Array.isArray(value)) {
    return `[${value.map((item) => stableStringify(item)).join(',')}]`;
  }

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort((left, right) => left.localeCompare(right))
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(',')}}`;
}

function sha256Digest(value: unknown): string {
  return `sha256:${createHash('sha256').update(stableStringify(value)).digest('hex')}`;
}

function slug(value: string): string {
  return value
    .trim()
    .replace(/[^a-z0-9]+/gi, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function createDefinitionPacketId(part: PacketDefinitionPartDescriptor): string {
  return `nexus:definition/${slug(part.defines_packet_type)}/${slug(part.part_id)}`;
}

function createRevisionId(input: { packetId: string; bodyDigest: string }): string {
  return `${input.packetId}@r-${input.bodyDigest.replace(/^sha256:/, '').slice(0, 24)}`;
}

function buildDefinitionCandidate(input: {
  definition: PacketTypeDefinition;
  part: PacketDefinitionPartDescriptor;
}): SeededDefinitionPacketCandidate {
  const bodyCandidate = buildPacketTypeBodyCandidate({
    packet_type: 'Definition',
    packet_subtype: input.part.part_subtype,
    definition: input.definition,
    part: input.part,
    notes: [
      `Seeded from ${input.definition.packet_type} manifest definition part ${input.part.part_id}.`,
      'Packet-shaped seed material only; trusted local runtime code remains the executable authority.',
    ],
  }) as PacketTypeBodyCandidate<DefinitionBody>;
  const bodyDigest = sha256Digest(bodyCandidate.body);
  const packetId = createDefinitionPacketId(input.part);

  return {
    seed_kind: 'packet_definition.seed_candidate',
    packet_ref: { packet_id: packetId },
    revision_ref: {
      packet_id: packetId,
      revision_id: createRevisionId({ packetId, bodyDigest }),
    },
    defines_packet_type: input.part.defines_packet_type,
    defines_packet_subtype: input.part.defines_packet_subtype,
    part_id: input.part.part_id,
    part_subtype: input.part.part_subtype,
    schema_version: input.part.schema_version,
    body_candidate: bodyCandidate,
    body_digest: bodyDigest,
  };
}

export function buildDefinitionPacketSeedCandidates(input?: {
  definitions?: readonly PacketTypeDefinition[];
}): SeededDefinitionPacketCandidate[] {
  return (input?.definitions ?? listExperimentalPacketTypeDefinitions()).flatMap(
    (definition) =>
      listPacketDefinitionParts(definition).map((part) =>
        buildDefinitionCandidate({ definition, part })
      )
  );
}

function toBundleItem(
  candidate: SeededDefinitionPacketCandidate
): BundleItem {
  return {
    item_role: 'definition_part',
    packet_ref: candidate.packet_ref,
    revision_ref: candidate.revision_ref,
    packet_type: 'Definition',
    packet_subtype: candidate.part_subtype,
    schema_version: candidate.schema_version,
    digest: candidate.body_digest,
    required: true,
    notes: `${candidate.defines_packet_type} ${candidate.part_subtype} definition part ${candidate.part_id}.`,
  };
}

export function buildDefinitionBundlePacketSetCandidate(input?: {
  definitionPackets?: readonly SeededDefinitionPacketCandidate[];
}): SeededDefinitionBundleCandidate {
  const definitionPackets =
    input?.definitionPackets ?? buildDefinitionPacketSeedCandidates();
  const manifestDigest = sha256Digest({
    manifest: PACKET_DEFINITION_MANIFEST,
    definition_revision_refs: definitionPackets.map(
      (candidate) => candidate.revision_ref
    ),
  });
  const bodyCandidate = buildPacketTypeBodyCandidate({
    packet_type: 'Bundle',
    packet_subtype: 'packet_set',
    title: 'Pre-reseed active packet definitions',
    purpose:
      'Carries the active manifest Definition packet seed set for reseed verification.',
    summary:
      'Packet-shaped Definition inventory for the active pre-reseed manifest profile.',
    bundle_version: PACKET_DEFINITION_MANIFEST.manifest_version,
    root_refs: definitionPackets
      .filter((candidate) => candidate.part_subtype === 'packet_definition')
      .map((candidate) => candidate.packet_ref),
    items: definitionPackets.map(toBundleItem),
    manifest_digest: manifestDigest,
    bundle_data: {
      profile_id: SEEDED_DEFINITION_PROFILE_ID,
      manifest_status: PACKET_DEFINITION_MANIFEST.status,
      trusted_execution: 'local_runtime_allowlists_only',
    },
  }) as PacketTypeBodyCandidate<BundleBody>;
  const bodyDigest = sha256Digest(bodyCandidate.body);

  return {
    seed_kind: 'packet_definition.bundle_seed_candidate',
    packet_ref: { packet_id: SEEDED_DEFINITION_BUNDLE_PACKET_ID },
    revision_ref: {
      packet_id: SEEDED_DEFINITION_BUNDLE_PACKET_ID,
      revision_id: createRevisionId({
        packetId: SEEDED_DEFINITION_BUNDLE_PACKET_ID,
        bodyDigest,
      }),
    },
    body_candidate: bodyCandidate,
    body_digest: bodyDigest,
    manifest_digest: manifestDigest,
  };
}

export function resolveSeededPacketDefinitionProfile(input?: {
  definitions?: readonly PacketTypeDefinition[];
}): SeededPacketDefinitionProfile {
  const definitionPackets = buildDefinitionPacketSeedCandidates(input);
  const bundlePacket = buildDefinitionBundlePacketSetCandidate({
    definitionPackets,
  });

  return {
    profile_id: SEEDED_DEFINITION_PROFILE_ID,
    manifest_version: PACKET_DEFINITION_MANIFEST.manifest_version,
    manifest_digest: bundlePacket.manifest_digest,
    definition_packets: definitionPackets,
    bundle_packet: bundlePacket,
  };
}

export function auditSeededPacketDefinitionProfile(input?: {
  definitions?: readonly PacketTypeDefinition[];
  profile?: SeededPacketDefinitionProfile;
}): SeededPacketDefinitionAuditReport {
  const definitions = input?.definitions ?? listExperimentalPacketTypeDefinitions();
  const profile =
    input?.profile ?? resolveSeededPacketDefinitionProfile({ definitions });
  const expectedParts = definitions.flatMap((definition) =>
    listPacketDefinitionParts(definition)
  );
  const expectedPartIds = new Set(expectedParts.map((part) => part.part_id));
  const candidatePartIds = new Set(
    profile.definition_packets.map((candidate) => candidate.part_id)
  );
  const bundleItems = profile.bundle_packet.body_candidate.body.items;
  const bundledRevisionIds = new Set(
    bundleItems
      .map((item) => item.revision_ref?.revision_id ?? null)
      .filter((revisionId): revisionId is string => revisionId !== null)
  );
  const findings: string[] = [];

  for (const part of expectedParts) {
    if (!candidatePartIds.has(part.part_id)) {
      findings.push(`Missing seeded Definition candidate for ${part.part_id}.`);
    }
  }

  for (const candidate of profile.definition_packets) {
    if (!expectedPartIds.has(candidate.part_id)) {
      findings.push(`Unexpected seeded Definition candidate ${candidate.part_id}.`);
    }

    if (candidate.body_candidate.schema_version !== '0.1.0') {
      findings.push(
        `${candidate.part_id} uses unexpected Definition schema version ${candidate.body_candidate.schema_version}.`
      );
    }

    if (candidate.body_digest !== sha256Digest(candidate.body_candidate.body)) {
      findings.push(`${candidate.part_id} body digest does not match its body.`);
    }

    if (!bundledRevisionIds.has(candidate.revision_ref.revision_id)) {
      findings.push(`${candidate.part_id} is missing from the definition bundle.`);
    }
  }

  if (bundleItems.length !== profile.definition_packets.length) {
    findings.push(
      `Definition bundle item count ${bundleItems.length} does not match candidate count ${profile.definition_packets.length}.`
    );
  }

  if (
    profile.bundle_packet.body_candidate.body.manifest_digest !==
    profile.manifest_digest
  ) {
    findings.push('Definition bundle manifest digest does not match profile digest.');
  }

  return {
    report_kind: 'packet_definition.seed_profile_audit',
    status: findings.length > 0 ? 'fail' : 'pass',
    checked_definition_count: definitions.length,
    checked_part_count: expectedParts.length,
    bundled_part_count: bundleItems.length,
    manifest_digest: profile.manifest_digest,
    findings,
  };
}
