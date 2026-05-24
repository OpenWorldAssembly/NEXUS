/**
 * File: packet-definition-template.ts
 * Description: Definition-mode packet manifest definition template and section contract helpers.
 */

import type {
  PacketManifestSectionDescriptor,
  PacketManifestSectionKey,
} from '@core/packets/definitions/packet-definition-types.ts';

export const PACKET_MANIFEST_TEMPLATE_VERSION = '0.1.0' as const;

export const PACKET_MANIFEST_DEFINITION_TEMPLATE = [
  {
    section_key: 'identity',
    status: 'supported',
    summary: 'Packet type identity, subtype catalog, definition status, and schema version.',
    required_for_definition: true,
  },
  {
    section_key: 'schema',
    status: 'supported',
    summary: 'Body schema, subtype body contracts, validation rules, and schema keys.',
    required_for_definition: true,
  },
  {
    section_key: 'defaults',
    status: 'supported',
    summary: 'Default definition parts, default refs, merge strategy, and default resolver semantics.',
    required_for_definition: true,
  },
  {
    section_key: 'storage',
    status: 'supported',
    summary: 'Storage and sync class, privacy posture, retention posture, and cache/public record semantics.',
    required_for_definition: true,
  },
  {
    section_key: 'revision',
    status: 'supported',
    summary: 'Revision model, supersession behavior, withdrawal behavior, and latest-active projection rules.',
    required_for_definition: true,
  },
  {
    section_key: 'actions',
    status: 'supported',
    summary: 'Concrete packet operations; action keys are the source of derived affordances.',
    required_for_definition: true,
  },
  {
    section_key: 'builders',
    status: 'supported',
    summary: 'Declarative builder descriptors that select local supported builder engines.',
    required_for_definition: true,
  },
  {
    section_key: 'planners',
    status: 'supported',
    summary: 'Declarative planner descriptors that select local supported planner engines.',
    required_for_definition: true,
  },
  {
    section_key: 'policy',
    status: 'supported',
    summary: 'Policy action IDs and future proof/scope descriptors used by the fortress gate.',
    required_for_definition: true,
  },
  {
    section_key: 'projection',
    status: 'supported',
    summary: 'Read-model, graph, shell, search, and surface projection descriptors.',
    required_for_definition: true,
  },
  {
    section_key: 'indexing',
    status: 'supported',
    summary: 'Search, graph, and storage index descriptors derived from packet body paths.',
    required_for_definition: true,
  },
  {
    section_key: 'compatibility',
    status: 'supported',
    summary: 'Nearest-current adapters, loss awareness, safe defaults, and compatibility posture.',
    required_for_definition: true,
  },
  {
    section_key: 'bundling',
    status: 'supported',
    summary: 'Export/import rules, dependency transport, bundle role, and adapter-chain propagation.',
    required_for_definition: true,
  },
  {
    section_key: 'fixtures',
    status: 'unsupported',
    summary: 'Canonical examples, old-version examples, invalid examples, and round-trip test fixture keys.',
    required_for_definition: false,
  },
  {
    section_key: 'notes',
    status: 'supported',
    summary: 'Human guidance, invariants, constraints, migration notes, and open design questions.',
    required_for_definition: true,
  },
] as const satisfies readonly PacketManifestSectionDescriptor[];

export function listPacketManifestTemplateSections() {
  return PACKET_MANIFEST_DEFINITION_TEMPLATE;
}

export function getPacketManifestTemplateSection(
  sectionKey: PacketManifestSectionKey
): PacketManifestSectionDescriptor | null {
  return (
    PACKET_MANIFEST_DEFINITION_TEMPLATE.find(
      (section) => section.section_key === sectionKey
    ) ?? null
  );
}

export function listRequiredPacketManifestTemplateSectionKeys(): PacketManifestSectionKey[] {
  return PACKET_MANIFEST_DEFINITION_TEMPLATE.filter(
    (section) => section.required_for_definition
  ).map((section) => section.section_key);
}
