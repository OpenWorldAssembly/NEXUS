import assert from 'node:assert/strict';
import test from 'node:test';

import { GENERIC_PACKET_BUILD_TYPES } from '@core/packets/packet-build-pipeline';
import {
  auditPacketDefinitionOperations,
  getDefinedPacketTypeDefinition,
  getPacketOperationDefinition,
  listDefinedPacketTypeDefinitions,
  listPacketOperationDefinitions,
  listPacketOperationModernizationCoverage,
  listTrustedPacketOperationCapabilities,
} from '@core/packets/packet-definition-manifest';
import type { PacketOperationKind } from '@core/packets/packet-operation-ontology.ts';

test('packet operation ontology exposes unique stable operation kinds', () => {
  const operations = listPacketOperationDefinitions();
  const operationKinds = operations.map((operation) => operation.operation_kind);

  assert.equal(new Set(operationKinds).size, operationKinds.length);
  assert.ok(operationKinds.includes('single_packet.create'));
  assert.ok(operationKinds.includes('workflow.compose'));
  assert.equal(getPacketOperationDefinition('unknown.operation'), null);

  for (const operation of operations) {
    assert.ok(operation.label.length > 0, operation.operation_kind);
    assert.ok(operation.description.length > 0, operation.operation_kind);
    assert.ok(operation.trusted_runtime_engine.length > 0, operation.operation_kind);
    assert.ok(operation.safety_notes.length > 0, operation.operation_kind);
    assert.ok(operation.result_types.length > 0, operation.operation_kind);
  }
});

test('operation ontology is backed by trusted local capability records', () => {
  const capabilities = listTrustedPacketOperationCapabilities();
  const capabilityEngines = new Set(
    capabilities.map((capability) => capability.engine_id)
  );

  for (const operation of listPacketOperationDefinitions()) {
    assert.ok(
      capabilityEngines.has(operation.trusted_runtime_engine),
      operation.operation_kind
    );
  }
});

test('every manifest mutation maps to known packet operations', () => {
  for (const definition of listDefinedPacketTypeDefinitions()) {
    const report = auditPacketDefinitionOperations(definition);

    assert.equal(report.status, 'pass', definition.packet_type);
    assert.ok(report.checked_mutations.length > 0, definition.packet_type);
    assert.deepEqual(report.findings, [], definition.packet_type);
    for (const mutation of report.checked_mutations) {
      assert.equal(mutation.operation_status, 'mapped', mutation.mutation_intent);
      assert.ok(mutation.operation_kinds.length > 0, mutation.mutation_intent);
    }
  }
});

test('generic type writes map to single-packet create and revise operations', () => {
  for (const type of GENERIC_PACKET_BUILD_TYPES) {
    if (['Definition', 'Bundle', 'Preference'].includes(type)) {
      continue;
    }

    const definition = getDefinedPacketTypeDefinition(type);
    assert.ok(definition);

    const report = auditPacketDefinitionOperations(definition);
    const genericWrite = report.checked_mutations.find((mutation) =>
      mutation.mutation_intent.endsWith('.generic.write')
    );
    assert.ok(genericWrite, type);
    assert.deepEqual([...genericWrite.operation_kinds].sort(), [
      'single_packet.create',
      'single_packet.revise',
    ]);
  }
});

test('canonical Definition, Bundle, and Preference map to operation descriptors', () => {
  const expectedOperations = new Map([
    ['Definition', ['single_packet.create', 'single_packet.revise']],
    ['Preference', ['single_packet.create', 'single_packet.revise', 'single_packet.withdraw']],
    ['Bundle', ['bundle.export', 'bundle.import']],
  ]);

  for (const [packetType, operationKinds] of expectedOperations) {
    const coverage = listPacketOperationModernizationCoverage().filter(
      (entry) => entry.packet_type === packetType
    );
    assert.ok(coverage.length > 0, packetType);

    const actualOperations = new Set<string>(
      coverage.flatMap((entry) => entry.operation_kinds)
    );
    for (const operationKind of operationKinds as PacketOperationKind[]) {
      assert.ok(actualOperations.has(operationKind), `${packetType} ${operationKind}`);
    }
  }
});

test('unknown manifest operation references fail closed', () => {
  const definition = getDefinedPacketTypeDefinition('Preference');
  assert.ok(definition);

  const brokenDefinition = {
    ...definition,
    mutations: [
      {
        ...definition.mutations[0],
        action_ids: ['preference.element.missing'],
      },
    ],
  };

  const report = auditPacketDefinitionOperations(brokenDefinition);

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'packet_operation_unmapped_mutation'
    )
  );
});
