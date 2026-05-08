import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';

test('canonical locality planning emits ancestry and location packets while preserving the parent-scope compatibility mirror', () => {
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'locality-directory-service.ts'),
    'utf8'
  );

  assert.notEqual(source.indexOf("subtype: 'default_ancestry_parent'"), -1);
  assert.notEqual(source.indexOf("subtype: 'defined_by_location'"), -1);
  assert.notEqual(source.indexOf("subtype: 'region'"), -1);
  assert.notEqual(source.indexOf('createLocationPacket({'), -1);
  assert.notEqual(source.indexOf('createParentScopeCompatibilityEdge(parentPacketId)'), -1);
});
