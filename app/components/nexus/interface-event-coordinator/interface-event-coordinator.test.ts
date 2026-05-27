/**
 * File: interface-event-coordinator.test.ts
 * Description: Unit coverage for pure Interface Event Coordinator state and validation helpers.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createInterfaceEvent,
  createInterfaceEventHeaders,
  updateInterfaceEventStatus,
} from './interface-event-state.ts';
import {
  interfaceRegex,
  interfaceStringLength,
  requiredInterfaceValue,
  validateInterfaceEvent,
} from './interface-event-validation.ts';

test('interface event helpers create event envelopes and headers', () => {
  const event = createInterfaceEvent({
    source: {
      kind: 'form',
      surface: 'trust',
    },
    intent: {
      clientIntentId: 'scope.association.set',
      targetRoute: '/api/nexus/mutations/prepare',
      mutationIntent: 'relation.association.add',
      actorPacketId: 'nexus:element/alice',
      payload: {
        scope_id: 'nexus:element/city',
      },
    },
  });
  const headers = createInterfaceEventHeaders(event);

  assert.equal(event.event_kind, 'interface.event');
  assert.equal(event.status, 'created');
  assert.equal(event.source_surface, 'trust');
  assert.equal(headers['x-nexus-interface-event-id'], event.event_id);
  assert.equal(headers['x-nexus-interface-event-client-intent-id'], 'scope.association.set');
});

test('interface event status updates preserve event identity and set settled timestamp', () => {
  const event = createInterfaceEvent({
    source: {
      kind: 'form',
      surface: 'roles',
    },
    intent: {
      clientIntentId: 'relation.participation.add',
      targetRoute: '/api/nexus/mutations/prepare',
    },
  });
  const settledEvent = updateInterfaceEventStatus(
    updateInterfaceEventStatus(event, 'dispatching'),
    'settled'
  );

  assert.equal(settledEvent.event_id, event.event_id);
  assert.equal(settledEvent.status, 'settled');
  assert.notEqual(settledEvent.settled_at, null);
});

test('interface validation helpers collect required, length, and regex failures', () => {
  const result = validateInterfaceEvent([
    requiredInterfaceValue('title', ''),
    interfaceStringLength({
      field: 'body',
      value: 'x',
      min: 3,
    }),
    interfaceRegex({
      field: 'slug',
      value: 'Bad Slug',
      pattern: /^[a-z-]+$/,
      message: 'Slug must be lower-case kebab text.',
    }),
  ]);

  assert.equal(result.status, 'invalid');
  assert.deepEqual(
    result.issues.map((issue) => issue.code),
    ['required', 'too_short', 'pattern_mismatch']
  );
});
