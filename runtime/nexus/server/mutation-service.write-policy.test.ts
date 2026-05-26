import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getMutationIntentDescriptor,
  listMutationIntentDescriptors,
} from './mutation-intent-registry.ts';
import {
  createMutationFinalizeHandlerMap,
  createMutationPrepareHandlerMap,
} from './fortress-handler-domains.ts';
import type { MutationPrepareHandlers } from './mutation-prepare-handlers.ts';
import type { MutationFinalizeHandlers } from './mutation-finalize-handlers.ts';

test('actor write-policy preparation resolves current policy before building the future policy', () => {
  const mutationSource = readFileSync(
    join(process.cwd(), 'runtime', 'trusted_coordinators', 'trusted_composite_workflow_coordinator.ts'),
    'utf8'
  );
  const policyGateSource = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-policy-gate.ts'),
    'utf8'
  );
  const prepareActorWritePolicyUpdateIndex = mutationSource.indexOf(
    'resolveTrustedActorPolicyCompositePlan'
  );
  const policyGateCallIndex = mutationSource.indexOf(
    'await input.policyGate.resolveActorWritePolicyUpdate',
    prepareActorWritePolicyUpdateIndex
  );
  const nextWritePolicyIndex = mutationSource.indexOf(
    'const nextWritePolicy = createWritePolicyForSecurityMode'
  );
  const currentPolicyDecisionIndex = policyGateSource.indexOf(
    'const currentPolicyDecision = existingWritePolicyPacket'
  );
  const currentSecurityModeDecisionIndex = policyGateSource.indexOf(
    'securityMode: currentSecurityMode',
    currentPolicyDecisionIndex
  );
  const bootstrapDecisionIndex = policyGateSource.indexOf(
    'buildBootstrapWritePolicyDecision',
    currentPolicyDecisionIndex
  );

  assert.notEqual(prepareActorWritePolicyUpdateIndex, -1);
  assert.notEqual(policyGateCallIndex, -1);
  assert.notEqual(nextWritePolicyIndex, -1);
  assert.notEqual(currentPolicyDecisionIndex, -1);
  assert.notEqual(currentSecurityModeDecisionIndex, -1);
  assert.notEqual(bootstrapDecisionIndex, -1);
  assert.ok(policyGateCallIndex > prepareActorWritePolicyUpdateIndex);
  assert.ok(policyGateCallIndex < nextWritePolicyIndex);
  assert.ok(currentSecurityModeDecisionIndex > currentPolicyDecisionIndex);
  assert.ok(bootstrapDecisionIndex > currentPolicyDecisionIndex);
});

test('retired legacy home-locality mutation intent has no live prepare alias', () => {
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'fortress-prepare-handler-implementation.ts'),
    'utf8'
  );
  const registryKinds = listMutationIntentDescriptors().map(
    (descriptor) => descriptor.kind
  );

  assert.equal(source.includes('prepareHomeLocalityClaimCompatibilityAlias'), false);
  assert.equal(registryKinds.includes('residence.claim.set' as never), false);
  assert.equal(
    getMutationIntentDescriptor('relation.residence.add').finalize,
    'finalizeHomeLocalityRelation'
  );
});

test('retired association-claim mutation intent has no live prepare alias', () => {
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'fortress-prepare-handler-implementation.ts'),
    'utf8'
  );
  const registryKinds = listMutationIntentDescriptors().map(
    (descriptor) => descriptor.kind
  );

  assert.equal(source.includes('prepareAssociationClaimCompatibilityAlias'), false);
  assert.equal(registryKinds.includes('association.claim.set' as never), false);
  assert.equal(
    getMutationIntentDescriptor('relation.association.add').finalize,
    'finalizeAssociationRelationUpdate'
  );
});

test('Preference no-op finalize keeps the standard wrapped result shape', () => {
  const source = readFileSync(
    join(
      process.cwd(),
      'runtime',
      'nexus',
      'server',
      'fortress-finalize-handler-implementation.ts'
    ),
    'utf8'
  );
  const noOpBranchIndex = source.indexOf(
    'if (preparedResult.wrote_revision === false)'
  );
  const signedWriteBranchIndex = source.indexOf(
    "throw new Error('Preference finalize requires signed packet candidates.')",
    noOpBranchIndex
  );
  const wrappedNoOpResultIndex = source.indexOf(
    'result: toPreferenceElementFortressResult(preparedResult.plan)',
    noOpBranchIndex
  );
  const emptyPersistEffectsIndex = source.indexOf('persist_effects: []', noOpBranchIndex);

  assert.notEqual(noOpBranchIndex, -1);
  assert.notEqual(signedWriteBranchIndex, -1);
  assert.notEqual(wrappedNoOpResultIndex, -1);
  assert.notEqual(emptyPersistEffectsIndex, -1);
  assert.ok(emptyPersistEffectsIndex < signedWriteBranchIndex);
  assert.ok(wrappedNoOpResultIndex < signedWriteBranchIndex);
});


test('registered mutation intent handlers resolve to concrete prepare and finalize implementations', () => {
  const prepareMap = createMutationPrepareHandlerMap(
    new Proxy(
      {},
      {
        get: () => async () => ({}),
      }
    ) as MutationPrepareHandlers
  );
  const finalizeMap = createMutationFinalizeHandlerMap(
    new Proxy(
      {},
      {
        get: () => async () => ({ persist_effects: [], result: null }),
      }
    ) as MutationFinalizeHandlers
  );

  for (const descriptor of listMutationIntentDescriptors()) {
    assert.equal(typeof prepareMap[descriptor.prepare], 'function');
    assert.equal(typeof finalizeMap[descriptor.finalize], 'function');
  }
});
