import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createFallbackLocalityScopeDescriptor,
  readLocalityScopeDescriptor,
} from '../location-search.ts';
import {
  createLocalityCanonicalNameKey,
  getLocalityFuzzySimilarity,
  getLocalitySearchMatchScore,
  matchesLocalitySearchScopeFilter,
  normalizeLegacyAsciiLocalitySearchText,
  normalizeLocalitySearchText,
  toLocalitySearchLevel,
} from '../location-search-normalization.ts';

const CALIFORNIA_NODE = {
  level: 'region',
  parent_packet_id: 'nexus:element/united-states',
} satisfies Parameters<typeof matchesLocalitySearchScopeFilter>[0];

function createFilters(
  filters: Parameters<typeof matchesLocalitySearchScopeFilter>[1]
) {
  return filters;
}

test('locality search normalization ignores case, punctuation, hyphens, and repeated spaces', () => {
  const canonicalKey = normalizeLocalitySearchText('Sunnymead Ranch');

  assert.equal(normalizeLocalitySearchText('sunnymead ranch'), canonicalKey);
  assert.equal(normalizeLocalitySearchText('Sunnymead-Ranch'), canonicalKey);
  assert.equal(normalizeLocalitySearchText('  SUNNYMEAD   RANCH  '), canonicalKey);
  assert.equal(normalizeLocalitySearchText('Sunnymead, Ranch'), canonicalKey);
});

test('locality search maps legacy geographic subtypes to canonical levels', () => {
  assert.equal(toLocalitySearchLevel('nation'), 'nation');
  assert.equal(toLocalitySearchLevel('state'), 'region');
  assert.equal(toLocalitySearchLevel('region'), 'region');
  assert.equal(toLocalitySearchLevel('city'), 'city');
  assert.equal(toLocalitySearchLevel('district'), 'district');
  assert.equal(toLocalitySearchLevel('neighborhood'), 'district');
  assert.equal(toLocalitySearchLevel('global'), null);
  assert.equal(toLocalitySearchLevel('personal'), null);
  assert.equal(toLocalitySearchLevel('team'), null);
});

test('locality search simple aliases match Sunnymead-style multi-word localities', () => {
  assert.notEqual(
    getLocalitySearchMatchScore({
      query: 'Sunnymead',
      searchableValues: ['Sunnymead Ranch', 'A neighborhood assembly branch'],
    }),
    null
  );
  assert.notEqual(
    getLocalitySearchMatchScore({
      query: 'sunnymead-ranch',
      searchableValues: ['Sunnymead Ranch'],
    }),
    null
  );
});

test('locality search filters by requested level and parent scope', () => {
  assert.equal(
    matchesLocalitySearchScopeFilter(
      CALIFORNIA_NODE,
      createFilters({
        level: 'region',
        parentScopeId: 'nexus:element/united-states',
      })
    ),
    true
  );
  assert.equal(
    matchesLocalitySearchScopeFilter(
      CALIFORNIA_NODE,
      createFilters({
        level: 'city',
        parentScopeId: 'nexus:element/united-states',
      })
    ),
    false
  );
  assert.equal(
    matchesLocalitySearchScopeFilter(
      CALIFORNIA_NODE,
      createFilters({
        level: 'region',
        parentScopeId: 'nexus:element/global-commons',
      })
    ),
    false
  );
  assert.equal(
    matchesLocalitySearchScopeFilter(
      CALIFORNIA_NODE,
      createFilters({
        level: null,
        parentScopeId: null,
      })
    ),
    true
  );
});

test('locality canonical keys and fuzzy similarity support duplicate warnings', () => {
  assert.equal(createLocalityCanonicalNameKey('  Sunnymead--Ranch  '), 'sunnymead ranch');
  assert.ok(getLocalityFuzzySimilarity('Sunnymead Rnch', 'Sunnymead Ranch') >= 0.5);
  assert.ok(getLocalityFuzzySimilarity('Belltown', 'Sunnymead Ranch') < 0.5);
});

test('locality canonical keys preserve Unicode scripts and normalize accents deterministically', () => {
  assert.equal(createLocalityCanonicalNameKey('S\u00e3o Paulo'), 'sao paulo');
  assert.equal(createLocalityCanonicalNameKey('M\u00fcnchen'), 'munchen');
  assert.equal(createLocalityCanonicalNameKey('Qu\u00e9bec'), 'quebec');
  assert.equal(createLocalityCanonicalNameKey('Krak\u00f3w'), 'krakow');
  assert.equal(createLocalityCanonicalNameKey('\u5317\u4eac'), '\u5317\u4eac');
  assert.equal(createLocalityCanonicalNameKey('\u6771\u4eac\u90fd'), '\u6771\u4eac\u90fd');
});

test('locality matching remains accent-insensitive while preserving legacy ASCII alias compatibility', () => {
  const saoPauloKey = createLocalityCanonicalNameKey('S\u00e3o Paulo');
  const legacyAsciiAlias = normalizeLegacyAsciiLocalitySearchText('S\u00e3o Paulo');

  assert.equal(normalizeLocalitySearchText('Sao Paulo'), saoPauloKey);
  assert.equal(
    getLocalitySearchMatchScore({
      query: 'Quebec',
      searchableValues: ['Qu\u00e9bec'],
    }),
    0
  );
  assert.notEqual(legacyAsciiAlias, saoPauloKey);
  assert.ok(legacyAsciiAlias.includes('paulo'));
});

test('Unicode normalization never collapses non-Latin locality names to empty keys', () => {
  assert.notEqual(createLocalityCanonicalNameKey('\u5317\u4eac'), '');
  assert.notEqual(createLocalityCanonicalNameKey('\u6771\u4eac\u90fd'), '');
});

test('malformed stored descriptors fall back to the level-based descriptor instead of trusting invalid hierarchy systems', () => {
  assert.deepEqual(
    readLocalityScopeDescriptor(
      {
        hierarchy_system: 'invalid-system',
        local_type_label: 'Province',
        local_type_key: 'province',
        legacy_level: 'region',
      },
      'region'
    ),
    createFallbackLocalityScopeDescriptor('region')
  );
  assert.equal(
    readLocalityScopeDescriptor(
      {
        hierarchy_system: 'administrative',
        local_type_label: 'Province',
        local_type_key: 'province',
        legacy_level: 'region',
      },
      'region'
    )?.hierarchy_system,
    'administrative'
  );
});
