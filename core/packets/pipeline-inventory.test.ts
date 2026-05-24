import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listPacketPipelineInventory,
  type PipelineStatus,
} from '@core/packets/pipeline-inventory';
import { PACKET_TYPES } from '@core/schema/packet-schema';

const VALID_STATUSES = new Set<PipelineStatus>([
  'none',
  'declared',
  'partial',
  'tested',
  'production',
]);

test('packet pipeline inventory covers every packet type exactly once', () => {
  const inventory = listPacketPipelineInventory();
  const types = inventory.map((entry) => entry.type);

  assert.deepEqual(types.sort(), [...PACKET_TYPES].sort());
});

test('packet pipeline inventory uses explicit stage statuses for every type', () => {
  for (const entry of listPacketPipelineInventory()) {
    assert.equal(VALID_STATUSES.has(entry.builder_pipeline_status), true);
    assert.equal(VALID_STATUSES.has(entry.same_type_adapter_status), true);
    assert.equal(VALID_STATUSES.has(entry.type_evolution_status), true);
    assert.equal(VALID_STATUSES.has(entry.read_model_status), true);
    assert.equal(Boolean(entry.next_migration_step.trim()), true);
  }
});

test('inventory does not overstate next-target live types as production pipeline types', () => {
  const inventory = listPacketPipelineInventory();
  const element = inventory.find((entry) => entry.type === 'Element');
  const claim = inventory.find((entry) => entry.type === 'Claim');
  const reaction = inventory.find((entry) => entry.type === 'Reaction');
  const role = inventory.find((entry) => entry.type === 'Role');
  const proposal = inventory.find((entry) => entry.type === 'Proposal');
  const decision = inventory.find((entry) => entry.type === 'Decision');
  const discussion = inventory.find((entry) => entry.type === 'Discussion');

  assert.equal(element?.builder_pipeline_status, 'production');
  assert.equal(claim?.builder_pipeline_status, 'production');
  assert.equal(reaction?.builder_pipeline_status, 'production');
  assert.equal(role?.builder_pipeline_status, 'production');
  assert.equal(proposal?.builder_pipeline_status, 'production');
  assert.equal(decision?.builder_pipeline_status, 'production');
  assert.equal(discussion?.type_evolution_status, 'production');
});
