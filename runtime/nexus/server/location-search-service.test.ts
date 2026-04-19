import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createLocalityCanonicalNameKey,
  getLocalityFuzzySimilarity,
  getLocalitySearchMatchScore,
  normalizeLocalitySearchText,
  toLocalitySearchLevel,
} from '../location-search-normalization.ts';

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

test('locality canonical keys and fuzzy similarity support duplicate warnings', () => {
  assert.equal(createLocalityCanonicalNameKey('  Sunnymead--Ranch  '), 'sunnymead ranch');
  assert.ok(getLocalityFuzzySimilarity('Sunnymead Rnch', 'Sunnymead Ranch') >= 0.5);
  assert.ok(getLocalityFuzzySimilarity('Belltown', 'Sunnymead Ranch') < 0.5);
});
