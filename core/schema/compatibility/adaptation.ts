/**
 * File: compatibility/adaptation.ts
 * Description: Reads, adapts, inspects, and prepares packet envelopes across supported schema versions.
 */

import { z } from 'zod';

import {
  PacketCompatibilityError,
  type PacketAdaptedWritePreparation,
  type PacketAdaptationChange,
  type PacketAdaptationDirection,
  type PacketAdaptationLoss,
  type PacketCompatibilityAdapterOutput,
  type PacketCompatibilityReadResult,
  type PacketSignatureCandidateSource,
  type PacketSignatureCanonicalCandidate,
  type PacketVersionedWritePreparation,
} from '@core/schema/compatibility/types';
import {
  getPacketCurrentSchemaVersion,
  getPacketVersionDefinition,
  PACKET_COMPATIBILITY_REGISTRY,
} from '@core/schema/compatibility/registry';
import type {
  PacketFamily,
  PacketRevisionMode,
  PacketWriteTargetPolicy,
  PacketWriteTargetSupport,
} from '@core/schema/packet-ontology';
import {
  DEFAULT_SCHEMA_VERSION,
  PacketFamilySchema,
} from '@core/schema/packet-ontology';
import {
  PACKET_BODY_SCHEMAS,
  PacketHeaderSchema,
} from '@core/schema/packet-body-schemas';
import type {
  PacketBodyByType,
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketHeader,
} from '@core/schema/packet-body-schemas';

export interface RawPacketHeaderInput {
  packet_id: string;
  revision_id: string;
  family: PacketFamily;
  schema_version?: string;
  protocol_version?: string;
  [key: string]: unknown;
}

export interface RawPacketEnvelopeInput {
  header: RawPacketHeaderInput;
  body: unknown;
}

const RawPacketHeaderInputSchema = z
  .object({
    packet_id: z.string().min(1),
    revision_id: z.string().min(1),
    family: PacketFamilySchema,
    schema_version: z.string().min(1).optional(),
    protocol_version: z.string().min(1).optional(),
  })
  .passthrough();

const RawPacketEnvelopeInputSchema = z
  .object({
    header: RawPacketHeaderInputSchema,
    body: z.unknown(),
  })
  .strict();

function createAdaptationChange(input: {
  kind: PacketAdaptationChange['kind'];
  path: string;
  fromSchemaVersion: string;
  toSchemaVersion: string;
  message: string;
}): PacketAdaptationChange {
  return {
    kind: input.kind,
    path: input.path,
    from_schema_version: input.fromSchemaVersion,
    to_schema_version: input.toSchemaVersion,
    message: input.message,
  };
}

function resolveEffectiveSourceSchemaVersion<TFamily extends PacketFamily>(input: {
  family: TFamily;
  declaredSchemaVersion: string;
  body: unknown;
}): string {
  const familyEntry = PACKET_COMPATIBILITY_REGISTRY[input.family];

  if (
    !Object.prototype.hasOwnProperty.call(
      familyEntry.versions,
      input.declaredSchemaVersion
    )
  ) {
    return input.declaredSchemaVersion;
  }

  const candidateVersions = Object.keys(familyEntry.versions)
    .filter(
      (schemaVersion) =>
        schemaVersion !== input.declaredSchemaVersion &&
        schemaVersion.localeCompare(input.declaredSchemaVersion) < 0
    )
    .sort((left, right) => right.localeCompare(left));

  for (const schemaVersion of candidateVersions) {
    const versionDefinition = familyEntry.versions[schemaVersion];

    if (versionDefinition?.matchesDeclaredCurrentBodyShape?.(input.body)) {
      return schemaVersion;
    }
  }

  return input.declaredSchemaVersion;
}

type PacketAdaptationPathStep = {
  from_schema_version: string;
  to_schema_version: string;
  direction: Exclude<PacketAdaptationDirection, 'same_version'>;
  apply: (body: unknown) => PacketCompatibilityAdapterOutput;
  parseTargetBody: (body: unknown) => unknown;
};

export function resolvePacketAdaptationPath<TFamily extends PacketFamily>(input: {
  family: TFamily;
  sourceSchemaVersion: string;
  targetSchemaVersion: string;
}): PacketAdaptationPathStep[] {
  if (input.sourceSchemaVersion === input.targetSchemaVersion) {
    return [];
  }

  const queue: {
    schemaVersion: string;
    path: PacketAdaptationPathStep[];
  }[] = [{ schemaVersion: input.sourceSchemaVersion, path: [] }];
  const visited = new Set([input.sourceSchemaVersion]);

  while (queue.length > 0) {
    const current = queue.shift();

    if (!current) {
      break;
    }

    const versionDefinition = getPacketVersionDefinition(
      input.family,
      current.schemaVersion
    );
    const nextSteps: PacketAdaptationPathStep[] = [];

    if (versionDefinition.next_schema_version && versionDefinition.adaptToNext) {
      nextSteps.push({
        from_schema_version: current.schemaVersion,
        to_schema_version: versionDefinition.next_schema_version,
        direction: 'upcast',
        apply: versionDefinition.adaptToNext,
        parseTargetBody: (body: unknown) =>
          getPacketVersionDefinition(
            input.family,
            versionDefinition.next_schema_version as string
          ).parseBody(body),
      });
    }

    if (
      versionDefinition.previous_schema_version &&
      versionDefinition.adaptToPrevious
    ) {
      nextSteps.push({
        from_schema_version: current.schemaVersion,
        to_schema_version: versionDefinition.previous_schema_version,
        direction: 'downcast',
        apply: versionDefinition.adaptToPrevious,
        parseTargetBody: (body: unknown) =>
          getPacketVersionDefinition(
            input.family,
            versionDefinition.previous_schema_version as string
          ).parseBody(body),
      });
    }

    for (const step of nextSteps.sort((left, right) =>
      left.to_schema_version.localeCompare(right.to_schema_version)
    )) {
      if (visited.has(step.to_schema_version)) {
        continue;
      }

      const nextPath = [...current.path, step];

      if (step.to_schema_version === input.targetSchemaVersion) {
        return nextPath;
      }

      visited.add(step.to_schema_version);
      queue.push({
        schemaVersion: step.to_schema_version,
        path: nextPath,
      });
    }
  }

  throw new PacketCompatibilityError({
    code: 'missing_adapter_path',
    family: input.family,
    sourceSchemaVersion: input.sourceSchemaVersion,
    targetSchemaVersion: input.targetSchemaVersion,
    message: `Missing adapter path from schema version ${input.sourceSchemaVersion} to ${input.targetSchemaVersion} for packet family ${input.family}.`,
  });
}

function adaptPacketBodyToTarget<TFamily extends PacketFamily>(input: {
  family: TFamily;
  schemaVersion: string;
  targetSchemaVersion: string;
  body: unknown;
}): {
  body: PacketBodyByType[TFamily];
  changes: PacketAdaptationChange[];
  losses: PacketAdaptationLoss[];
  effectiveSourceSchemaVersion: string;
  direction: PacketAdaptationDirection;
} {
  const effectiveSourceSchemaVersion = resolveEffectiveSourceSchemaVersion({
    family: input.family,
    declaredSchemaVersion: input.schemaVersion,
    body: input.body,
  });
  let currentSchemaVersion = effectiveSourceSchemaVersion;
  let currentBody = getPacketVersionDefinition(
    input.family,
    currentSchemaVersion
  ).parseBody(input.body);
  const changes: PacketAdaptationChange[] = [];
  const losses: PacketAdaptationLoss[] = [];
  const path = resolvePacketAdaptationPath({
    family: input.family,
    sourceSchemaVersion: effectiveSourceSchemaVersion,
    targetSchemaVersion: input.targetSchemaVersion,
  });

  for (const step of path) {
    const adapted = step.apply(currentBody);
    changes.push(...adapted.changes);
    losses.push(...(adapted.losses ?? []));
    currentSchemaVersion = step.to_schema_version;
    currentBody = step.parseTargetBody(adapted.body);
  }

  return {
    body: currentBody as PacketBodyByType[TFamily],
    changes,
    losses,
    effectiveSourceSchemaVersion,
    direction:
      effectiveSourceSchemaVersion === input.targetSchemaVersion
        ? 'same_version'
        : path[0]?.direction ?? 'same_version',
  };
}

export function parseRawPacketEnvelopeInput(
  input: unknown
): RawPacketEnvelopeInput {
  return RawPacketEnvelopeInputSchema.parse(input) as RawPacketEnvelopeInput;
}

export function inspectPacketEnvelope(input: unknown): PacketCompatibilityReadResult {
  return inspectPacketEnvelopeForTarget(input);
}

export function inspectPacketEnvelopeForTarget(
  input: unknown,
  options: {
    target_schema_version?: string;
  } = {}
): PacketCompatibilityReadResult {
  const rawEnvelope = parseRawPacketEnvelopeInput(input);
  const declaredSchemaVersion =
    rawEnvelope.header.schema_version ?? DEFAULT_SCHEMA_VERSION;
  const familyEntry = PACKET_COMPATIBILITY_REGISTRY[rawEnvelope.header.family];
  const targetSchemaVersion =
    options.target_schema_version ?? familyEntry.current_schema_version;

  if (
    !Object.prototype.hasOwnProperty.call(
      familyEntry.versions,
      targetSchemaVersion
    )
  ) {
    throw new PacketCompatibilityError({
      code: 'unsupported_schema_version',
      family: rawEnvelope.header.family,
      sourceSchemaVersion: declaredSchemaVersion,
      targetSchemaVersion,
      message: `Unsupported target schema version ${targetSchemaVersion} for packet family ${rawEnvelope.header.family}.`,
    });
  }

  const adaptedHeader = PacketHeaderSchema.parse({
    ...rawEnvelope.header,
    schema_version: targetSchemaVersion,
  });
  const adaptedBody = adaptPacketBodyToTarget({
    family: rawEnvelope.header.family,
    schemaVersion: declaredSchemaVersion,
    targetSchemaVersion,
    body: rawEnvelope.body,
  });
  const interpretedAsLegacyProfile =
    adaptedBody.effectiveSourceSchemaVersion !== declaredSchemaVersion;
  const isExact =
    !interpretedAsLegacyProfile &&
    adaptedBody.losses.length === 0 &&
    adaptedBody.changes.length === 0;
  const writableAsIs =
    isExact && adaptedBody.effectiveSourceSchemaVersion === targetSchemaVersion;
  const supportedWriteTarget: PacketWriteTargetSupport =
    targetSchemaVersion !== familyEntry.current_schema_version &&
    familyEntry.write_target_policy !== 'supported_versions'
      ? 'blocked'
      : adaptedBody.losses.length > 0
        ? 'lossy_allowed'
        : 'exact';

  return {
    raw_packet: input,
    adapted_packet: {
      header: adaptedHeader,
      body: adaptedBody.body,
    } as PacketEnvelope,
    status: {
      family: rawEnvelope.header.family,
      declared_schema_version: declaredSchemaVersion,
      effective_source_schema_version: adaptedBody.effectiveSourceSchemaVersion,
      interpreted_as_legacy_profile: interpretedAsLegacyProfile,
      source_schema_version: adaptedBody.effectiveSourceSchemaVersion,
      target_schema_version: targetSchemaVersion,
      direction: adaptedBody.direction,
      changes: adaptedBody.changes,
      losses: adaptedBody.losses,
      is_lossy: adaptedBody.losses.length > 0,
      is_exact: isExact,
      writable_as_is: writableAsIs,
      requires_guarded_upgrade:
        supportedWriteTarget !== 'blocked' &&
        targetSchemaVersion === familyEntry.current_schema_version &&
        !writableAsIs,
      requires_loss_acknowledgement:
        supportedWriteTarget === 'lossy_allowed',
      supported_write_target: supportedWriteTarget,
    },
  };
}

export function getPacketSignatureCanonicalCandidates(
  packet: PacketEnvelope
): PacketEnvelope[] {
  return getPacketSignatureCanonicalCandidateDetails(packet).map(
    (candidate) => candidate.packet
  );
}

export function getPacketSignatureCanonicalCandidateDetails(
  packet: PacketEnvelope
): PacketSignatureCanonicalCandidate<PacketEnvelope>[] {
  const sourceSchemaVersion =
    packet.header.schema_version ?? DEFAULT_SCHEMA_VERSION;
  const versionDefinition = getPacketVersionDefinition(
    packet.header.family,
    sourceSchemaVersion
  );
  const candidates: PacketSignatureCanonicalCandidate<PacketEnvelope>[] = [
    {
      packet,
      source: 'exact',
    },
  ];
  const compatibilityCandidate = versionDefinition.createUnsignedPacketCandidate?.(
    packet as PacketEnvelopeByType[PacketFamily]
  );

  if (compatibilityCandidate) {
    const currentCanonicalPacket = JSON.stringify(packet);
    const compatibilityCanonicalPacket = JSON.stringify(compatibilityCandidate);

    if (compatibilityCanonicalPacket !== currentCanonicalPacket) {
      candidates.push({
        packet: compatibilityCandidate as PacketEnvelope,
        source: 'family_compatibility',
      });
    }
  }

  return candidates;
}

function createRawHeaderCompatibilityCandidate(
  packet: RawPacketEnvelopeInput
): RawPacketEnvelopeInput | null {
  const metadata = packet.header.metadata;

  if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) {
    return null;
  }

  const metadataRecord = metadata as Record<string, unknown>;

  if (
    !Object.prototype.hasOwnProperty.call(metadataRecord, 'compatibility') ||
    metadataRecord.compatibility !== null
  ) {
    return null;
  }

  const { compatibility: _compatibility, ...nextMetadata } = metadataRecord;
  const nextHeader = {
    ...packet.header,
  } as RawPacketHeaderInput & Record<string, unknown>;

  if (Object.keys(nextMetadata).length > 0) {
    nextHeader.metadata = nextMetadata;
  } else {
    delete nextHeader.metadata;
  }

  return {
    ...packet,
    header: nextHeader,
  };
}

function createRawFamilyCompatibilityBodyCandidate(
  packet: RawPacketEnvelopeInput
): unknown | null {
  try {
    const adaptedPacket = inspectPacketEnvelope(packet).adapted_packet;
    const sourceSchemaVersion =
      packet.header.schema_version ?? DEFAULT_SCHEMA_VERSION;
    const versionDefinition = getPacketVersionDefinition(
      packet.header.family,
      sourceSchemaVersion
    );
    const compatibilityCandidate = versionDefinition.createUnsignedPacketCandidate?.(
      adaptedPacket as PacketEnvelopeByType[PacketFamily]
    );

    return compatibilityCandidate?.body ?? null;
  } catch {
    return null;
  }
}

export function getRawPacketSignatureCanonicalCandidates(
  packetInput: unknown
): RawPacketEnvelopeInput[] {
  return getRawPacketSignatureCanonicalCandidateDetails(packetInput).map(
    (candidate) => candidate.packet
  );
}

export function getRawPacketSignatureCanonicalCandidateDetails(
  packetInput: unknown
): PacketSignatureCanonicalCandidate<RawPacketEnvelopeInput>[] {
  const packet = parseRawPacketEnvelopeInput(packetInput);
  const candidates: PacketSignatureCanonicalCandidate<RawPacketEnvelopeInput>[] =
    [];
  const seenPackets = new Set<string>();
  const pushCandidate = (
    candidatePacket: RawPacketEnvelopeInput,
    source: PacketSignatureCandidateSource
  ) => {
    const serializedCandidate = JSON.stringify(candidatePacket);

    if (seenPackets.has(serializedCandidate)) {
      return;
    }

    seenPackets.add(serializedCandidate);
    candidates.push({
      packet: candidatePacket,
      source,
    });
  };

  pushCandidate(packet, 'exact');

  const headerCompatibilityCandidate =
    createRawHeaderCompatibilityCandidate(packet);

  if (headerCompatibilityCandidate) {
    pushCandidate(headerCompatibilityCandidate, 'header_compatibility');
  }

  const familyCompatibilityBody =
    createRawFamilyCompatibilityBodyCandidate(packet);

  if (familyCompatibilityBody) {
    pushCandidate(
      {
        ...packet,
        body: familyCompatibilityBody,
      },
      'family_compatibility'
    );

    if (headerCompatibilityCandidate) {
      pushCandidate(
        {
          ...headerCompatibilityCandidate,
          body: familyCompatibilityBody,
        },
        'combined_compatibility'
      );
    }
  }

  return candidates;
}

export function preparePacketEnvelopeForAdaptedWrite(
  input: unknown
): PacketAdaptedWritePreparation {
  return preparePacketEnvelopeForVersionedWrite(input);
}

export function preparePacketEnvelopeForVersionedWrite(
  input: unknown,
  options: {
    target_schema_version?: string;
  } = {}
): PacketVersionedWritePreparation {
  const inspected = inspectPacketEnvelopeForTarget(input, options);
  const sourceSchemaVersion = inspected.status.source_schema_version;
  const declaredSchemaVersion = inspected.status.declared_schema_version;
  const needsSchemaVersionBump =
    declaredSchemaVersion !== inspected.status.target_schema_version;

  if (inspected.status.supported_write_target === 'blocked') {
    return {
      raw_packet: inspected.raw_packet,
      adapted_packet: inspected.adapted_packet,
      prepared_packet: null,
      declared_schema_version: declaredSchemaVersion,
      effective_source_schema_version:
        inspected.status.effective_source_schema_version,
      interpreted_as_legacy_profile:
        inspected.status.interpreted_as_legacy_profile,
      source_schema_version: sourceSchemaVersion,
      target_schema_version: inspected.status.target_schema_version,
      direction: inspected.status.direction,
      changes: inspected.status.changes,
      losses: inspected.status.losses,
      is_lossy: inspected.status.is_lossy,
      is_exact: inspected.status.is_exact,
      writable_as_is: inspected.status.writable_as_is,
      requires_guarded_upgrade: false,
      requires_loss_acknowledgement: false,
      supported_write_target: inspected.status.supported_write_target,
    };
  }

  const preparedPacket =
    inspected.status.writable_as_is &&
    inspected.adapted_packet.header.schema_version ===
      inspected.status.target_schema_version
      ? inspected.adapted_packet
      : ({
          ...inspected.adapted_packet,
          header: {
            ...inspected.adapted_packet.header,
            schema_version: inspected.status.target_schema_version,
          },
        } as PacketEnvelope);
  const changes = inspected.status.writable_as_is
    ? inspected.status.changes
    : [
        ...inspected.status.changes,
        ...(needsSchemaVersionBump
          ? [
              createAdaptationChange({
                kind: 'schema_version_bump',
                path: 'header.schema_version',
                fromSchemaVersion: declaredSchemaVersion,
                toSchemaVersion: inspected.status.target_schema_version,
                message: `Prepared packet for write against schema version ${inspected.status.target_schema_version}.`,
              }),
            ]
          : []),
      ];

  return {
    raw_packet: inspected.raw_packet,
    adapted_packet: inspected.adapted_packet,
    prepared_packet: preparedPacket,
    declared_schema_version: inspected.status.declared_schema_version,
    effective_source_schema_version:
      inspected.status.effective_source_schema_version,
    interpreted_as_legacy_profile:
      inspected.status.interpreted_as_legacy_profile,
    source_schema_version: inspected.status.source_schema_version,
    target_schema_version: inspected.status.target_schema_version,
    direction: inspected.status.direction,
    changes,
    losses: inspected.status.losses,
    is_lossy: inspected.status.is_lossy,
    is_exact: inspected.status.is_exact,
    writable_as_is: inspected.status.writable_as_is,
    requires_guarded_upgrade: inspected.status.requires_guarded_upgrade,
    requires_loss_acknowledgement:
      inspected.status.requires_loss_acknowledgement,
    supported_write_target: inspected.status.supported_write_target,
  };
}

export function describePacketCompatibility(
  family: PacketFamily,
  schemaVersion: string
): {
  family: PacketFamily;
  schema_version: string;
  current_schema_version: string;
  revision_mode: PacketRevisionMode;
  write_target_policy: PacketWriteTargetPolicy;
  is_supported: boolean;
  is_current: boolean;
} {
  const familyEntry = PACKET_COMPATIBILITY_REGISTRY[family];

  return {
    family,
    schema_version: schemaVersion,
    current_schema_version: familyEntry.current_schema_version,
    revision_mode: familyEntry.revision_mode,
    write_target_policy: familyEntry.write_target_policy,
    is_supported:
      Object.prototype.hasOwnProperty.call(familyEntry.versions, schemaVersion),
    is_current: schemaVersion === familyEntry.current_schema_version,
  };
}

export function parsePacketBody<TFamily extends PacketFamily>(
  family: TFamily,
  body: unknown,
  schemaVersion = DEFAULT_SCHEMA_VERSION
): PacketBodyByType[TFamily] {
  return parsePacketBodyForTarget(family, body, {
    schema_version: schemaVersion,
  });
}

export function parsePacketBodyForTarget<TFamily extends PacketFamily>(
  family: TFamily,
  body: unknown,
  options: {
    schema_version?: string;
    target_schema_version?: string;
  } = {}
): PacketBodyByType[TFamily] {
  return adaptPacketBodyToTarget({
    family,
    schemaVersion: options.schema_version ?? DEFAULT_SCHEMA_VERSION,
    targetSchemaVersion:
      options.target_schema_version ?? getPacketCurrentSchemaVersion(family),
    body,
  }).body;
}

export function parsePacketEnvelope(input: unknown): PacketEnvelope {
  return inspectPacketEnvelope(input).adapted_packet;
}

export function parsePacketEnvelopeForTarget(
  input: unknown,
  options: {
    target_schema_version?: string;
  } = {}
): PacketEnvelope {
  return inspectPacketEnvelopeForTarget(input, options).adapted_packet;
}

export function createPacketEnvelope<TFamily extends PacketFamily>(input: {
  header: z.input<typeof PacketHeaderSchema> & { family: TFamily };
  body: z.input<(typeof PACKET_BODY_SCHEMAS)[TFamily]>;
}): PacketEnvelopeByType[TFamily] {
  const header = PacketHeaderSchema.parse(input.header);
  const body = parsePacketBody(
    input.header.family,
    input.body,
    header.schema_version
  );

  return {
    header: header as PacketHeader & { family: TFamily },
    body,
  } as PacketEnvelopeByType[TFamily];
}
