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

test('legacy home-locality mutation intent delegates into the canonical relation-first prepare path', () => {
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'fortress-prepare-handler-implementation.ts'),
    'utf8'
  );
  const aliasMethodIndex = source.indexOf(
    'async prepareHomeLocalityClaimCompatibilityAlias'
  );
  const canonicalMethodIndex = source.indexOf(
    'async prepareHomeLocalityRelation'
  );
  const canonicalPrepareCallIndex = source.indexOf(
    'await this.prepareHomeLocalityRelation({',
    aliasMethodIndex
  );
  const canonicalKindIndex = source.indexOf(
    "kind: 'home_locality.relation.set'",
    canonicalPrepareCallIndex
  );

  assert.notEqual(canonicalMethodIndex, -1);
  assert.notEqual(aliasMethodIndex, -1);
  assert.notEqual(canonicalPrepareCallIndex, -1);
  assert.notEqual(canonicalKindIndex, -1);
  assert.ok(canonicalMethodIndex < aliasMethodIndex);
  assert.ok(aliasMethodIndex < canonicalPrepareCallIndex);
  assert.ok(canonicalPrepareCallIndex < canonicalKindIndex);
});

test('legacy assembly-association mutation intent delegates into the canonical relation-first prepare path', () => {
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'fortress-prepare-handler-implementation.ts'),
    'utf8'
  );
  const aliasMethodIndex = source.indexOf(
    'async prepareAssemblyAssociationClaimCompatibilityAlias'
  );
  const canonicalMethodIndex = source.indexOf(
    'async prepareAssemblyAssociationRelation'
  );
  const canonicalPrepareCallIndex = source.indexOf(
    'await this.prepareAssemblyAssociationRelation({',
    aliasMethodIndex
  );
  const canonicalSetKindIndex = source.indexOf(
    "kind: 'assembly_association.relation.set'",
    canonicalPrepareCallIndex
  );
  const canonicalClearKindIndex = source.indexOf(
    "kind: 'assembly_association.relation.clear'",
    canonicalPrepareCallIndex
  );

  assert.notEqual(canonicalMethodIndex, -1);
  assert.notEqual(aliasMethodIndex, -1);
  assert.notEqual(canonicalPrepareCallIndex, -1);
  assert.notEqual(canonicalSetKindIndex, -1);
  assert.notEqual(canonicalClearKindIndex, -1);
  assert.ok(canonicalMethodIndex < aliasMethodIndex);
  assert.ok(aliasMethodIndex < canonicalPrepareCallIndex);
});

test('home-locality finalization still accepts both canonical and compatibility tickets through one result path', () => {
  assert.equal(
    getMutationIntentDescriptor('home_locality.relation.set').finalize,
    'finalizeHomeLocalityRelation'
  );
  assert.equal(
    getMutationIntentDescriptor('home_locality.claim.set').finalize,
    'finalizeHomeLocalityRelation'
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
