import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditPacketApiEnrollmentCoverage,
  listPacketApiEnrollmentCoverage,
  resolveFinalizeMutationApiPreflight,
  resolvePrepareMutationApiPreflight,
} from './packet-api-crossing-guard.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';

test('prepare API preflight accepts every registered mutation intent', () => {
  for (const descriptor of listMutationIntentDescriptors()) {
    const preflight = resolvePrepareMutationApiPreflight({
      kind: descriptor.kind,
    });

    assert.equal(preflight.source_route, '/api/nexus/mutations/prepare');
    assert.equal(preflight.mutation_intent, descriptor.kind);
    assert.notEqual(preflight.status, 'blocked');
    assert.ok(preflight.client_intent_id);
  }
});

test('prepare API preflight rejects custom mutation intents', () => {
  assert.throws(
    () =>
      resolvePrepareMutationApiPreflight({
        kind: 'relation.teleport',
      } as never),
    /Packet API ingress is not enrolled/
  );
});

test('prepare API preflight rejects retired legacy bridge mutation intents', () => {
  for (const kind of [
    'association.claim.set',
    'home_locality.claim.set',
  ]) {
    assert.throws(
      () =>
        resolvePrepareMutationApiPreflight({
          kind,
        } as never),
      /Packet API ingress is not enrolled/
    );
  }
});

test('finalize API preflight uses the stored ticket intent direction', () => {
  const preflight = resolveFinalizeMutationApiPreflight({
    kind: 'follows.relation.set',
  });

  assert.equal(preflight.source_route, '/api/nexus/mutations/finalize');
  assert.equal(preflight.mutation_intent, 'follows.relation.set');
  assert.equal(preflight.status, 'allowed_definition');

  assert.throws(
    () =>
      resolveFinalizeMutationApiPreflight({
        kind: 'relation.teleport',
      } as never),
    /Packet API ingress is not enrolled/
  );
});

test('API enrollment coverage reports prepare route enrollment only', () => {
  const coverageByRoute = new Map(
    listPacketApiEnrollmentCoverage().map((coverage) => [
      coverage.source_route,
      coverage,
    ])
  );

  const prepareCoverage = coverageByRoute.get('/api/nexus/mutations/prepare');
  assert.ok(prepareCoverage);
  assert.equal(
    prepareCoverage.enrollment_count,
    listMutationIntentDescriptors().length
  );
  assert.equal(coverageByRoute.has('/api/nexus/shell-preferences'), false);
});

test('API enrollment audit delegates to neutral client ingress audit', () => {
  const report = auditPacketApiEnrollmentCoverage();

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});
