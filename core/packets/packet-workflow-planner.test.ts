import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditPacketTypeDefinition,
  auditPacketWorkflowPlanDescriptor,
  getExperimentalPacketTypeDefinition,
  getPacketWorkflowPlanDescriptor,
  listExperimentalPacketTypeDefinitions,
  listPacketWorkflowPlanDescriptors,
  listPacketWorkflowPlannerCapabilities,
  resolvePacketWorkflowDryRunPlan,
  type PacketWorkflowPlanDescriptor,
} from '@core/packets/packet-definition-manifest';

const GENERIC_READY_WORKFLOW_PLAN_IDS = [
  'relation.follows.set.workflow.v0',
  'relation.follows.clear.workflow.v0',
  'claim.role_association.set.workflow.v0',
  'attestation.packet_signal.set.workflow.v0',
] as const;

function getWorkflowFixture(packetType: string, workflowPlanId: string) {
  const definition = getExperimentalPacketTypeDefinition(packetType);
  assert.ok(definition);

  const workflowPlan = getPacketWorkflowPlanDescriptor(packetType, workflowPlanId);
  assert.ok(workflowPlan);

  return { definition, workflowPlan };
}

test('workflow planner capabilities expose trusted resolver allowlist', () => {
  const resolverIds = listPacketWorkflowPlannerCapabilities().map(
    (capability) => capability.resolver_id
  );

  assert.ok(resolverIds.includes('actor.ref'));
  assert.ok(resolverIds.includes('input.packet_ref'));
  assert.ok(resolverIds.includes('relation.active_lookup'));
  assert.ok(resolverIds.includes('attestation.target_summary'));
});

test('generic-ready workflow plans audit cleanly', () => {
  for (const workflowPlanId of GENERIC_READY_WORKFLOW_PLAN_IDS) {
    const workflowPlan = listPacketWorkflowPlanDescriptors().find(
      (candidate) => candidate.workflow_plan_id === workflowPlanId
    );
    assert.ok(workflowPlan, workflowPlanId);

    const definition = getExperimentalPacketTypeDefinition(workflowPlan.packet_type);
    assert.ok(definition);

    const report = auditPacketWorkflowPlanDescriptor(definition, workflowPlan);
    assert.equal(report.status, 'pass', workflowPlanId);
    assert.deepEqual(report.findings, [], workflowPlanId);
    assert.ok(report.checked_step_ids.length > 0, workflowPlanId);
  }
});

test('workflow dry-run interpretation preserves order and metadata', () => {
  const { definition } = getWorkflowFixture(
    'Attestation',
    'attestation.packet_signal.set.workflow.v0'
  );

  const dryRun = resolvePacketWorkflowDryRunPlan({
    definition,
    workflowPlanId: 'attestation.packet_signal.set.workflow.v0',
  });

  assert.equal(dryRun.ready_for_shadow_interpretation, true);
  assert.deepEqual(dryRun.step_order, [
    'choose_packet_signal_mode',
    'set_packet_signal_attestation',
    'clear_packet_signal_attestation',
  ]);
  assert.ok(dryRun.operation_kinds.includes('attestation.set'));
  assert.ok(dryRun.operation_kinds.includes('attestation.clear'));
  assert.ok(dryRun.policy_action_ids.includes('attestation.packet_signal.set'));
  assert.ok(dryRun.policy_action_ids.includes('attestation.packet_signal.clear'));
  assert.ok(dryRun.dependency_ids.includes('generic.operation.attestation'));
  assert.ok(dryRun.resolver_ids.includes('attestation.target_summary'));
});

test('workflow audit fails closed for unknown operation kinds', () => {
  const { definition, workflowPlan } = getWorkflowFixture(
    'Relation',
    'relation.follows.set.workflow.v0'
  );
  const brokenWorkflow = {
    ...workflowPlan,
    steps: [
      {
        ...workflowPlan.steps[0],
        operation_kind: 'relation.teleport',
      },
    ],
  } as PacketWorkflowPlanDescriptor;

  const report = auditPacketWorkflowPlanDescriptor(definition, brokenWorkflow);

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_workflow_operation_kind'
    )
  );
});

test('workflow audit fails closed for unknown resolver and dependency ids', () => {
  const { definition, workflowPlan } = getWorkflowFixture(
    'Relation',
    'relation.follows.set.workflow.v0'
  );
  const brokenWorkflow = {
    ...workflowPlan,
    resolver_ids: ['actor.ref', 'resolver.nope'],
    dependency_ids: ['runtime.packet_store.read', 'dependency.nope'],
    steps: [
      {
        ...workflowPlan.steps[0],
        resolver_ids: ['actor.ref', 'resolver.nope'],
        dependency_ids: ['runtime.packet_store.read', 'dependency.nope'],
      },
    ],
  } as PacketWorkflowPlanDescriptor;

  const report = auditPacketWorkflowPlanDescriptor(definition, brokenWorkflow);

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_workflow_resolver_id'
    )
  );
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_workflow_dependency_id'
    )
  );
});

test('workflow audit fails closed for unknown policy action ids', () => {
  const { definition, workflowPlan } = getWorkflowFixture(
    'Relation',
    'relation.follows.set.workflow.v0'
  );
  const brokenWorkflow = {
    ...workflowPlan,
    policy_action_ids: ['follows.relation.set'],
    steps: [
      {
        ...workflowPlan.steps[0],
        policy_action_ids: ['follows.relation.teleport'],
      },
    ],
  } as PacketWorkflowPlanDescriptor;

  const report = auditPacketWorkflowPlanDescriptor(definition, brokenWorkflow);

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_workflow_policy_action_id'
    )
  );
});

test('workflow audit fails closed for invalid step references', () => {
  const { definition, workflowPlan } = getWorkflowFixture(
    'Relation',
    'relation.follows.set.workflow.v0'
  );
  const brokenWorkflow = {
    ...workflowPlan,
    steps: [
      {
        ...workflowPlan.steps[0],
        input_bindings: {
          subject_ref: {
            binding_kind: 'step_output',
            step_id: 'missing_step',
            output_key: 'packet',
            required: true,
          },
        },
      },
    ],
  } as PacketWorkflowPlanDescriptor;

  const report = auditPacketWorkflowPlanDescriptor(definition, brokenWorkflow);

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_workflow_step_output_reference'
    )
  );
});

test('workflow audit fails closed for unsupported condition operators', () => {
  const { definition, workflowPlan } = getWorkflowFixture(
    'Claim',
    'claim.role_association.set.workflow.v0'
  );
  const conditionStep = workflowPlan.steps[0];
  assert.equal(conditionStep.step_kind, 'condition');

  const brokenWorkflow = {
    ...workflowPlan,
    steps: [
      {
        ...conditionStep,
        condition: {
          ...conditionStep.condition,
          condition_kind: 'regex',
        },
      },
    ],
  } as PacketWorkflowPlanDescriptor;

  const report = auditPacketWorkflowPlanDescriptor(definition, brokenWorkflow);

  assert.equal(report.status, 'fail');
  assert.ok(
    report.findings.some(
      (finding) => finding.code === 'unknown_workflow_condition_kind'
    )
  );
});

test('definition audit accepts workflow references for manifest definitions', () => {
  for (const definition of listExperimentalPacketTypeDefinitions()) {
    const report = auditPacketTypeDefinition({
      definition,
      requireShadowRuntimeReady: false,
    });

    assert.equal(report.finding_counts.error, 0, definition.packet_type);
  }
});
