/**
 * File: trusted_dispatch_coordinator.test.ts
 * Description: Smoke tests for the Trusted Dispatch Coordinator compatibility bridge.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import { trustedDispatchCoordinator } from './trusted_dispatch_coordinator/trusted_dispatch_coordinator.ts';
import { trustedRequestCoordinator } from './trusted_request_coordinator/trusted_request_coordinator.ts';

const actorPacket = {
  header: {
    packet_id: 'actor.packet',
  },
} as PacketEnvelopeByType['Element'];

test('trusted dispatch coordinator normalizes through the request bridge', () => {
  const result = trustedDispatchCoordinator.normalizeRequest({
    source_kind: 'interface_signal',
    source_route: '/api/nexus/mutations/prepare',
    operation_kind: 'mutation_prepare',
    client_intent_id: 'scope.association.set',
    mutation_intent: 'relation.association.add',
    request_id: 'interface.event.test',
  });

  assert.equal(result.coordinator_id, 'trusted_dispatch_coordinator.v0');
  assert.equal(result.coordinator_kind, 'dispatch');
  assert.equal(result.value?.request_id, 'interface.event.test');
  assert.equal(result.value?.mutation_intent, 'relation.association.add');
});

test('trusted dispatch coordinator preserves enrollment parity with request coordinator', () => {
  const dispatchResult = trustedDispatchCoordinator.listEnrollments();
  const requestResult = trustedRequestCoordinator.listEnrollments();

  assert.equal(dispatchResult.coordinator_kind, 'dispatch');
  assert.equal(
    dispatchResult.value?.enrollments.length,
    requestResult.value?.enrollments.length
  );
});

test('dispatch-owned prepare write pipeline blocks instead of falling back to legacy mutation services', async () => {
  const result = await trustedDispatchCoordinator.prepareEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/prepare',
    client_intent_id: 'scope.follow.set',
    request_id: 'dispatch.write.prepare.test',
    actor_packet: actorPacket,
    actor_key: 'actor.key',
    intent: {
      kind: 'relation.follow.add',
      scope_id: 'scope.packet',
      target_scope_packet_id: 'target.scope',
    },
  });

  assert.equal(result.coordinator_id, 'trusted_dispatch_coordinator.v0');
  assert.equal(result.coordinator_kind, 'dispatch');
  assert.notEqual(result.status, 'ok');
  assert.equal(result.value, null);
});

test('dispatch-owned finalize write pipeline rejects legacy signed packet finalize payloads', async () => {
  const result = await trustedDispatchCoordinator.finalizeEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/finalize',
    client_intent_id: 'scope.follow.set',
    request_id: 'dispatch.write.finalize.test',
    actor_packet: actorPacket,
    request: {
      ticket_id: 'certification.ticket',
      signed_packets: [],
    },
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.issues[0]?.code, 'dispatch.certification_payload_unsupported');
});

test('mutation routes do not call the legacy mutation service corridor', () => {
  const prepareRoute = readFileSync(
    'src/app/api/nexus/mutations/prepare+api.ts',
    'utf8'
  );
  const finalizeRoute = readFileSync(
    'src/app/api/nexus/mutations/finalize+api.ts',
    'utf8'
  );
  const routeSource = `${prepareRoute}\n${finalizeRoute}`;

  assert.equal(routeSource.includes('mutationService.prepareMutation('), false);
  assert.equal(routeSource.includes('mutationService.finalizeMutation('), false);
  assert.equal(routeSource.includes('mutationService.readTicket('), false);
});
