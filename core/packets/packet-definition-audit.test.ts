import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolvePacketDefinitionMutationActionPlan,
  auditPacketDefinitionManifest,
  auditPacketTypeDefinition,
  getExperimentalPacketTypeDefinition,
  listExperimentalPacketTypeDefinitions,
  PACKET_DEFINITION_MANIFEST,
} from '@core/packets/packet-definition-manifest';
import { GENERIC_PACKET_BUILD_FAMILIES } from '@core/packets/packet-build-pipeline';

const EXPECTED_MANIFEST_PACKET_TYPES = [
  'Definition',
  ...GENERIC_PACKET_BUILD_FAMILIES,
  'Preference',
  'Bundle',
].sort();

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
  assert.deepEqual(report.checked_packet_types.sort(), EXPECTED_MANIFEST_PACKET_TYPES);
});

test('every registered definition audits without errors', () => {
  for (const definition of listExperimentalPacketTypeDefinitions()) {
    const report = auditPacketTypeDefinition({
      definition,
      requireShadowRuntimeReady: false,
    });

    assert.equal(report.finding_counts.error, 0, definition.packet_type);
  }
});

test('compatibility standard accepts full-chain adapter graphs', () => {
  for (const packetType of ['Element', 'Claim', 'Policy']) {
    const definition = getExperimentalPacketTypeDefinition(packetType);
    assert.ok(definition);

    const report = auditPacketTypeDefinition({
      definition,
      requireShadowRuntimeReady: false,
    });

    assert.equal(definition.compatibility.strategy, 'full_chain_bundle', packetType);
    assert.equal(report.finding_counts.error, 0, packetType);
    assert.equal(
      report.findings.some(
        (finding) => finding.code === 'compatibility_adapter_not_current_neighbor'
      ),
      false,
      packetType
    );
  }
});

test('compatibility audit fails when posture is not backed by descriptors', () => {
  const definition = getExperimentalPacketTypeDefinition('Element');
  assert.ok(definition);

  const brokenDefinition = {
    ...definition,
    compatibility: {
      ...definition.compatibility,
      supports_downcast: false,
    },
  };

  const report = auditPacketTypeDefinition({
    definition: brokenDefinition,
    requireShadowRuntimeReady: false,
  });

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'compatibility_downcast_adapter_without_posture'
    )
  );
});

test('generic family mutation descriptors are shadow-runtime resolvable', () => {
  for (const family of GENERIC_PACKET_BUILD_FAMILIES) {
    const definition = getExperimentalPacketTypeDefinition(family);
    assert.ok(definition);

    for (const mutation of definition.mutations) {
      const plan = resolvePacketDefinitionMutationActionPlan({
        definition,
        mutation_intent: mutation.mutation_intent,
      });

      assert.equal(plan.ready_for_shadow_runtime, true, mutation.mutation_intent);
      assert.equal(plan.missing_descriptor_ids.length, 0);
      assert.equal(plan.unsupported_capabilities.length, 0);
    }
  }
});

test('manifest-native packet types audit and plan as first-class packet types', () => {
  for (const packetType of ['Definition', 'Bundle', 'Preference']) {
    const definition = getExperimentalPacketTypeDefinition(packetType);
    assert.ok(definition);

    const auditReport = auditPacketTypeDefinition({
      definition,
      requireShadowRuntimeReady: true,
    });
    assert.equal(auditReport.finding_counts.error, 0, packetType);

    for (const mutation of definition.mutations) {
      const plan = resolvePacketDefinitionMutationActionPlan({
        definition,
        mutation_intent: mutation.mutation_intent,
      });

      assert.equal(plan.ready_for_shadow_runtime, true, mutation.mutation_intent);
    }
  }
});

test('Definition no longer carries deferred core manifest sections', () => {
  const definition = getExperimentalPacketTypeDefinition('Definition');
  assert.ok(definition);

  assert.notEqual(definition.section_statuses?.builders, 'deferred');
  assert.notEqual(definition.section_statuses?.indexing, 'deferred');
  assert.notEqual(definition.section_statuses?.compatibility, 'deferred');
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
