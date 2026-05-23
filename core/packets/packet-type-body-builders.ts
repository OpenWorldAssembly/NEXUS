/**
 * File: packet-type-body-builders.ts
 * Description: Canonical body builders for packetized Definition, Bundle, and Preference bodies.
 */

import {
  BundleBodySchema,
  type BundleBody,
  type BundleItem,
} from '@core/packets/definitions/bundle.ts';
import {
  DEFINITION_PACKET_SUBTYPES,
  DefinitionBodySchema,
  type DefinitionBody,
} from '@core/packets/definitions/definition.ts';
import type {
  PacketDefinitionPartDescriptor,
  PacketDefinitionPartSubtype,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import {
  buildElementPreferenceBody,
  type ElementPreferenceBody,
} from '@core/packets/definitions/preference-helpers.ts';
import type { ElementPreferenceBuilderInput } from '@core/packets/definitions/preference.ts';
import {
  getDefinedPacketTypeDefinition,
  type PacketTypeDefinition as PublicPacketTypeDefinition,
} from '@core/packets/packet-definition-manifest';
import type { PacketRef } from '@core/schema/packet-schema';

export type PacketTypeBodyBuilderId =
  | 'definition.part.body.v0'
  | 'bundle.packet_set.body.v0'
  | 'preference.element.body.v0';

export type PacketTypeBodyCandidate<TBody = unknown> = {
  candidate_kind: 'packet_type.body_candidate';
  builder_id: PacketTypeBodyBuilderId;
  packet_type: string;
  packet_subtype: string;
  schema_version: string;
  storage_class: PacketTypeDefinition['storage_class'];
  revision_behavior: PacketTypeDefinition['revision_behavior'];
  body: TBody;
};

export type DefinitionPartBodyBuilderInput = {
  packet_type: 'Definition';
  packet_subtype: PacketDefinitionPartSubtype;
  definition: PublicPacketTypeDefinition;
  part: PacketDefinitionPartDescriptor;
  status?: DefinitionBody['status'];
  notes?: readonly string[];
};

export type BundlePacketSetBodyBuilderInput = {
  packet_type: 'Bundle';
  packet_subtype: 'packet_set';
  title: string;
  purpose: string;
  summary?: string | null;
  status?: BundleBody['status'];
  bundle_version?: string;
  root_refs?: PacketRef[];
  items?: BundleItem[];
  manifest_digest?: string | null;
  bundle_data?: Record<string, unknown>;
};

export type PreferenceElementBodyBuilderInput = {
  packet_type: 'Preference';
  packet_subtype: 'element';
  input: ElementPreferenceBuilderInput;
};

export type PacketTypeBodyBuilderInput =
  | DefinitionPartBodyBuilderInput
  | BundlePacketSetBodyBuilderInput
  | PreferenceElementBodyBuilderInput;

export type PacketTypeBodyBuilderDescriptor = {
  builder_id: PacketTypeBodyBuilderId;
  packet_type: 'Definition' | 'Bundle' | 'Preference';
  packet_subtype: string;
  availability: 'runtime_ready';
};

const PACKET_TYPE_BODY_BUILDERS = [
  {
    builder_id: 'definition.part.body.v0',
    packet_type: 'Definition',
    packet_subtype: '*',
    availability: 'runtime_ready',
  },
  {
    builder_id: 'bundle.packet_set.body.v0',
    packet_type: 'Bundle',
    packet_subtype: 'packet_set',
    availability: 'runtime_ready',
  },
  {
    builder_id: 'preference.element.body.v0',
    packet_type: 'Preference',
    packet_subtype: 'element',
    availability: 'runtime_ready',
  },
] as const satisfies readonly PacketTypeBodyBuilderDescriptor[];

function requireDefinition(packetType: string): PublicPacketTypeDefinition {
  const definition = getDefinedPacketTypeDefinition(packetType);

  if (!definition) {
    throw new Error(`Unknown packet type body builder packet_type: ${packetType}`);
  }

  return definition;
}

function createCandidate<TBody>(input: {
  builder_id: PacketTypeBodyBuilderId;
  packet_type: string;
  packet_subtype: string;
  body: TBody;
}): PacketTypeBodyCandidate<TBody> {
  const definition = requireDefinition(input.packet_type);

  return {
    candidate_kind: 'packet_type.body_candidate',
    builder_id: input.builder_id,
    packet_type: definition.packet_type,
    packet_subtype: input.packet_subtype,
    schema_version: definition.current_schema_version,
    storage_class: definition.storage_class,
    revision_behavior: definition.revision_behavior,
    body: input.body,
  };
}

function partReferences(part: PacketDefinitionPartDescriptor): string[] {
  return [...(part.references ?? [])];
}

function buildDefinitionPartBody(
  input: DefinitionPartBodyBuilderInput
): PacketTypeBodyCandidate<DefinitionBody> {
  const { definition, part } = input;
  const base = {
    subtype: part.part_subtype,
    status: input.status ?? 'active',
    definition_version: part.schema_version,
    defines_packet_type: part.defines_packet_type,
    defines_packet_subtype: part.defines_packet_subtype,
    summary: part.notes,
    notes: [...(input.notes ?? [])],
  };
  const references = partReferences(part);

  if (!DEFINITION_PACKET_SUBTYPES.includes(part.part_subtype)) {
    throw new Error(`Unsupported Definition part subtype: ${part.part_subtype}`);
  }

  const body = DefinitionBodySchema.parse(
    part.part_subtype === 'packet_definition'
      ? {
          ...base,
          required_parts: (definition.packet_definition_parts ?? [])
            .filter((candidate) => candidate.required)
            .map((candidate) => ({
              part_id: candidate.part_id,
              part_subtype: candidate.part_subtype,
              required: true,
              notes: candidate.notes,
            })),
          optional_parts: (definition.packet_definition_parts ?? [])
            .filter((candidate) => !candidate.required)
            .map((candidate) => ({
              part_id: candidate.part_id,
              part_subtype: candidate.part_subtype,
              required: false,
              notes: candidate.notes,
            })),
          bootstrap_mode:
            definition.packet_type === 'Definition'
              ? 'core_native_v0'
              : 'packet_defined',
        }
      : part.part_subtype === 'packet_schema'
        ? {
            ...base,
            schema_key: `${definition.packet_type}BodySchema`,
            supported_subtypes: [...(part.covers_subtypes ?? definition.declared_subtypes)],
            schema_language: 'zod_local_binding',
          }
        : part.part_subtype === 'packet_action_registry'
          ? { ...base, action_ids: references }
          : part.part_subtype === 'packet_builder_descriptor'
            ? { ...base, builder_ids: references }
            : part.part_subtype === 'packet_planner_descriptor'
              ? { ...base, planner_ids: references }
              : part.part_subtype === 'packet_projection_descriptor'
                ? { ...base, projection_keys: references }
                : part.part_subtype === 'packet_compatibility'
                  ? {
                      ...base,
                      current_schema_version: definition.current_schema_version,
                      adapter_ids: references,
                      supports_upcast: definition.compatibility.supports_upcast,
                      supports_downcast: definition.compatibility.supports_downcast,
                      loss_awareness: definition.compatibility.loss_awareness,
                    }
                  : {
                      ...base,
                      required_packet_types: references.filter(
                        (reference) =>
                          !reference.startsWith('generic.') &&
                          !reference.startsWith('runtime.') &&
                          !reference.startsWith('core.')
                      ),
                      required_definition_parts: references.filter((reference) =>
                        reference.includes('.packet_')
                      ),
                      required_runtime_capabilities: references.filter(
                        (reference) =>
                          reference.startsWith('generic.') || reference.startsWith('core.')
                      ),
                      optional_runtime_capabilities: references.filter((reference) =>
                        reference.startsWith('runtime.')
                      ),
                    }
  ) as DefinitionBody;

  return createCandidate({
    builder_id: 'definition.part.body.v0',
    packet_type: 'Definition',
    packet_subtype: body.subtype,
    body,
  });
}

function buildBundlePacketSetBody(
  input: BundlePacketSetBodyBuilderInput
): PacketTypeBodyCandidate<BundleBody> {
  const body = BundleBodySchema.parse({
    subtype: input.packet_subtype,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status ?? 'active',
    bundle_version: input.bundle_version ?? '0.1.0',
    purpose: input.purpose,
    root_refs: input.root_refs ?? [],
    items: input.items ?? [],
    manifest_digest: input.manifest_digest ?? null,
    bundle_data: input.bundle_data ?? {},
  });

  return createCandidate({
    builder_id: 'bundle.packet_set.body.v0',
    packet_type: 'Bundle',
    packet_subtype: 'packet_set',
    body,
  });
}

function buildPreferenceElementBody(
  input: PreferenceElementBodyBuilderInput
): PacketTypeBodyCandidate<ElementPreferenceBody> {
  const body = buildElementPreferenceBody(input.input);

  return createCandidate({
    builder_id: 'preference.element.body.v0',
    packet_type: 'Preference',
    packet_subtype: 'element',
    body,
  });
}

export function listPacketTypeBodyBuilders(): PacketTypeBodyBuilderDescriptor[] {
  return [...PACKET_TYPE_BODY_BUILDERS];
}

export function buildPacketTypeBodyCandidate(
  input: PacketTypeBodyBuilderInput
): PacketTypeBodyCandidate {
  if (input.packet_type === 'Definition') {
    return buildDefinitionPartBody(input);
  }

  if (input.packet_type === 'Bundle') {
    return buildBundlePacketSetBody(input);
  }

  if (input.packet_type === 'Preference') {
    return buildPreferenceElementBody(input);
  }

  throw new Error(`Unsupported packet type body builder request.`);
}
