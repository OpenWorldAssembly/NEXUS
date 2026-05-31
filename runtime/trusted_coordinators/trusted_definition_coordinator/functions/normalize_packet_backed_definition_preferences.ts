/**
 * File: normalize_packet_backed_definition_preferences.ts
 * Description: Converts packet-carried definition profile preference descriptors into Trusted Definition runtime preferences.
 */

import { z } from 'zod';

import { BundleBodySchema, type PacketEnvelope } from '@core/schema/packet-schema';
import {
  trustedIssue,
  type TrustedRuntimeCoordinatorIssue,
} from '@runtime/trusted_coordinators/trusted_runtime_coordinator';
import {
  type TrustedDefinitionProfilePreferencePacket,
  type TrustedDefinitionRuntimePreference,
} from '../trusted_definition_types.ts';

const DefinitionProfilePreferenceDescriptorSchema = z
  .object({
    preference_id: z.string().min(1),
    target_node_element_id: z.string().min(1).nullable().optional(),
    target_scope_packet_id: z.string().min(1).nullable().optional(),
    source_id: z.string().min(1).nullable().optional(),
    author_element_id: z.string().min(1).nullable().optional(),
    packet_type: z.string().min(1).nullable().optional(),
    packet_subtype: z.string().min(1).nullable().optional(),
    part_subtype: z.string().min(1).nullable().optional(),
    trust_mode: z.enum([
      'pin',
      'prefer',
      'allow',
      'compatibility_only',
      'quarantine',
      'ignore',
    ]),
    priority: z.number().int().default(0),
    read_only_allowed: z.boolean().optional(),
    compatibility_allowed: z.boolean().optional(),
    notes: z.string().min(1).nullable().optional(),
  })
  .strict();

const DefinitionProfilePreferenceListSchema = z.array(
  DefinitionProfilePreferenceDescriptorSchema
);

type DefinitionProfilePreferenceDescriptor = z.infer<
  typeof DefinitionProfilePreferenceDescriptorSchema
>;

function packetIdForCarrier(packet: TrustedDefinitionProfilePreferencePacket): string {
  return packet.header?.packet_id ?? packet.packet_ref?.packet_id ?? 'unknown-packet';
}

function packetRevisionIdForCarrier(packet: TrustedDefinitionProfilePreferencePacket): string | null {
  return packet.header?.revision_id ?? packet.revision_ref?.revision_id ?? null;
}

function packetTypeForCarrier(packet: TrustedDefinitionProfilePreferencePacket): string | null {
  return packet.header?.type ?? packet.packet_type ?? null;
}

function normalizeDescriptor(input: {
  descriptor: DefinitionProfilePreferenceDescriptor;
  carrier: TrustedDefinitionProfilePreferencePacket;
}): TrustedDefinitionRuntimePreference {
  const { descriptor, carrier } = input;
  const packetId = packetIdForCarrier(carrier);
  const revisionId = packetRevisionIdForCarrier(carrier);

  return {
    preference_id: `${descriptor.preference_id}.from.${packetId}${revisionId ? `.${revisionId}` : ''}`,
    node_element_id: descriptor.target_node_element_id ?? null,
    scope_packet_id: descriptor.target_scope_packet_id ?? null,
    source_id: descriptor.source_id ?? null,
    author_element_id: descriptor.author_element_id ?? null,
    packet_type: descriptor.packet_type ?? null,
    packet_subtype: descriptor.packet_subtype ?? null,
    part_subtype: descriptor.part_subtype as TrustedDefinitionRuntimePreference['part_subtype'],
    trust_mode: descriptor.trust_mode,
    priority: descriptor.priority,
    read_only_allowed: descriptor.read_only_allowed,
    compatibility_allowed: descriptor.compatibility_allowed,
    notes:
      descriptor.notes ??
      `Loaded from packet-backed definition profile preference carrier ${packetId}.`,
  };
}

function bodyForCarrier(packet: TrustedDefinitionProfilePreferencePacket): unknown {
  if ('body' in packet) {
    return packet.body;
  }

  return (packet as PacketEnvelope).body;
}

function extractBundlePreferences(input: {
  packet: TrustedDefinitionProfilePreferencePacket;
  issues: TrustedRuntimeCoordinatorIssue[];
}): TrustedDefinitionRuntimePreference[] {
  const { packet, issues } = input;
  const packetId = packetIdForCarrier(packet);
  const parsedBody = BundleBodySchema.safeParse(bodyForCarrier(packet));

  if (!parsedBody.success) {
    issues.push(
      trustedIssue({
        severity: 'warning',
        code: 'definition_profile_preference_bundle_invalid',
        path: packetId,
        message:
          'A packet-backed definition profile preference carrier declared Bundle semantics but failed Bundle kernel validation and was ignored.',
      })
    );
    return [];
  }

  if (parsedBody.data.status !== 'active') {
    return [];
  }

  const rawPreferences =
    parsedBody.data.bundle_data.definition_profile_preferences ??
    parsedBody.data.bundle_data.trusted_definition_runtime_preferences ??
    [];
  const parsedPreferences = DefinitionProfilePreferenceListSchema.safeParse(rawPreferences);

  if (!parsedPreferences.success) {
    issues.push(
      trustedIssue({
        severity: 'warning',
        code: 'definition_profile_preference_descriptors_invalid',
        path: packetId,
        message:
          'A Bundle.packet_set definition profile preference carrier had invalid preference descriptors and was ignored.',
      })
    );
    return [];
  }

  return parsedPreferences.data.map((descriptor) =>
    normalizeDescriptor({ descriptor, carrier: packet })
  );
}

function targetMatches(input: {
  preference: TrustedDefinitionRuntimePreference;
  nodeElementId?: string | null;
  scopePacketId?: string | null;
}): boolean {
  const { preference, nodeElementId, scopePacketId } = input;

  if (preference.node_element_id && preference.node_element_id !== nodeElementId) {
    return false;
  }

  if (preference.scope_packet_id && preference.scope_packet_id !== scopePacketId) {
    return false;
  }

  return true;
}

export function normalizePacketBackedDefinitionPreferences(input: {
  preference_packets?: readonly TrustedDefinitionProfilePreferencePacket[];
  node_element_id?: string | null;
  scope_packet_id?: string | null;
}): {
  preferences: TrustedDefinitionRuntimePreference[];
  issues: TrustedRuntimeCoordinatorIssue[];
} {
  const issues: TrustedRuntimeCoordinatorIssue[] = [];
  const preferences: TrustedDefinitionRuntimePreference[] = [];

  for (const packet of input.preference_packets ?? []) {
    const packetType = packetTypeForCarrier(packet);

    if (packetType !== 'Bundle') {
      issues.push(
        trustedIssue({
          severity: 'warning',
          code: 'definition_profile_preference_packet_type_unsupported',
          path: packetIdForCarrier(packet),
          message:
            'Only Bundle packet-backed definition profile preference carriers are active in this bridge pass; the carrier was ignored.',
        })
      );
      continue;
    }

    preferences.push(...extractBundlePreferences({ packet, issues }));
  }

  return {
    preferences: preferences.filter((preference) =>
      targetMatches({
        preference,
        nodeElementId: input.node_element_id ?? null,
        scopePacketId: input.scope_packet_id ?? null,
      })
    ),
    issues,
  };
}
