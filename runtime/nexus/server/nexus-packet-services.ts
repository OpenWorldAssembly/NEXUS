/**
 * File: nexus-packet-services.ts
 * Description: Boots and caches the shared Node packet store and runtime service registry for Nexus API routes.
 */

import {
  createNodeSQLiteQueryServicesAsync,
} from '@runtime/storage/node-sqlite-query-services';
import { ensureNexusPacketBootstrap } from '@runtime/nexus/server/nexus-packet-service-bootstrap';
import { createNexusPacketServiceRegistry } from '@runtime/nexus/server/nexus-packet-service-registry';
import type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';

export type { NexusPacketServices } from '@runtime/nexus/server/nexus-packet-services.types';

let cachedServicesPromise: Promise<NexusPacketServices> | null = null;
const GLOBAL_SERVICES_PROMISE_KEY = '__owaNexusPacketServicesPromise';

export async function getNexusPacketServices(): Promise<NexusPacketServices> {
  const globalState = globalThis as typeof globalThis & {
    [GLOBAL_SERVICES_PROMISE_KEY]?: Promise<NexusPacketServices>;
  };

  if (globalState[GLOBAL_SERVICES_PROMISE_KEY]) {
    return globalState[GLOBAL_SERVICES_PROMISE_KEY]!;
  }

  if (!cachedServicesPromise) {
    cachedServicesPromise = (async () => {
      const queryServices = await createNodeSQLiteQueryServicesAsync();
      const services = createNexusPacketServiceRegistry(queryServices);

      await ensureNexusPacketBootstrap(queryServices);
      await services.authService.ensureStorage();
      await services.verificationService.ensureLocalValidatorIdentity();
      const preferredHeadAudit =
        await queryServices.packetStore.auditPreferredHeadConsistency();

      if (preferredHeadAudit.repairable_count > 0) {
        await queryServices.packetStore.repairPreferredHeadConsistency({
          dryRun: false,
        });
      }
      await services.attestationService.syncDerivedState();
      await services.discussionService.syncDerivedState();

      return services;
    })();
    globalState[GLOBAL_SERVICES_PROMISE_KEY] = cachedServicesPromise;
  }

  return cachedServicesPromise;
}
