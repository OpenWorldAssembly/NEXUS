/**
 * File: nexus-route-utils.ts
 * Description: Small Nexus-shell route helpers for safe return-to flows between identity ceremonies and scoped workspaces.
 */

import type { Href } from 'expo-router';

import { normalizeNexusRouteParam, resolveNexusReturnPath } from '@runtime/nexus/nexus-shell';

type NexusIdentityPath =
  | '/nexus/identity/sign-in'
  | '/nexus/identity/claim'
  | '/nexus/identity/create'
  | '/nexus/identity/restore';

/**
 * Inputs: an identity route pathname plus optional return path and scope id.
 * Output: an Expo-router href object carrying return-to context when present.
 */
export function buildIdentityRouteHref(input: {
  pathname: NexusIdentityPath;
  returnTo?: string | null;
  returnScopeId?: string | null;
}): Href {
  const params: Record<string, string> = {};

  if (input.returnTo) {
    params.return_to = input.returnTo;
  }

  if (input.returnScopeId) {
    params.return_scope_id = input.returnScopeId;
  }

  if (Object.keys(params).length === 0) {
    return input.pathname;
  }

  return {
    pathname: input.pathname,
    params,
  } as Href;
}

/**
 * Inputs: the current route path and active scope id.
 * Output: a sign-in href that preserves where a protected guest action started.
 */
export function buildRoleActionReturnHref(input: {
  pathname: string;
  scopeId: string;
}): Href {
  return buildIdentityRouteHref({
    pathname: '/nexus/identity/sign-in',
    returnTo: input.pathname,
    returnScopeId: input.scopeId,
  });
}

/**
 * Inputs: raw route query params and a fallback route.
 * Output: a normalized safe return destination plus optional scope id.
 */
export function getIdentityReturnDestination(input: {
  returnToParam: string | string[] | null | undefined;
  returnScopeIdParam: string | string[] | null | undefined;
  fallback: string;
}): {
  returnTo: string;
  returnScopeId: string | null;
} {
  return {
    returnTo: resolveNexusReturnPath(input.returnToParam, input.fallback),
    returnScopeId: normalizeNexusRouteParam(input.returnScopeIdParam),
  };
}
