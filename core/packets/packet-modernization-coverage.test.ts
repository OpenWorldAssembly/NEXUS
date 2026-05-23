/**
 * File: packet-modernization-coverage.test.ts
 * Description: Verifies packet modernization coverage reports stay aligned with live ontology.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listPacketTypeModernizationCoverage,
  listPacketNextPhaseLiveEnrollmentTargets,
} from '@core/packets/packet-modernization-coverage';
import { listDefinedPacketTypeDefinitions } from '@core/packets/packet-definition-manifest';
import { GENERIC_PACKET_BUILD_TYPES } from '@core/packets/packet-build-pipeline';
import { PACKET_TYPES } from '@core/schema/packet-schema';

test('packet modernization coverage includes every live packet type', () => {
  const coverage = listPacketTypeModernizationCoverage();
  const coveredTypes = coverage.map((entry) => entry.type).sort();

  assert.deepEqual(coveredTypes, [...PACKET_TYPES].sort());
});

test('live packet types keep body schema and compatibility registry coverage', () => {
  const coverage = listPacketTypeModernizationCoverage();

  for (const entry of coverage) {
    assert.equal(
      entry.body_schema_status,
      'present',
      `${entry.type} must keep a body schema`
    );
    assert.equal(
      entry.compatibility_registry_status,
      'present',
      `${entry.type} must keep a compatibility registry entry`
    );
  }
});

test('packet modernization missing coverage is explicitly classified', () => {
  const coverage = listPacketTypeModernizationCoverage();

  for (const entry of coverage) {
    const statusValues = [
      entry.body_schema_status,
      entry.compatibility_registry_status,
      entry.build_pipeline_status,
      entry.manifest_definition_status,
      entry.definition_parts_status,
    ];
    const plannedGapCount = statusValues.filter(
      (status) => status === 'missing_coverage'
    ).length;

    assert.equal(
      entry.missing_coverage_items.length,
      plannedGapCount,
      `${entry.type} should explain each packet modernization gap`
    );

    for (const gap of entry.missing_coverage_items) {
      assert.equal(gap.status, 'missing_coverage');
      assert.ok(gap.reason.length > 0, `${entry.type} gap needs a reason`);
    }
  }
});

test('preference remains manifest-defined with complete definition parts', () => {
  const preferenceCoverage = listPacketTypeModernizationCoverage().find(
    (entry) => entry.type === 'Preference'
  );

  assert.ok(preferenceCoverage);
  assert.equal(preferenceCoverage.manifest_definition_status, 'defined');
  assert.equal(preferenceCoverage.definition_parts_status, 'complete');
  assert.ok(preferenceCoverage.definition_part_count > 0);
});

test('generic builder types now have manifest definitions and definition parts', () => {
  const coverageByType = new Map(
    listPacketTypeModernizationCoverage().map((entry) => [entry.type, entry])
  );

  for (const type of GENERIC_PACKET_BUILD_TYPES) {
    const entry = coverageByType.get(type);
    assert.ok(entry);
    assert.equal(entry.build_pipeline_status, 'supported', type);
    assert.equal(entry.manifest_definition_status, 'defined', type);
    assert.equal(entry.definition_parts_status, 'complete', type);
    assert.ok(entry.definition_part_count > 0, type);
  }
});

test('types without generic builders report explicit missing coverage', () => {
  const coverage = listPacketTypeModernizationCoverage();
  const genericTypes = new Set<string>(GENERIC_PACKET_BUILD_TYPES);

  for (const entry of coverage) {
    if (genericTypes.has(entry.type)) {
      continue;
    }

    assert.equal(entry.build_pipeline_status, 'missing_coverage', entry.type);
    assert.ok(
      entry.missing_coverage_items.some((gap) => gap.area === 'build_pipeline'),
      `${entry.type} should keep the builder missing coverage item`
    );
  }
});

test('Preference is manifest-defined with canonical builder support', () => {
  const preferenceCoverage = listPacketTypeModernizationCoverage().find(
    (entry) => entry.type === 'Preference'
  );

  assert.ok(preferenceCoverage);
  assert.equal(preferenceCoverage.manifest_definition_status, 'defined');
  assert.equal(preferenceCoverage.definition_parts_status, 'complete');
  assert.equal(preferenceCoverage.build_pipeline_status, 'supported');
  assert.equal(
    preferenceCoverage.missing_coverage_items.some((gap) => gap.area === 'build_pipeline'),
    false
  );
});

test('Definition and Bundle are recorded as canonical packet types', () => {
  const targets = listPacketNextPhaseLiveEnrollmentTargets();

  assert.deepEqual(
    targets.map((target) => target.packet_type).sort(),
    ['Bundle', 'Definition']
  );

  for (const target of targets) {
    assert.equal(target.target_status, 'canonical_type');
    assert.equal(target.currently_in_packet_types, true);
    assert.equal(target.manifest_definition_status, 'defined');
    assert.ok(target.reason.includes('canonical packet types'));
  }
});

test('packet-type modernization coverage includes every canonical manifest definition', () => {
  const coveredPacketTypes = listPacketTypeModernizationCoverage()
    .map((entry) => entry.packet_type)
    .sort();
  const manifestPacketTypes = listDefinedPacketTypeDefinitions()
    .map((definition) => definition.packet_type)
    .sort();

  assert.deepEqual(coveredPacketTypes, manifestPacketTypes);
});

test('canonical packet types have executable body-builder coverage', () => {
  const coverageByPacketType = new Map(
    listPacketTypeModernizationCoverage().map((entry) => [
      entry.packet_type,
      entry,
    ])
  );

  for (const packetType of ['Definition', 'Bundle', 'Preference'] as const) {
    const entry = coverageByPacketType.get(packetType);
    assert.ok(entry);
    assert.equal(entry.manifest_definition_status, 'defined');
    assert.equal(entry.definition_parts_status, 'complete');
    assert.equal(entry.descriptor_builder_status, 'defined');
    assert.equal(entry.body_builder_status, 'supported');
    assert.equal(entry.definition_mutation_plan_status, 'supported');
    assert.equal(entry.compatibility_standard_status, 'supported');
  }
});

test('packet-type modernization coverage reports compatibility standard coverage', () => {
  for (const entry of listPacketTypeModernizationCoverage()) {
    assert.equal(entry.compatibility_standard_status, 'supported', entry.packet_type);
    assert.equal(
      entry.missing_coverage_items.some((gap) => gap.area === 'compatibility_definition'),
      false,
      entry.packet_type
    );
  }
});
