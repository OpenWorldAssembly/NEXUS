import assert from 'node:assert/strict';
import test from 'node:test';

import { PACKET_RUNTIME_CONNECTORS } from '@runtime/nexus/server/packet-runtime-connectors';
import {
  auditPacketClientIntentEnrollments,
  listPacketClientIntentEnrollments,
  resolvePacketClientIntentPreflight,
} from './packet-client-intent-enrollment.ts';
import { listMutationIntentDescriptors } from './mutation-intent-registry.ts';

test('client ingress enrollment includes every current prepare mutation intent', () => {
  const enrolledPrepareIntents = listPacketClientIntentEnrollments()
    .filter((enrollment) => enrollment.source_route === '/api/nexus/mutations/prepare')
    .map((enrollment) => enrollment.mutation_intent)
    .sort();
  const liveIntents = listMutationIntentDescriptors()
    .map((descriptor) => descriptor.kind)
    .sort();

  assert.deepEqual(enrolledPrepareIntents, liveIntents);
});

test('client ingress enrollment audit passes', () => {
  const report = auditPacketClientIntentEnrollments();

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
});

test('client intent ids stay interface-neutral', () => {
  for (const enrollment of listPacketClientIntentEnrollments()) {
    assert.equal(enrollment.enrollment_id.startsWith('client.'), true);
    assert.equal(enrollment.client_intent_id.startsWith('nexus.'), false);
    assert.equal(enrollment.client_intent_id.includes('shell'), false);
  }
});

test('enrolled prepare intent preflight resolves handoff and packet-backed requirements', () => {
  const preflight = resolvePacketClientIntentPreflight({
    sourceRoute: '/api/nexus/mutations/prepare',
    mutationIntent: 'follows.relation.set',
    clientIntentId: 'scope.follow.set',
  });

  assert.equal(preflight.status, 'allowed_definition');
  assert.ok(preflight.enrollment);
  assert.ok(preflight.handoff);
  assert.ok(preflight.policy_requirement_ids.length > 0);
  assert.ok(preflight.dependency_requirement_ids.length > 0);
  assert.ok(preflight.reason_codes.includes('registered_signed_fortress_prepare'));
});

test('Preference.element direct connector is runtime-ready and claimed writes use prepare enrollment', () => {
  assert.deepEqual(
    PACKET_RUNTIME_CONNECTORS.map((connector) => ({
      connector_id: connector.connector_id,
      availability: connector.availability,
    })),
    [
      {
        connector_id: 'preference.element.interface.set',
        availability: 'definition',
      },
    ]
  );

  const connectorEnrollments = listPacketClientIntentEnrollments().filter(
    (enrollment) => enrollment.live_mode === 'live_connector'
  );

  assert.equal(connectorEnrollments.length, 0);

  const preflight = resolvePacketClientIntentPreflight({
    sourceRoute: '/api/nexus/mutations/prepare',
    clientIntentId: 'preference.interface.set',
    mutationIntent: 'preference.element.set',
  });

  assert.equal(preflight.status, 'allowed_definition');
  assert.equal(preflight.enrollment?.live_mode, 'signed_fortress_prepare');
});

test('custom or unregistered client intent requests fail closed', () => {
  const preflight = resolvePacketClientIntentPreflight({
    sourceRoute: '/api/nexus/mutations/prepare',
    mutationIntent: 'relation.teleport',
  });

  assert.equal(preflight.status, 'blocked');
  assert.deepEqual(preflight.reason_codes, ['unknown_client_intent_enrollment']);
});

test('retired legacy bridge client intents fail closed', () => {
  for (const mutationIntent of [
    'assembly_association.claim.set',
    'home_locality.claim.set',
  ]) {
    const preflight = resolvePacketClientIntentPreflight({
      sourceRoute: '/api/nexus/mutations/prepare',
      mutationIntent,
    });

    assert.equal(preflight.status, 'blocked');
    assert.deepEqual(preflight.reason_codes, ['unknown_client_intent_enrollment']);
  }
});
