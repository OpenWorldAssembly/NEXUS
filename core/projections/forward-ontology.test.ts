import assert from 'node:assert/strict';
import test from 'node:test';

import {
  createCausePacket,
  createClaimPacket,
  createLocationPacket,
} from '@core/packets/builders';

import {
  projectClaimAsRelationAssertion,
  projectPacketToForwardOntology,
} from './forward-ontology.ts';

test('legacy initiative-family packets project into the forward cause ontology', () => {
  const packet = {
    header: {
      packet_id: 'nexus:initiative/owa',
      revision_id: 'nexus:initiative/owa@r1',
      family: 'Initiative' as const,
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-05-07T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-05-07T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
        compatibility: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      title: 'OWA',
      summary: 'Open World Assembly',
      status: 'active',
    },
  };

  const projection = projectPacketToForwardOntology(packet);

  assert.equal(projection.type, 'cause');
  assert.equal(projection.subtype, 'initiative');
  assert.equal(projection.is_legacy_projection, true);
});

test('forward packets project with their canonical type and subtype', () => {
  const cause = createCausePacket({
    packet_id: 'nexus:cause/owa',
    created_at: '2026-05-07T00:00:00.000Z',
    subtype: 'initiative',
    title: 'OWA',
    status: 'active',
  });
  const location = createLocationPacket({
    packet_id: 'nexus:location/service-area',
    created_at: '2026-05-07T00:01:00.000Z',
    subtype: 'service_area',
    title: 'Service Area',
    status: 'active',
  });

  const causeProjection = projectPacketToForwardOntology(cause);
  const locationProjection = projectPacketToForwardOntology(location);

  assert.equal(causeProjection.type, 'cause');
  assert.equal(causeProjection.subtype, 'initiative');
  assert.equal(causeProjection.is_legacy_projection, false);
  assert.equal(locationProjection.type, 'location');
  assert.equal(locationProjection.subtype, 'service_area');
});

test('claim packets project as relation assertions without losing claim semantics', () => {
  const claim = createClaimPacket({
    packet_id: 'nexus:claim/home-locality/alice',
    created_at: '2026-05-07T00:02:00.000Z',
    claim_kind: 'home_locality',
    subject_ref: { packet_id: 'nexus:element/alice' },
    target_ref: { packet_id: 'nexus:element/moreno-valley' },
    scope_ref: { packet_id: 'nexus:element/moreno-valley' },
    note: 'Alice claims Moreno Valley as home locality.',
  });

  const projection = projectClaimAsRelationAssertion(claim);

  assert.equal(projection.relation_subtype, 'home_locality');
  assert.equal(projection.subject_ref.packet_id, 'nexus:element/alice');
  assert.equal(projection.target_ref.packet_id, 'nexus:element/moreno-valley');
  assert.equal(projection.source_claim_packet_id, claim.header.packet_id);
});
