/**
 * File: fortress-handler-domains.ts
 * Description: Domain-composed handler maps for the live signed fortress corridor.
 */

import type {
  FortressFinalizeHandlerMap,
  FortressPrepareHandlerMap,
} from '@runtime/nexus/server/fortress-handler-contracts';
import type { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import type { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';
import {
  createActorPolicyFinalizeHandlers,
  createActorPolicyPrepareHandlers,
} from '@runtime/nexus/server/fortress-handler-domain-actor-policy';
import {
  createAssemblyFinalizeHandlers,
  createAssemblyPrepareHandlers,
} from '@runtime/nexus/server/fortress-handler-domain-assembly';
import {
  createAttestationFinalizeHandlers,
  createAttestationPrepareHandlers,
} from '@runtime/nexus/server/fortress-handler-domain-attestation';
import {
  createDiscussionFinalizeHandlers,
  createDiscussionPrepareHandlers,
} from '@runtime/nexus/server/fortress-handler-domain-discussion';
import {
  createLocalityFinalizeHandlers,
  createLocalityPrepareHandlers,
} from '@runtime/nexus/server/fortress-handler-domain-locality';
import {
  createRelationFinalizeHandlers,
  createRelationPrepareHandlers,
} from '@runtime/nexus/server/fortress-handler-domain-relation';
import {
  createRoleFinalizeHandlers,
  createRolePrepareHandlers,
} from '@runtime/nexus/server/fortress-handler-domain-role';

export function createMutationPrepareHandlerMap(
  handlers: MutationPrepareHandlers
): FortressPrepareHandlerMap {
  return {
    ...createLocalityPrepareHandlers(handlers),
    ...createDiscussionPrepareHandlers(handlers),
    ...createAttestationPrepareHandlers(handlers),
    ...createAssemblyPrepareHandlers(handlers),
    ...createRelationPrepareHandlers(handlers),
    ...createRolePrepareHandlers(handlers),
    ...createActorPolicyPrepareHandlers(handlers),
  };
}

export function createMutationFinalizeHandlerMap(
  handlers: MutationFinalizeHandlers
): FortressFinalizeHandlerMap {
  return {
    ...createLocalityFinalizeHandlers(handlers),
    ...createDiscussionFinalizeHandlers(handlers),
    ...createAttestationFinalizeHandlers(handlers),
    ...createAssemblyFinalizeHandlers(handlers),
    ...createRelationFinalizeHandlers(handlers),
    ...createRoleFinalizeHandlers(handlers),
    ...createActorPolicyFinalizeHandlers(handlers),
  };
}
