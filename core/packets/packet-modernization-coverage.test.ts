/**
 * File: packet-modernization-coverage.test.ts
 * Description: Verifies packet modernization coverage reports stay aligned with live ontology.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listPacketFamilyModernizationCoverage,
  listPacketNextPhaseLiveEnrollmentTargets,
  listPacketTypeModernizationCoverage,
} from '@core/packets/packet-modernization-coverage';
import { listExperimentalPacketTypeDefinitions } from '@core/packets/packet-definition-manifest';
import { GENERIC_PACKET_BUILD_FAMILIES } from '@core/packets/packet-build-pipeline';
import { PACKET_FAMILIES } from '@core/schema/packet-schema';

test('packet modernization coverage includes every live packet family', () => {
  const coverage = listPacketFamilyModernizationCoverage();
  const coveredFamilies = coverage.map((entry) => entry.family).sort();

  assert.deepEqual(coveredFamilies, [...PACKET_FAMILIES].sort());
});

test('live packet families keep body schema and compatibility registry coverage', () => {
  const coverage = listPacketFamilyModernizationCoverage();

  for (const entry of coverage) {
    assert.equal(
      entry.body_schema_status,
      'present',
      `${entry.family} must keep a body schema`
    );
    assert.equal(
      entry.compatibility_registry_status,
      'present',
      `${entry.family} must keep a compatibility registry entry`
    );
  }
});

test('packet modernization gaps are explicitly classified as planned work', () => {
  const coverage = listPacketFamilyModernizationCoverage();

  for (const entry of coverage) {
    const statusValues = [
      entry.body_schema_status,
      entry.compatibility_registry_status,
      entry.build_pipeline_status,
      entry.manifest_definition_status,
      entry.definition_parts_status,
    ];
    const plannedGapCount = statusValues.filter(
      (status) => status === 'planned_gap'
    ).length;

    assert.equal(
      entry.planned_gaps.length,
      plannedGapCount,
      `${entry.family} should explain each packet modernization gap`
    );

    for (const gap of entry.planned_gaps) {
      assert.equal(gap.status, 'planned_gap');
      assert.ok(gap.reason.length > 0, `${entry.family} gap needs a reason`);
    }
  }
});

test('preference remains manifest-defined with complete definition parts', () => {
  const preferenceCoverage = listPacketFamilyModernizationCoverage().find(
    (entry) => entry.family === 'Preference'
  );

  assert.ok(preferenceCoverage);
  assert.equal(preferenceCoverage.manifest_definition_status, 'defined');
  assert.equal(preferenceCoverage.definition_parts_status, 'complete');
  assert.ok(preferenceCoverage.definition_part_count > 0);
});

test('generic builder families now have manifest definitions and definition parts', () => {
  const coverageByFamily = new Map(
    listPacketFamilyModernizationCoverage().map((entry) => [entry.family, entry])
  );

  for (const family of GENERIC_PACKET_BUILD_FAMILIES) {
    const entry = coverageByFamily.get(family);
    assert.ok(entry);
    assert.equal(entry.build_pipeline_status, 'supported', family);
    assert.equal(entry.manifest_definition_status, 'defined', family);
    assert.equal(entry.definition_parts_status, 'complete', family);
    assert.ok(entry.definition_part_count > 0, family);
  }
});

test('families without generic builders remain explicit planned gaps', () => {
  const coverage = listPacketFamilyModernizationCoverage();
  const genericFamilies = new Set<string>(GENERIC_PACKET_BUILD_FAMILIES);

  for (const entry of coverage) {
    if (genericFamilies.has(entry.family) || entry.family === 'Preference') {
      continue;
    }

    assert.equal(entry.build_pipeline_status, 'planned_gap', entry.family);
    assert.ok(
      entry.planned_gaps.some((gap) => gap.area === 'build_pipeline'),
      `${entry.family} should keep the builder planned gap`
    );
  }
});

test('Preference remains manifest-defined with its expected build-pipeline planned gap', () => {
  const preferenceCoverage = listPacketFamilyModernizationCoverage().find(
    (entry) => entry.family === 'Preference'
  );

  assert.ok(preferenceCoverage);
  assert.equal(preferenceCoverage.manifest_definition_status, 'defined');
  assert.equal(preferenceCoverage.definition_parts_status, 'complete');
  assert.equal(preferenceCoverage.build_pipeline_status, 'planned_gap');
  assert.ok(
    preferenceCoverage.planned_gaps.some((gap) => gap.area === 'build_pipeline')
  );
});

test('Definition and Bundle are recorded as manifest-native packet types', () => {
  const targets = listPacketNextPhaseLiveEnrollmentTargets();

  assert.deepEqual(
    targets.map((target) => target.packet_type).sort(),
    ['Bundle', 'Definition']
  );

  for (const target of targets) {
    assert.equal(target.target_status, 'manifest_native');
    assert.equal(target.currently_in_packet_families, false);
    assert.equal(target.manifest_definition_status, 'defined');
    assert.ok(target.reason.includes('should not be enrolled'));
  }
});

test('packet-type modernization coverage includes every experimental manifest definition', () => {
  const coveredPacketTypes = listPacketTypeModernizationCoverage()
    .map((entry) => entry.packet_type)
    .sort();
  const manifestPacketTypes = listExperimentalPacketTypeDefinitions()
    .map((definition) => definition.packet_type)
    .sort();

  assert.deepEqual(coveredPacketTypes, manifestPacketTypes);
});

test('manifest-native packet types have executable body-builder coverage', () => {
  const coverageByPacketType = new Map(
    listPacketTypeModernizationCoverage().map((entry) => [
      entry.packet_type,
      entry,
    ])
  );

  for (const packetType of ['Definition', 'Bundle', 'Preference']) {
    const entry = coverageByPacketType.get(packetType);
    assert.ok(entry);
    assert.equal(entry.manifest_definition_status, 'defined');
    assert.equal(entry.definition_parts_status, 'complete');
    assert.equal(entry.descriptor_builder_status, 'defined');
    assert.equal(entry.body_builder_status, 'supported');
    assert.equal(entry.shadow_mutation_plan_status, 'supported');
    assert.equal(entry.compatibility_standard_status, 'supported');
  }
});

test('packet-type modernization coverage reports compatibility standard coverage', () => {
  for (const entry of listPacketTypeModernizationCoverage()) {
    assert.equal(entry.compatibility_standard_status, 'supported', entry.packet_type);
    assert.equal(
      entry.planned_gaps.some((gap) => gap.area === 'compatibility_definition'),
      false,
      entry.packet_type
    );
  }
});
