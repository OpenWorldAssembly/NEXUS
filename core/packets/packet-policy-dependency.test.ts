import assert from 'node:assert/strict';
import test from 'node:test';

import {
  auditPacketPolicyDependencyCoverage,
  listPacketDependencyRequirementDescriptors,
  listPacketPolicyRequirementDescriptors,
  listPacketWorkflowPlanDescriptors,
} from '@core/packets/packet-definition-manifest';
import { MUTATION_ACTION_IDS } from '@core/auth/write-policy';

test('packet policy and dependency coverage audits cleanly', () => {
  const report = auditPacketPolicyDependencyCoverage();

  assert.equal(report.status, 'pass');
  assert.deepEqual(report.findings, []);
  assert.ok(report.checked_workflow_plan_ids.length > 0);
});

test('definition workflow plans have packet-backed policy and dependency references', () => {
  const policyIds = new Set(
    listPacketPolicyRequirementDescriptors().map(
      (descriptor) => descriptor.policy_action_id
    )
  );
  const dependencyIds = new Set(
    listPacketDependencyRequirementDescriptors().map(
      (descriptor) => descriptor.dependency_id
    )
  );

  for (const workflowPlan of listPacketWorkflowPlanDescriptors()) {
    assert.ok(workflowPlan.policy_action_ids.length > 0, workflowPlan.workflow_plan_id);
    assert.ok(workflowPlan.dependency_ids.length > 0, workflowPlan.workflow_plan_id);

    for (const policyActionId of workflowPlan.policy_action_ids) {
      assert.ok(policyIds.has(policyActionId), policyActionId);
    }

    for (const dependencyId of workflowPlan.dependency_ids) {
      assert.ok(dependencyIds.has(dependencyId), dependencyId);
    }
  }
});

test('live policy requirement descriptors align with write-policy action ids', () => {
  const policyDescriptors = listPacketPolicyRequirementDescriptors();
  const liveActionIds = new Set<string>(MUTATION_ACTION_IDS);

  for (const descriptor of policyDescriptors) {
    if (!descriptor.live_write_policy_action) {
      continue;
    }

    assert.ok(liveActionIds.has(descriptor.policy_action_id));
    assert.equal(descriptor.semantic_anchor, 'policy_packet.write_lock');
  }
});

test('runtime dependency metadata is explicitly trusted when not packet-part backed', () => {
  for (const descriptor of listPacketDependencyRequirementDescriptors()) {
    if (
      descriptor.anchor_kind === 'packet_definition_part' ||
      descriptor.anchor_kind === 'policy_packet_semantics'
    ) {
      assert.ok(
        descriptor.packet_definition_part_ids.length > 0,
        descriptor.dependency_id
      );
      continue;
    }

    assert.equal(descriptor.runtime_metadata_only, true, descriptor.dependency_id);
  }
});
