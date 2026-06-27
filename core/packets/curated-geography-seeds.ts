/**
 * File: curated-geography-seeds.ts
 * Description: Deterministic curated global geography seed material for reseed v1.
 */

import {
  createAssemblyPacket,
  createLocationPacket,
  createPacketRef,
  createRelationPacket,
} from '@core/packets/builders.ts';
import type {
  LocalityLevel,
  PacketEnvelope,
  PacketRef,
} from '@core/schema/packet-schema.ts';

export const CURATED_GLOBAL_GEOGRAPHY_SEED_VERSION =
  '2026-06-26-curated-global-geography-v1';

type CuratedGeographySeedEntry = {
  slug: string;
  name: string;
  level: LocalityLevel;
  parent_slug: string | null;
  aliases?: string[];
  display_aliases?: string[];
};

export const CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES = [
  { slug: 'canada', name: 'Canada', level: 'nation', parent_slug: null, aliases: ['ca'] },
  { slug: 'canada-ontario', name: 'Ontario', level: 'region', parent_slug: 'canada', aliases: ['on'] },
  { slug: 'canada-toronto', name: 'Toronto', level: 'city', parent_slug: 'canada-ontario' },
  { slug: 'mexico', name: 'Mexico', level: 'nation', parent_slug: null, aliases: ['mx'] },
  { slug: 'mexico-cdmx', name: 'Mexico City', level: 'city', parent_slug: 'mexico', aliases: ['ciudad de mexico', 'cdmx'] },
  { slug: 'brazil', name: 'Brazil', level: 'nation', parent_slug: null, aliases: ['br'] },
  { slug: 'brazil-sao-paulo-state', name: 'Sao Paulo State', level: 'region', parent_slug: 'brazil', aliases: ['sao paulo'] },
  { slug: 'brazil-sao-paulo', name: 'Sao Paulo', level: 'city', parent_slug: 'brazil-sao-paulo-state' },
  { slug: 'united-kingdom', name: 'United Kingdom', level: 'nation', parent_slug: null, aliases: ['uk', 'gb'] },
  { slug: 'united-kingdom-england', name: 'England', level: 'region', parent_slug: 'united-kingdom' },
  { slug: 'united-kingdom-london', name: 'London', level: 'city', parent_slug: 'united-kingdom-england' },
  { slug: 'france', name: 'France', level: 'nation', parent_slug: null, aliases: ['fr'] },
  { slug: 'france-ile-de-france', name: 'Ile-de-France', level: 'region', parent_slug: 'france' },
  { slug: 'france-paris', name: 'Paris', level: 'city', parent_slug: 'france-ile-de-france' },
  { slug: 'germany', name: 'Germany', level: 'nation', parent_slug: null, aliases: ['de'] },
  { slug: 'germany-berlin-state', name: 'Berlin State', level: 'region', parent_slug: 'germany' },
  { slug: 'germany-berlin', name: 'Berlin', level: 'city', parent_slug: 'germany-berlin-state' },
  { slug: 'nigeria', name: 'Nigeria', level: 'nation', parent_slug: null, aliases: ['ng'] },
  { slug: 'nigeria-lagos-state', name: 'Lagos State', level: 'region', parent_slug: 'nigeria' },
  { slug: 'nigeria-lagos', name: 'Lagos', level: 'city', parent_slug: 'nigeria-lagos-state' },
  { slug: 'kenya', name: 'Kenya', level: 'nation', parent_slug: null, aliases: ['ke'] },
  { slug: 'kenya-nairobi-county', name: 'Nairobi County', level: 'region', parent_slug: 'kenya' },
  { slug: 'kenya-nairobi', name: 'Nairobi', level: 'city', parent_slug: 'kenya-nairobi-county' },
  { slug: 'india', name: 'India', level: 'nation', parent_slug: null, aliases: ['in'] },
  { slug: 'india-delhi', name: 'Delhi', level: 'region', parent_slug: 'india' },
  { slug: 'india-new-delhi', name: 'New Delhi', level: 'city', parent_slug: 'india-delhi' },
  { slug: 'japan', name: 'Japan', level: 'nation', parent_slug: null, aliases: ['jp'] },
  { slug: 'japan-tokyo-metropolis', name: 'Tokyo Metropolis', level: 'region', parent_slug: 'japan' },
  { slug: 'japan-tokyo', name: 'Tokyo', level: 'city', parent_slug: 'japan-tokyo-metropolis' },
  { slug: 'australia', name: 'Australia', level: 'nation', parent_slug: null, aliases: ['au'] },
  { slug: 'australia-new-south-wales', name: 'New South Wales', level: 'region', parent_slug: 'australia', aliases: ['nsw'] },
  { slug: 'australia-sydney', name: 'Sydney', level: 'city', parent_slug: 'australia-new-south-wales' },
] as const satisfies readonly CuratedGeographySeedEntry[];

function packetIdForSlug(slug: string): string {
  return `nexus:element/locality/${slug}`;
}

function locationPacketIdForSlug(slug: string): string {
  return `nexus:location/region/locality-${slug}`;
}

function ancestryRelationPacketIdForSlug(slug: string): string {
  return `nexus:relation/default-ancestry-parent/locality-${slug}`;
}

function containsRelationPacketIdForSlug(slug: string): string {
  return `nexus:relation/contains/locality-${slug}`;
}

function definedByLocationRelationPacketIdForSlug(slug: string): string {
  return `nexus:relation/defined-by-location/locality-${slug}`;
}

function canonicalNameKey(name: string): string {
  return name.trim().toLowerCase();
}

function entryRef(entry: CuratedGeographySeedEntry): PacketRef {
  return createPacketRef(packetIdForSlug(entry.slug));
}

function buildApplicableScopeRefs(input: {
  entry: CuratedGeographySeedEntry;
  entriesBySlug: ReadonlyMap<string, CuratedGeographySeedEntry>;
  rootRef: PacketRef;
}): PacketRef[] {
  const refs = [entryRef(input.entry)];
  let cursorSlug = input.entry.parent_slug;

  while (cursorSlug) {
    const parent = input.entriesBySlug.get(cursorSlug);

    if (!parent) {
      break;
    }

    refs.push(entryRef(parent));
    cursorSlug = parent.parent_slug;
  }

  refs.push(input.rootRef);
  return refs;
}

export function buildCuratedGlobalGeographySeedPackets(input: {
  rootRef: PacketRef;
  createdAt: string;
  createdByRef?: PacketRef | null;
  entries?: readonly CuratedGeographySeedEntry[];
}): PacketEnvelope[] {
  const entries = input.entries ?? CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES;
  const entriesBySlug = new Map(entries.map((entry) => [entry.slug, entry]));
  const createdByRef = input.createdByRef ?? input.rootRef;
  const packets: PacketEnvelope[] = [];

  for (const entry of entries) {
    const packetRef = entryRef(entry);
    const parentRef = entry.parent_slug
      ? createPacketRef(packetIdForSlug(entry.parent_slug))
      : input.rootRef;
    const applicableScopeRefs = buildApplicableScopeRefs({
      entry,
      entriesBySlug,
      rootRef: input.rootRef,
    });
    const aliasKeys = [
      canonicalNameKey(entry.name),
      ...(entry.aliases ?? []).map(canonicalNameKey),
    ];

    packets.push(
      createAssemblyPacket({
        packet_id: packetRef.packet_id,
        created_at: input.createdAt,
        adapter: 'curated-geography-seed',
        authority_scope_ref: packetRef,
        applicable_scope_refs: applicableScopeRefs,
        created_by: createdByRef,
        name: entry.name,
        summary: `Curated global geography v1 ${entry.level} assembly for ${entry.name}.`,
        locality_label: entry.name,
        locality: {
          level: entry.level,
          canonical_name_key: canonicalNameKey(entry.name),
          alias_keys: Array.from(new Set(aliasKeys)),
          display_aliases: entry.display_aliases ?? [],
        },
        tags: ['assembly', 'locality', entry.level, 'curated-global-v1'],
        metadata_tags: ['assembly', 'locality', entry.level, 'curated-global-v1'],
      })
    );

    packets.push(
      createRelationPacket({
        packet_id: ancestryRelationPacketIdForSlug(entry.slug),
        created_at: input.createdAt,
        adapter: 'curated-geography-seed',
        authority_scope_ref: packetRef,
        applicable_scope_refs: applicableScopeRefs,
        created_by: createdByRef,
        subtype: 'default_ancestry_parent',
        subject_ref: packetRef,
        target_ref: parentRef,
        scope_ref: packetRef,
        status: 'active',
        note: `Curated geography v1 ancestry: ${entry.name} -> ${parentRef.packet_id}.`,
        metadata_tags: ['relation', 'default-ancestry-parent', 'curated-global-v1'],
      }),
      createRelationPacket({
        packet_id: containsRelationPacketIdForSlug(entry.slug),
        created_at: input.createdAt,
        adapter: 'curated-geography-seed',
        authority_scope_ref: parentRef,
        applicable_scope_refs: applicableScopeRefs,
        created_by: createdByRef,
        subtype: 'contains',
        subject_ref: parentRef,
        target_ref: packetRef,
        scope_ref: parentRef,
        status: 'active',
        note: `Curated geography v1 containment: ${parentRef.packet_id} contains ${entry.name}.`,
        metadata_tags: ['relation', 'contains', 'curated-global-v1'],
      })
    );

    const locationRef = createPacketRef(locationPacketIdForSlug(entry.slug));

    packets.push(
      createLocationPacket({
        packet_id: locationRef.packet_id,
        created_at: input.createdAt,
        adapter: 'curated-geography-seed',
        authority_scope_ref: packetRef,
        applicable_scope_refs: applicableScopeRefs,
        created_by: createdByRef,
        subtype: 'region',
        title: entry.name,
        summary: `Curated global geography v1 location descriptor for ${entry.name}.`,
        status: 'provisional',
        location_label: entry.name,
        spatial_payload: {
          seed_version: CURATED_GLOBAL_GEOGRAPHY_SEED_VERSION,
          source: {
            kind: 'curated_manual_v1',
          },
          locality_level: entry.level,
          display_name: entry.name,
          canonical_name_key: canonicalNameKey(entry.name),
          alias_keys: Array.from(new Set(aliasKeys)),
          parent_ref: parentRef,
        },
        metadata_tags: ['location', 'region', 'curated-global-v1'],
      }),
      createRelationPacket({
        packet_id: definedByLocationRelationPacketIdForSlug(entry.slug),
        created_at: input.createdAt,
        adapter: 'curated-geography-seed',
        authority_scope_ref: packetRef,
        applicable_scope_refs: applicableScopeRefs,
        created_by: createdByRef,
        subtype: 'defined_by_location',
        subject_ref: packetRef,
        target_ref: locationRef,
        scope_ref: packetRef,
        status: 'active',
        note: `Curated geography v1 location descriptor for ${entry.name}.`,
        metadata_tags: ['relation', 'defined-by-location', 'curated-global-v1'],
      })
    );
  }

  return packets;
}
