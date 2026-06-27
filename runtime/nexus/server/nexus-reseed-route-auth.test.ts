/**
 * File: nexus-reseed-route-auth.test.ts
 * Description: Regression coverage for Nexus reseed maintenance route authorization.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { canUseReseedRoute } from '../../../src/app/api/nexus/reseed+api.ts';

test('reseed route is temporarily open without a maintenance token', () => {
  const request = new Request('https://owa.example/api/nexus/reseed');
  assert.equal(canUseReseedRoute(request), true);
});
