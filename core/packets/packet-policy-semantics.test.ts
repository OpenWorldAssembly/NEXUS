import assert from 'node:assert/strict';
import test from 'node:test';

import { createActionPacket, createPolicyPacket } from '@core/packets/builders';
import {
  auditPacketDependencySemanticAuthority,
  auditPacketPolicySemanticAuthority,
  getDefinedPacketTypeDefinition,
  listDefinedPacketTypeDefinitions,
  listPacketDependencySemanticDescriptors,
  listPacketWorkflowPlanDescriptors,
  resolveInitiativePolicyAnchorRefs,
  resolvePacketDefaultPolicyRefs,
  resolvePacketDependencySemanticDescriptor,
  resolvePolicyPacketSemantics,
} from '@core/packets/packet-definition-manifest';
import { PACKET_WORKFLOW_DEPENDENCY_IDS } from '@core/packets/packet-workflow-planner.ts';

test('policy packets resolve default inheritance and governance semantics without executing governance', () => {
  const trustPolicyRef = { packet_id: 'nexus:policy/trust-baseline' };
  const templateRef = { packet_id: 'nexus:definition/template/default-discussions' };
  const policy = createPolicyPacket({
    packet_id: 'nexus:policy/owa-defaults',
    created_at: '2026-05-19T00:00:00.000Z',
    title: 'OWA defaults',
    subtype: 'default_inheritance',
    body_markdown: 'Packet-backed defaults.',
    status: 'active',
    default_policy: {
      policy_refs: [trustPolicyRef],
      template_refs: [templateRef],
      default_packet_set_refs: [],
      preference_refs: [],
    },
    governance_policy: {
      minimum_trust_stage: 'recognized',
      voter_eligibility: {
        eligible_scope_refs: [{ packet_id: 'nexus:element/global-commons' }],
        eligible_role_refs: [],
      },
      quorum_rule: {
        quorum_kind: 'none',
        minimum_count: null,
        percentage: null,
      },
      approval_threshold: {
        threshold_kind: 'simple_majority',
        percentage: null,
      },
      vote_method: 'simple_majority',
      decision_report_required: true,
    },
  });

  const semantics = resolvePolicyPacketSemantics(policy);
  const audit = auditPacketPolicySemanticAuthority({ policyPackets: [policy] });

  assert.ok(semantics.semantic_kinds.includes('default_inheritance'));
  assert.ok(semantics.semantic_kinds.includes('governance'));
  assert.ok(semantics.default_ref_ids.includes(trustPolicyRef.packet_id));
  assert.ok(semantics.default_ref_ids.includes(templateRef.packet_id));
  assert.ok(semantics.governance_hooks.includes('simple_majority'));
  assert.ok(semantics.governance_hooks.includes('decision_report_required'));
  assert.equal(audit.status, 'pass');
});

test('policy semantic audit rejects runtime-only default policy sections', () => {
  const policy = createPolicyPacket({
    packet_id: 'nexus:policy/runtime-only-defaults',
    created_at: '2026-05-19T00:10:00.000Z',
    title: 'Runtime-only defaults',
    subtype: 'default_inheritance',
    body_markdown: 'Invalid because it names no packet refs.',
    status: 'active',
    default_policy: {
      policy_refs: [],
      template_refs: [],
      default_packet_set_refs: [],
      preference_refs: [],
    },
  });

  const audit = auditPacketPolicySemanticAuthority({ policyPackets: [policy] });

  assert.equal(audit.status, 'fail');
  assert.ok(
    audit.findings.some(
      (finding) => finding.code === 'default_policy_without_packet_refs'
    )
  );
});

test('dependency semantic authority covers workflows and Definition dependency parts', () => {
  const definitions = listDefinedPacketTypeDefinitions();
  const audit = auditPacketDependencySemanticAuthority();
  const descriptors = listPacketDependencySemanticDescriptors();
  const dependencyIds = new Set(descriptors.map((descriptor) => descriptor.dependency_id));

  for (const dependencyId of PACKET_WORKFLOW_DEPENDENCY_IDS) {
    assert.ok(dependencyIds.has(dependencyId), dependencyId);
  }

  for (const definition of definitions) {
    for (const dependencyPart of definition.packet_definition_parts?.filter(
      (part) => part.part_subtype === 'packet_dependency'
    ) ?? []) {
      for (const reference of dependencyPart.references ?? []) {
        assert.ok(
          resolvePacketDependencySemanticDescriptor(reference),
          `${dependencyPart.part_id} -> ${reference}`
        );
      }
    }
  }

  assert.equal(audit.status, 'pass', JSON.stringify(audit.findings, null, 2));
  assert.ok(
    getDefinedPacketTypeDefinition('Policy')?.packet_definition_parts?.some(
      (part) =>
        part.part_subtype === 'packet_dependency' &&
        part.references?.includes('generic.operation.policy')
    )
  );
});

test('initiative policy anchors resolve through the Action initiative anchor', () => {
  const actionPolicyRef = { packet_id: 'nexus:policy/action-defaults' };
  const action = createActionPacket({
    packet_id: 'nexus:action/owa',
    created_at: '2026-05-19T00:20:00.000Z',
    subtype: 'initiative',
    title: 'OWA',
    status: 'active',
    policy_refs: [actionPolicyRef],
  });
  const defaultPolicy = createPolicyPacket({
    packet_id: 'nexus:policy/default-stack',
    created_at: '2026-05-19T00:22:00.000Z',
    title: 'Default stack',
    subtype: 'default_inheritance',
    body_markdown: 'Policy-backed default refs.',
    status: 'active',
    default_policy: {
      policy_refs: [actionPolicyRef],
      template_refs: [],
      default_packet_set_refs: [],
      preference_refs: [],
    },
  });

  assert.deepEqual(resolveInitiativePolicyAnchorRefs({ actionPacket: action }), [actionPolicyRef]);
  assert.deepEqual(
    [...new Set(resolvePacketDefaultPolicyRefs({
      actionPacket: action,
      policyPackets: [defaultPolicy],
    }).map((ref) => ref.packet_id))],
    [actionPolicyRef.packet_id]
  );
});

test('unknown dependency semantics fail closed', () => {
  assert.equal(resolvePacketDependencySemanticDescriptor('runtime.mystery'), null);
  assert.equal(listPacketWorkflowPlanDescriptors().length > 0, true);
});
