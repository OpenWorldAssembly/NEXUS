import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

test('actor write-policy preparation is wired to current policy before future policy', () => {
  const source = readFileSync(
    join(process.cwd(), 'runtime', 'nexus', 'server', 'mutation-service.ts'),
    'utf8'
  );
  const prepareActorWritePolicyUpdateIndex = source.indexOf(
    'private async prepareActorWritePolicyUpdate'
  );
  const nextWritePolicyIndex = source.indexOf(
    'const nextWritePolicy = createWritePolicyForSecurityMode'
  );
  const currentPolicyDecisionIndex = source.indexOf(
    'const currentPolicyDecision = existingWritePolicyPacket'
  );
  const currentSecurityModeDecisionIndex = source.indexOf(
    'securityMode: currentSecurityMode',
    currentPolicyDecisionIndex
  );
  const bootstrapDecisionIndex = source.indexOf(
    'buildBootstrapWritePolicyDecision',
    currentPolicyDecisionIndex
  );

  assert.notEqual(prepareActorWritePolicyUpdateIndex, -1);
  assert.notEqual(nextWritePolicyIndex, -1);
  assert.notEqual(currentPolicyDecisionIndex, -1);
  assert.notEqual(currentSecurityModeDecisionIndex, -1);
  assert.notEqual(bootstrapDecisionIndex, -1);
  assert.ok(currentPolicyDecisionIndex > prepareActorWritePolicyUpdateIndex);
  assert.ok(currentPolicyDecisionIndex < nextWritePolicyIndex);
  assert.ok(currentSecurityModeDecisionIndex < nextWritePolicyIndex);
  assert.ok(bootstrapDecisionIndex < nextWritePolicyIndex);
});
