import assert from 'node:assert/strict';
import test from 'node:test';

import { listPacketPipelineInventory } from '@core/packets/pipeline-inventory';
import { PACKET_FAMILIES } from '@core/schema/packet-schema';

test('packet pipeline inventory covers every packet family exactly once', () => {
  const inventory = listPacketPipelineInventory();
  const families = inventory.map((entry) => entry.family);

  assert.deepEqual(families.sort(), [...PACKET_FAMILIES].sort());
});
