import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createEmptyNexusShellGateSession,
  dismissNexusShellGate,
  isNexusShellGateDismissed,
} from './nexus-shell-gates.ts';

test('shell gate sessions start with no dismissed gates', () => {
  const session = createEmptyNexusShellGateSession();

  assert.deepEqual(session.dismissed_gate_ids, []);
  assert.equal(isNexusShellGateDismissed(session, 'early_access'), false);
});

test('dismissing the early access gate records it once', () => {
  const session = createEmptyNexusShellGateSession();
  const dismissedSession = dismissNexusShellGate(session, 'early_access');
  const repeatedSession = dismissNexusShellGate(dismissedSession, 'early_access');

  assert.equal(isNexusShellGateDismissed(dismissedSession, 'early_access'), true);
  assert.deepEqual(dismissedSession.dismissed_gate_ids, ['early_access']);
  assert.deepEqual(repeatedSession.dismissed_gate_ids, ['early_access']);
});
