import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createActionPacket,
  createClaimPacket,
  createElementPacket,
  createLocationPacket,
} from '@core/packets/builders';

import {
  projectClaimAsRelationAssertion,
  projectPacketToForwardOntology,
} from './forward-ontology.ts';

test('forward packets project with their canonical type and subtype', () => {
  const location = createLocationPacket({
    packet_id: 'nexus:location/service-area',
    created_at: '2026-05-07T00:01:00.000Z',
    subtype: 'service_area',
    title: 'Service Area',
    status: 'active',
  });
  const action = createActionPacket({
    packet_id: 'nexus:action/owa',
    created_at: '2026-05-07T00:01:30.000Z',
    subtype: 'initiative',
    title: 'OWA',
    status: 'active',
  });

  const locationProjection = projectPacketToForwardOntology(location);
  const actionProjection = projectPacketToForwardOntology(action);

  assert.equal(actionProjection.type, 'action');
  assert.equal(actionProjection.subtype, 'initiative');
  assert.equal(actionProjection.is_legacy_projection, false);
  assert.equal(locationProjection.type, 'location');
  assert.equal(locationProjection.subtype, 'service_area');
});

test('element packets project to canonical subtypes', () => {
  const element = createElementPacket({
    packet_id: 'nexus:element/person/alice',
    created_at: '2026-05-07T00:01:30.000Z',
    subtype: 'person',
    name: 'Alice',
  });

  const projection = projectPacketToForwardOntology(element);

  assert.equal(projection.type, 'element');
  assert.equal(projection.subtype, 'person');
});

test('claim packets project as relation assertions without losing claim semantics', () => {
  const claim = createClaimPacket({
    packet_id: 'nexus:claim/home-locality/alice',
    created_at: '2026-05-07T00:02:00.000Z',
    subtype: 'home_locality',
    subject_ref: { packet_id: 'nexus:element/alice' },
    target_ref: { packet_id: 'nexus:element/moreno-valley' },
    scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    note: 'Alice claims Moreno Valley as home locality.',
  });

  const projection = projectClaimAsRelationAssertion(claim);

  assert.equal(claim.body.subtype, 'relation_assertion');
  assert.equal(projection.relation_subtype, 'home_locality');
  assert.equal(projection.claim_subtype, 'relation_assertion');
  assert.equal(projection.subject_ref.packet_id, 'nexus:element/alice');
  assert.equal(projection.target_ref.packet_id, 'nexus:element/moreno-valley');
  assert.equal(projection.source_claim_packet_id, claim.header.packet_id);
});
