import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import {
  getMutationIntentDescriptor,
  listMutationIntentDescriptors,
} from './mutation-intent-registry.ts';

test('actor write-policy preparation resolves current policy before building the future policy', () => {
  const mutationSource = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-prepare-handlers.ts'),
    'utf8'
  );
  const policyGateSource = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-policy-gate.ts'),
    'utf8'
  );
  const prepareActorWritePolicyUpdateIndex = mutationSource.indexOf(
    'private async prepareActorWritePolicyUpdate'
  );
  const policyGateCallIndex = mutationSource.indexOf(
    'await this.policyGate.resolveActorWritePolicyUpdate',
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
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-prepare-handlers.ts'),
    'utf8'
  );
  const aliasMethodIndex = source.indexOf(
    'private async prepareHomeLocalityClaimCompatibilityAlias'
  );
  const canonicalMethodIndex = source.indexOf(
    'private async prepareHomeLocalityRelation'
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
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-prepare-handlers.ts'),
    'utf8'
  );
  const aliasMethodIndex = source.indexOf(
    'private async prepareAssemblyAssociationClaimCompatibilityAlias'
  );
  const canonicalMethodIndex = source.indexOf(
    'private async prepareAssemblyAssociationRelation'
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
  const prepareSource = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-prepare-handlers.ts'),
    'utf8'
  );
  const finalizerSource = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-finalize-handlers.ts'),
    'utf8'
  );

  for (const descriptor of listMutationIntentDescriptors()) {
    assert.notEqual(
      prepareSource.indexOf(`${descriptor.prepare}: async`),
      -1,
      `${descriptor.kind} prepare handler ${descriptor.prepare} is not wired`
    );
    assert.notEqual(
      finalizerSource.indexOf(`async ${descriptor.finalize}`),
      -1,
      `${descriptor.kind} finalize handler ${descriptor.finalize} is not implemented`
    );
  }
});
