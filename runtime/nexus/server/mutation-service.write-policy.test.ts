import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('actor write-policy preparation resolves current policy before building the future policy', () => {
  const mutationSource = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-service.ts'),
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
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-service.ts'),
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
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-service.ts'),
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
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-service.ts'),
    'utf8'
  );
  const finalizeSwitchIndex = source.indexOf("case 'home_locality.relation.set':");
  const compatibilityCaseIndex = source.indexOf("case 'home_locality.claim.set':");
  const finalizeCallIndex = source.indexOf(
    'await this.finalizeHomeLocalityRelation({',
    finalizeSwitchIndex
  );

  assert.notEqual(finalizeSwitchIndex, -1);
  assert.notEqual(compatibilityCaseIndex, -1);
  assert.notEqual(finalizeCallIndex, -1);
  assert.ok(finalizeSwitchIndex < compatibilityCaseIndex);
  assert.ok(compatibilityCaseIndex < finalizeCallIndex);
});
