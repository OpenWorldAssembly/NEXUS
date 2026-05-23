import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  resolvePacketDefinitionMutationActionPlan,
  auditPacketDefinitionManifest,
  auditPacketTypeDefinition,
  getDefinedPacketTypeDefinition,
  listDefinedPacketTypeDefinitions,
  PACKET_DEFINITION_MANIFEST,
} from '@core/packets/packet-definition-manifest';
import { GENERIC_PACKET_BUILD_TYPES } from '@core/packets/packet-build-pipeline';

const EXPECTED_MANIFEST_PACKET_TYPES = [
  ...GENERIC_PACKET_BUILD_TYPES,
].sort();

test('audits Preference packet definition descriptor graph cleanly', () => {
  const preferenceDefinition = getDefinedPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const report = auditPacketTypeDefinition({
    definition: preferenceDefinition,
    requireDefinitionRuntimeReady: true,
  });

  assert.equal(report.status, 'pass');
  assert.equal(report.finding_counts.error, 0);
  assert.deepEqual(report.checked_packet_types, ['Preference']);
});

test('audits the active packet definition manifest', () => {
  const report = auditPacketDefinitionManifest({
    manifest: PACKET_DEFINITION_MANIFEST,
    definitions: listDefinedPacketTypeDefinitions(),
    requireDefinitionRuntimeReady: false,
  });

  assert.equal(report.finding_counts.error, 0);
  assert.deepEqual(report.checked_packet_types.sort(), EXPECTED_MANIFEST_PACKET_TYPES);
});

test('every registered definition audits without errors', () => {
  for (const definition of listDefinedPacketTypeDefinitions()) {
    const report = auditPacketTypeDefinition({
      definition,
      requireDefinitionRuntimeReady: false,
    });

    assert.equal(report.finding_counts.error, 0, definition.packet_type);
  }
});

test('compatibility standard accepts full-chain adapter graphs', () => {
  for (const packetType of ['Element', 'Claim', 'Policy']) {
    const definition = getDefinedPacketTypeDefinition(packetType);
    assert.ok(definition);

    const report = auditPacketTypeDefinition({
      definition,
      requireDefinitionRuntimeReady: false,
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
  const definition = getDefinedPacketTypeDefinition('Element');
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
    requireDefinitionRuntimeReady: false,
  });

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'compatibility_downcast_adapter_without_posture'
    )
  );
});

test('generic type mutation descriptors are runtime resolvable', () => {
  for (const type of GENERIC_PACKET_BUILD_TYPES) {
    const definition = getDefinedPacketTypeDefinition(type);
    assert.ok(definition);

    for (const mutation of definition.mutations) {
      const plan = resolvePacketDefinitionMutationActionPlan({
        definition,
        mutation_intent: mutation.mutation_intent,
      });

      assert.equal(plan.ready_for_runtime, true, mutation.mutation_intent);
      assert.equal(plan.missing_descriptor_ids.length, 0);
      assert.equal(plan.unsupported_capabilities.length, 0);
    }
  }
});

test('canonical Definition, Bundle, and Preference packet types audit cleanly', () => {
  for (const packetType of ['Definition', 'Bundle', 'Preference']) {
    const definition = getDefinedPacketTypeDefinition(packetType);
    assert.ok(definition);

    const auditReport = auditPacketTypeDefinition({
      definition,
      requireDefinitionRuntimeReady: true,
    });
    assert.equal(auditReport.finding_counts.error, 0, packetType);

    for (const mutation of definition.mutations) {
      const plan = resolvePacketDefinitionMutationActionPlan({
        definition,
        mutation_intent: mutation.mutation_intent,
      });

      assert.equal(plan.ready_for_runtime, true, mutation.mutation_intent);
    }
  }
});

test('Definition no longer carries unsupported core manifest sections', () => {
  const definition = getDefinedPacketTypeDefinition('Definition');
  assert.ok(definition);

  assert.notEqual(definition.section_statuses?.builders, 'unsupported');
  assert.notEqual(definition.section_statuses?.indexing, 'unsupported');
  assert.notEqual(definition.section_statuses?.compatibility, 'unsupported');
});

test('reports missing builder references as audit errors', () => {
  const preferenceDefinition = getDefinedPacketTypeDefinition('Preference');
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
    requireDefinitionRuntimeReady: true,
  });

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_planner_builder_reference'
    )
  );
});
