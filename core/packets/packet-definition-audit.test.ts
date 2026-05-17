import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  auditPacketDefinitionManifest,
  auditPacketTypeDefinition,
  getExperimentalPacketTypeDefinition,
  listExperimentalPacketTypeDefinitions,
  PACKET_DEFINITION_MANIFEST,
} from '@core/packets/packet-definition-manifest';

test('audits Preference packet definition descriptor graph cleanly', () => {
  const preferenceDefinition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const report = auditPacketTypeDefinition({
    definition: preferenceDefinition,
    requireShadowRuntimeReady: true,
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.finding_counts.error, 0);
  assert.deepEqual(report.checked_packet_types, ['Preference']);
});

test('audits the experimental packet definition manifest', () => {
  const report = auditPacketDefinitionManifest({
    manifest: PACKET_DEFINITION_MANIFEST,
    definitions: listExperimentalPacketTypeDefinitions(),
    requireShadowRuntimeReady: false,
  });

  assert.equal(report.finding_counts.error, 0);
  assert.deepEqual(report.checked_packet_types.sort(), ['Bundle', 'Compatibility', 'Preference']);
});

test('reports missing builder references as audit errors', () => {
  const preferenceDefinition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const brokenDefinition = {
    ...preferenceDefinition,
    planners: [
      {
        ...preferenceDefinition.planners[0],
        builder_ids: ['missing.builder'],
      },
      ...preferenceDefinition.planners.slice(1),
    ],
  };

  const report = auditPacketTypeDefinition({
    definition: brokenDefinition,
    requireShadowRuntimeReady: true,
  });

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_planner_builder_reference'
    )
  );
});
