/**
 * File: mutation-policy-gate.ts
 * Description: Resolves mutation write-policy requirements for trusted runtime writes.
 */

import {
  mergeWritePolicyDecisions,
  type MutationActionId,
  type ResolvedWritePolicyDecision,
} from '@core/auth/write-policy';
import type {
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import type { NexusAuthService } from '@runtime/nexus/server/auth-service';
import {
  resolveSecurityModePolicyDecision,
} from '@runtime/nexus/server/write-security-mode';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { trustedRegulationCoordinator } from '@runtime/trusted_coordinators/trusted_regulation_coordinator/index.ts';

type PolicyPacketCache = Map<
  string,
  Promise<PacketEnvelopeByType['Policy'] | null>
>;

export type ScopePolicyInput = {
  governingScopePacket: PacketEnvelopeByType['Element'] | null;
  actorPacket: PacketEnvelopeByType['Element'];
  actionIds: MutationActionId[];
};

export type MultiScopePolicyInput = {
  actorPacket: PacketEnvelopeByType['Element'];
  actionIds: MutationActionId[];
  governingScopes: {
    scopePacket: PacketEnvelopeByType['Element'] | null;
    actionIds: MutationActionId[];
  }[];
};

export type ActorWritePolicyUpdatePolicyResult = {
  currentPolicyDecision: ResolvedWritePolicyDecision;
  existingPolicyPackets: PacketEnvelopeByType['Policy'][];
  existingWritePolicyPacket: PacketEnvelopeByType['Policy'] | null;
};

function buildBootstrapWritePolicyDecision(input: {
  actionIds: MutationActionId[];
}): ResolvedWritePolicyDecision {
  return resolveSecurityModePolicyDecision({
    securityMode: 'standard',
    actionIds: input.actionIds,
    sourcePolicyPacketIds: [],
  });
}

export class MutationPolicyGate {
  constructor(
    private readonly packetStore: NodeSQLitePacketStore,
    private readonly authService: NexusAuthService
  ) {}

  async loadPolicyPacketsByRefs(
    policyRefs: PacketEnvelopeByType['Element']['header']['moderation']['policy_refs'],
    cache: PolicyPacketCache = new Map()
  ): Promise<PacketEnvelopeByType['Policy'][]> {
    const packets = await Promise.all(
      policyRefs.map((policyRef) => this.loadPolicyPacket(policyRef.packet_id, cache))
    );

    return packets.filter(
      (packet): packet is PacketEnvelopeByType['Policy'] => packet !== null
    );
  }

  async resolveScopePolicyDecision(
    input: ScopePolicyInput
  ): Promise<ResolvedWritePolicyDecision> {
    const policyPackets = input.governingScopePacket
      ? await this.loadPolicyPacketsByRefs(
          input.governingScopePacket.header.moderation.policy_refs
        )
      : [];
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const scopePolicyDecision = this.resolveTrustedScopeWritePolicyDecision({
      governingScopePacket: input.governingScopePacket,
      policyPackets,
      actionIds: input.actionIds,
    });
    const actorPolicyDecision = resolveSecurityModePolicyDecision({
      securityMode: currentSecurityMode,
      actionIds: input.actionIds,
    });

    return mergeWritePolicyDecisions({
      actionIds: input.actionIds,
      decisions: [scopePolicyDecision, actorPolicyDecision],
    });
  }

  async resolveMultiScopePolicyDecision(
    input: MultiScopePolicyInput
  ): Promise<ResolvedWritePolicyDecision> {
    const cache: PolicyPacketCache = new Map();
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const actorPolicyDecision = resolveSecurityModePolicyDecision({
      securityMode: currentSecurityMode,
      actionIds: input.actionIds,
    });
    const scopeDecisions = await Promise.all(
      input.governingScopes.map(async ({ scopePacket, actionIds }) => {
        const policyPackets = scopePacket
          ? await this.loadPolicyPacketsByRefs(
              scopePacket.header.moderation.policy_refs,
              cache
            )
          : [];

        return this.resolveTrustedScopeWritePolicyDecision({
          governingScopePacket: scopePacket,
          policyPackets,
          actionIds,
        });
      })
    );

    return mergeWritePolicyDecisions({
      actionIds: input.actionIds,
      decisions: [...scopeDecisions, actorPolicyDecision],
    });
  }

  async resolveActorWritePolicyUpdate(input: {
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<ActorWritePolicyUpdatePolicyResult> {
    const currentSecurityMode = await this.authService.resolveEffectiveSecurityMode(
      input.actorPacket.header.packet_id
    );
    const existingPolicyPackets = await this.loadPolicyPacketsByRefs(
      input.actorPacket.header.moderation.policy_refs
    );
    const existingWritePolicyPacket =
      existingPolicyPackets.find(
        (policyPacket) => policyPacket.body.subtype === 'write_lock'
      ) ?? null;
    const currentPolicyDecision = existingWritePolicyPacket
      ? mergeWritePolicyDecisions({
          actionIds: ['actor.write_policy.update'],
          decisions: [
            this.resolveTrustedScopeWritePolicyDecision({
              governingScopePacket: input.actorPacket,
              policyPackets: existingPolicyPackets,
              actionIds: ['actor.write_policy.update'],
            }),
            resolveSecurityModePolicyDecision({
              securityMode: currentSecurityMode,
              actionIds: ['actor.write_policy.update'],
              sourcePolicyPacketIds: [existingWritePolicyPacket.header.packet_id],
            }),
          ],
        })
      : buildBootstrapWritePolicyDecision({
          actionIds: ['actor.write_policy.update'],
        });

    return {
      currentPolicyDecision,
      existingPolicyPackets,
      existingWritePolicyPacket,
    };
  }


  private resolveTrustedScopeWritePolicyDecision(input: {
    governingScopePacket: PacketEnvelopeByType['Element'] | null;
    policyPackets: PacketEnvelopeByType['Policy'][];
    actionIds: MutationActionId[];
  }): ResolvedWritePolicyDecision {
    const gate = trustedRegulationCoordinator.resolveWritePolicyGate({
      context_mode: 'normal_runtime',
      operation_kind: 'write_gate',
      governing_scope_packet: input.governingScopePacket,
      policy_packets: input.policyPackets,
      action_ids: input.actionIds,
    });

    if (gate.value?.decision) {
      return gate.value.decision;
    }

    return buildBootstrapWritePolicyDecision({ actionIds: input.actionIds });
  }

  private loadPolicyPacket(
    packetId: string,
    cache: PolicyPacketCache
  ): Promise<PacketEnvelopeByType['Policy'] | null> {
    const cached = cache.get(packetId);

    if (cached) {
      return cached;
    }

    const promise = this.packetStore
      .fetchByPacket({ packet_id: packetId })
      .then((packet) =>
        packet?.header.type === 'Policy'
          ? (packet as PacketEnvelopeByType['Policy'])
          : null
      );

    cache.set(packetId, promise);
    return promise;
  }
}
