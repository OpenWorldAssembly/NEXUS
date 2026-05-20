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
    join(process.cwd(), 'runtime', 'nexus', 'server', 'trusted-composite-workflow-runtime.ts'),
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
  assert.equal(registryKinds.includes('home_locality.claim.set' as never), false);
  assert.equal(
    getMutationIntentDescriptor('home_locality.relation.set').finalize,
    'finalizeHomeLocalityRelation'
  );
});

test('retired legacy assembly-association mutation intent has no live prepare alias', () => {
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'fortress-prepare-handler-implementation.ts'),
    'utf8'
  );
  const registryKinds = listMutationIntentDescriptors().map(
    (descriptor) => descriptor.kind
  );

  assert.equal(source.includes('prepareAssemblyAssociationClaimCompatibilityAlias'), false);
  assert.equal(registryKinds.includes('assembly_association.claim.set' as never), false);
  assert.equal(
    getMutationIntentDescriptor('assembly_association.relation.set').finalize,
    'finalizeAssociationRelationUpdate'
  );
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
