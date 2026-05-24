/**
 * File: packet-defaults.ts
 * Description: Packet-definition default projection and policy override helpers.
 */

import type {
  PacketDefaultDefinitionDescriptor,
  PacketDefaultOverrideDescriptor,
  PacketDefinitionPartDescriptor,
  PacketTypeDefinition,
} from '@core/packets/definitions/packet-definition-types.ts';
import type { PacketEnvelopeByType, PacketRef } from '@core/schema/packet-schema';

export type PacketDefaultProfile = {
  packet_type: string;
  packet_subtype: string | null;
  definition_defaults: readonly PacketDefaultDefinitionDescriptor[];
  policy_default_refs: readonly PacketRef[];
  policy_default_definition_refs: readonly PacketRef[];
  policy_template_refs: readonly PacketRef[];
  policy_preference_refs: readonly PacketRef[];
  policy_default_packet_set_refs: readonly PacketRef[];
  overrides: readonly PacketDefaultOverrideDescriptor[];
  resolved_values: Readonly<Record<string, unknown>>;
};

function cloneRecord(value: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return JSON.parse(JSON.stringify(value ?? {})) as Record<string, unknown>;
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function deepMerge(
  base: Record<string, unknown>,
  overlay: Readonly<Record<string, unknown>>
): Record<string, unknown> {
  const result = cloneRecord(base);

  for (const [key, value] of Object.entries(overlay)) {
    const current = result[key];

    if (isPlainObject(current) && isPlainObject(value)) {
      result[key] = deepMerge(current, value);
      continue;
    }

    result[key] = isPlainObject(value) || Array.isArray(value)
      ? JSON.parse(JSON.stringify(value))
      : value;
  }

  return result;
}

function applyOverride(
  base: Record<string, unknown>,
  override: PacketDefaultOverrideDescriptor
): Record<string, unknown> {
  const result = cloneRecord(base);
  const pathSegments = override.path
    .split('.')
    .map((segment) => segment.trim())
    .filter(Boolean);

  if (pathSegments.length === 0) {
    return result;
  }

  let cursor: Record<string, unknown> = result;
  for (const segment of pathSegments.slice(0, -1)) {
    const next = cursor[segment];
    if (!isPlainObject(next)) {
      cursor[segment] = {};
    }
    cursor = cursor[segment] as Record<string, unknown>;
  }

  cursor[pathSegments[pathSegments.length - 1]] = isPlainObject(override.value) || Array.isArray(override.value)
    ? JSON.parse(JSON.stringify(override.value))
    : override.value;

  return result;
}

function toDefaultDescriptor(
  part: PacketDefinitionPartDescriptor
): PacketDefaultDefinitionDescriptor | null {
  if (part.part_subtype !== 'default_definition') {
    return null;
  }

  return {
    default_id: part.part_id,
    applies_to: part.applies_to ?? {
      packet_type: part.defines_packet_type,
      packet_subtype: part.defines_packet_subtype,
    },
    default_values: part.default_values ?? {},
    merge_strategy: part.merge_strategy ?? 'deep_overlay',
    notes: part.notes,
  };
}

function defaultMatchesSubtype(
  descriptor: PacketDefaultDefinitionDescriptor,
  packetSubtype: string | null | undefined
): boolean {
  if (packetSubtype === undefined) {
    return true;
  }

  const appliesSubtype = descriptor.applies_to.packet_subtype;
  return appliesSubtype === undefined || appliesSubtype === null || appliesSubtype === packetSubtype;
}

export function listPacketDefinitionDefaults(
  definition: PacketTypeDefinition,
  packetSubtype?: string | null
): PacketDefaultDefinitionDescriptor[] {
  return (definition.packet_definition_parts ?? [])
    .map(toDefaultDescriptor)
    .filter((descriptor): descriptor is PacketDefaultDefinitionDescriptor => descriptor !== null)
    .filter((descriptor) => defaultMatchesSubtype(descriptor, packetSubtype));
}

export function mergePacketDefaultValues(
  defaults: readonly PacketDefaultDefinitionDescriptor[]
): Record<string, unknown> {
  return defaults.reduce<Record<string, unknown>>((merged, descriptor) => {
    if (descriptor.merge_strategy === 'replace') {
      return cloneRecord(descriptor.default_values);
    }

    return deepMerge(merged, descriptor.default_values);
  }, {});
}

export function applyPacketDefaultOverrides(input: {
  base: Readonly<Record<string, unknown>>;
  overrides: readonly PacketDefaultOverrideDescriptor[];
}): Record<string, unknown> {
  return input.overrides.reduce<Record<string, unknown>>(
    (current, override) => applyOverride(current, override),
    cloneRecord(input.base)
  );
}

function refsFromPolicies(
  policyPackets: readonly PacketEnvelopeByType['Policy'][],
  key: 'policy_refs' | 'template_refs' | 'default_definition_refs' | 'default_packet_set_refs' | 'preference_refs'
): PacketRef[] {
  const refs = policyPackets.flatMap((packet) => packet.body.default_policy?.[key] ?? []);
  const seen = new Set<string>();

  return refs.filter((ref) => {
    if (seen.has(ref.packet_id)) {
      return false;
    }
    seen.add(ref.packet_id);
    return true;
  });
}

function overridesFromPolicies(
  policyPackets: readonly PacketEnvelopeByType['Policy'][]
): PacketDefaultOverrideDescriptor[] {
  return policyPackets.flatMap(
    (packet) => packet.body.default_policy?.overrides ?? []
  );
}

export function resolvePacketDefaultProfile(input: {
  definition: PacketTypeDefinition;
  packet_subtype?: string | null;
  policy_packets?: readonly PacketEnvelopeByType['Policy'][];
  local_overrides?: readonly PacketDefaultOverrideDescriptor[];
}): PacketDefaultProfile {
  const packetSubtype = input.packet_subtype ?? input.definition.default_subtype ?? null;
  const policyPackets = input.policy_packets ?? [];
  const definitionDefaults = listPacketDefinitionDefaults(
    input.definition,
    packetSubtype
  );
  const mergedDefinitionValues = mergePacketDefaultValues(definitionDefaults);
  const overrides = [
    ...overridesFromPolicies(policyPackets),
    ...(input.local_overrides ?? []),
  ];

  return {
    packet_type: input.definition.packet_type,
    packet_subtype: packetSubtype,
    definition_defaults: definitionDefaults,
    policy_default_refs: refsFromPolicies(policyPackets, 'policy_refs'),
    policy_default_definition_refs: refsFromPolicies(
      policyPackets,
      'default_definition_refs'
    ),
    policy_template_refs: refsFromPolicies(policyPackets, 'template_refs'),
    policy_preference_refs: refsFromPolicies(policyPackets, 'preference_refs'),
    policy_default_packet_set_refs: refsFromPolicies(
      policyPackets,
      'default_packet_set_refs'
    ),
    overrides,
    resolved_values: applyPacketDefaultOverrides({
      base: mergedDefinitionValues,
      overrides,
    }),
  };
}
