import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveNexusFeatureStatusEntry } from '@app/components/nexus/nexus-feature-status-registry';

test('resolveNexusFeatureStatusEntry fills shared status defaults', () => {
  const entry = resolveNexusFeatureStatusEntry('votes.object');

  assert.equal(entry.kind, 'read_only');
  assert.equal(entry.short_label, 'Read-only');
  assert.equal(entry.title, 'Objection flows are not live yet');
  assert.match(entry.summary, /inspect/i);
});

test('resolveNexusFeatureStatusEntry keeps custom registry details', () => {
  const entry = resolveNexusFeatureStatusEntry('library.trace_lineage');

  assert.equal(entry.kind, 'partial');
  assert.equal(entry.short_label, 'Partial');
  assert.match(entry.details ?? '', /Open packet/i);
});
