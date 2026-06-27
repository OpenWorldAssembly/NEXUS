/**
 * File: legacy-seed-source-inventory.test.ts
 * Description: Regression coverage for pre-reseed legacy seed/source classification.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import { createLegacySeedSourceInventoryReport } from './legacy-seed-source-inventory.ts';

test('legacy seed source inventory classifies every discovered marker without removal blockers', () => {
  const report = createLegacySeedSourceInventoryReport();

  assert.equal(report.status, 'pass', JSON.stringify(report.blockers, null, 2));
  assert.deepEqual(report.blockers, []);
  assert.ok(report.entries.length > 0);
});

test('legacy seed source inventory keeps fresh seed cleanup candidates closed', () => {
  const report = createLegacySeedSourceInventoryReport();

  assert.deepEqual(report.cleanup_candidates, []);
  assert.ok(
    report.entries.some(
      (entry) =>
        entry.marker === 'parent_scope' &&
        entry.classification === 'compatibility_read_only'
    )
  );
});
