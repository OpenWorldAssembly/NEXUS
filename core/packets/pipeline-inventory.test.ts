import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listPacketPipelineInventory,
  type PipelineStatus,
} from '@core/packets/pipeline-inventory';
import { PACKET_FAMILIES } from '@core/schema/packet-schema';

const VALID_STATUSES = new Set<PipelineStatus>([
  'none',
  'declared',
  'partial',
  'tested',
  'production',
]);

test('packet pipeline inventory covers every packet family exactly once', () => {
  const inventory = listPacketPipelineInventory();
  const families = inventory.map((entry) => entry.family);

  assert.deepEqual(families.sort(), [...PACKET_FAMILIES].sort());
});

test('packet pipeline inventory uses explicit stage statuses for every family', () => {
  for (const entry of listPacketPipelineInventory()) {
    assert.equal(VALID_STATUSES.has(entry.builder_pipeline_status), true);
    assert.equal(VALID_STATUSES.has(entry.same_family_adapter_status), true);
    assert.equal(VALID_STATUSES.has(entry.family_evolution_status), true);
    assert.equal(VALID_STATUSES.has(entry.read_model_status), true);
    assert.equal(Boolean(entry.next_migration_step.trim()), true);
  }
});

test('inventory does not overstate next-target live families as production pipeline families', () => {
  const inventory = listPacketPipelineInventory();
  const element = inventory.find((entry) => entry.family === 'Element');
  const claim = inventory.find((entry) => entry.family === 'Claim');
  const attestation = inventory.find((entry) => entry.family === 'Attestation');
  const role = inventory.find((entry) => entry.family === 'Role');
  const proposal = inventory.find((entry) => entry.family === 'Proposal');
  const vote = inventory.find((entry) => entry.family === 'Vote');
  const decision = inventory.find((entry) => entry.family === 'Decision');
  const discussion = inventory.find((entry) => entry.family === 'Discussion');

  assert.equal(element?.builder_pipeline_status, 'production');
  assert.equal(claim?.builder_pipeline_status, 'production');
  assert.equal(attestation?.builder_pipeline_status, 'production');
  assert.equal(role?.builder_pipeline_status, 'production');
  assert.equal(proposal?.builder_pipeline_status, 'production');
  assert.equal(vote?.builder_pipeline_status, 'production');
  assert.equal(decision?.builder_pipeline_status, 'production');
  assert.equal(discussion?.family_evolution_status, 'production');
});
