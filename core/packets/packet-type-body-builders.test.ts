/**
 * File: packet-type-body-builders.test.ts
 * Description: Tests for canonical packet-type body candidate builders.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  buildElementPreferenceBody,
  getExperimentalPacketTypeDefinition,
  listPacketDefinitionParts,
} from '@core/packets/packet-definition-manifest';
import {
  buildPacketTypeBodyCandidate,
  listPacketTypeBodyBuilders,
} from '@core/packets/packet-type-body-builders';

test('Definition builder creates valid bodies for required definition part subtypes', () => {
  const definition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(definition);

  const requiredParts = listPacketDefinitionParts(definition).filter(
    (part) => part.required
  );
  assert.ok(requiredParts.length > 0);

  for (const part of requiredParts) {
    const candidate = buildPacketTypeBodyCandidate({
      packet_type: 'Definition',
      packet_subtype: part.part_subtype,
      definition,
      part,
    });

    assert.equal(candidate.packet_type, 'Definition');
    assert.equal(candidate.packet_subtype, part.part_subtype);
    assert.equal(candidate.body.subtype, part.part_subtype);
    assert.equal(candidate.body.defines_packet_type, part.defines_packet_type);
  }
});

test('Bundle.packet_set builder creates a valid inventory body candidate', () => {
  const candidate = buildPacketTypeBodyCandidate({
    packet_type: 'Bundle',
    packet_subtype: 'packet_set',
    title: 'Preference definition bundle',
    purpose: 'Carry Preference definition parts for canonical profile review.',
    items: [
      {
        item_role: 'definition_part',
        packet_ref: null,
        revision_ref: null,
        packet_type: 'Definition',
        packet_subtype: 'packet_schema',
        schema_version: '0.1.0',
        digest: null,
        required: true,
        notes: 'Preference schema definition part.',
      },
    ],
  });

  assert.equal(candidate.packet_type, 'Bundle');
  assert.equal(candidate.packet_subtype, 'packet_set');
  assert.equal(candidate.body.type, 'bundle');
  assert.equal(candidate.body.items[0].packet_type, 'Definition');
});

test('Preference.element builder candidate matches the existing helper output', () => {
  const input = {
    owner_ref: { packet_id: 'nexus:element/person/alice' },
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/example'],
    },
  };
  const candidate = buildPacketTypeBodyCandidate({
    packet_type: 'Preference',
    packet_subtype: 'element',
    input,
  });

  assert.deepEqual(candidate.body, buildElementPreferenceBody(input));
});

test('packet-type body builder registry exposes runtime-ready canonical builders', () => {
  const builders = listPacketTypeBodyBuilders();
  const builderIds = builders.map((builder) => builder.builder_id);

  assert.ok(builderIds.includes('definition.part.body.v0'));
  assert.ok(builderIds.includes('bundle.packet_set.body.v0'));
  assert.ok(builderIds.includes('preference.element.body.v0'));
  assert.equal(
    builders.every((builder) => builder.availability === 'runtime_ready'),
    true
  );
});

test('unknown packet type body builder requests fail closed', () => {
  assert.throws(
    () =>
      buildPacketTypeBodyCandidate({
        packet_type: 'Unknown',
        packet_subtype: 'thing',
      } as never),
    /Unsupported packet type body builder request|Unknown packet type body builder/
  );
});
