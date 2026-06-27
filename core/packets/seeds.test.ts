/**
 * File: seeds.test.ts
 * Description: Regression coverage for canonical reseed packet material.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  CANONICAL_SEED_PACKETS,
  CURATED_GLOBAL_GEOGRAPHY_SEED_PACKETS,
  PERSONAL_SEED_PACKETS,
  PERSONAL_TREE_PACKET_IDS,
} from '@core/packets/seeds.ts';
import {
  CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES,
} from '@core/packets/curated-geography-seeds.ts';
import type {
  PacketEnvelopeByType,
} from '@core/schema/packet-schema.ts';

function packetIds(packets: { header: { packet_id: string } }[]): string[] {
  return packets.map((packet) => packet.header.packet_id);
}

test('canonical seed packet ids are unique after curated geography expansion', () => {
  const ids = packetIds(CANONICAL_SEED_PACKETS);
  const uniqueIds = new Set(ids);

  assert.equal(uniqueIds.size, ids.length);
});

test('fresh seed element ancestry is relation-native instead of parent_scope edges', () => {
  const freshElementPackets = [
    ...PERSONAL_SEED_PACKETS,
    ...CURATED_GLOBAL_GEOGRAPHY_SEED_PACKETS,
  ].filter(
    (packet): packet is PacketEnvelopeByType['Element'] =>
      packet.header.type === 'Element'
  );

  assert.ok(freshElementPackets.length > 0);
  assert.equal(
    freshElementPackets.some((packet) =>
      packet.header.edges.some((edge) => edge.edge_type === 'parent_scope')
    ),
    false
  );
});

test('curated global geography v1 creates deterministic locality graph packets', () => {
  const elementPackets = CURATED_GLOBAL_GEOGRAPHY_SEED_PACKETS.filter(
    (packet): packet is PacketEnvelopeByType['Element'] =>
      packet.header.type === 'Element'
  );
  const locationPackets = CURATED_GLOBAL_GEOGRAPHY_SEED_PACKETS.filter(
    (packet): packet is PacketEnvelopeByType['Location'] =>
      packet.header.type === 'Location'
  );
  const relationPackets = CURATED_GLOBAL_GEOGRAPHY_SEED_PACKETS.filter(
    (packet): packet is PacketEnvelopeByType['Relation'] =>
      packet.header.type === 'Relation'
  );

  assert.equal(elementPackets.length, CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES.length);
  assert.equal(locationPackets.length, CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES.length);
  assert.equal(
    relationPackets.filter(
      (packet) => packet.body.subtype === 'default_ancestry_parent'
    ).length,
    CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES.length
  );
  assert.equal(
    relationPackets.filter((packet) => packet.body.subtype === 'contains').length,
    CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES.length
  );
  assert.equal(
    relationPackets.filter(
      (packet) => packet.body.subtype === 'defined_by_location'
    ).length,
    CURATED_GLOBAL_GEOGRAPHY_SEED_ENTRIES.length
  );
  assert.ok(
    elementPackets.some(
      (packet) => packet.header.packet_id === 'nexus:element/locality/nigeria'
    )
  );
  assert.ok(
    elementPackets.some(
      (packet) => packet.header.packet_id === 'nexus:element/locality/japan-tokyo'
    )
  );
  assert.ok(
    relationPackets.some(
      (packet) =>
        packet.body.subtype === 'default_ancestry_parent' &&
        packet.body.subject_ref.packet_id ===
          'nexus:element/locality/canada-toronto' &&
        packet.body.target_ref.packet_id ===
          'nexus:element/locality/canada-ontario'
    )
  );
  assert.ok(
    relationPackets.some(
      (packet) =>
        packet.body.subtype === 'default_ancestry_parent' &&
        packet.body.subject_ref.packet_id === 'nexus:element/locality/canada' &&
        packet.body.target_ref.packet_id ===
          PERSONAL_TREE_PACKET_IDS.global_commons
    )
  );
});

