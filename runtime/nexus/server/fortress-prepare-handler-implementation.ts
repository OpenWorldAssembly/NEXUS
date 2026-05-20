/**
 * File: fortress-prepare-handler-implementation.ts
 * Description: Transitional prepare-handler bridge for fortress mutation intents before packet-definition manifests own generic packet preparation.
 */

import type {
  MutationIntent,
  MutationTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import { runTrustedCompositeWorkflowMutation } from '@runtime/nexus/server/trusted-composite-workflow-runtime';
import { runTrustedPacketWorkflowMutation } from '@runtime/nexus/server/trusted-packet-workflow-runtime';
import { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
import { MutationTicketService } from '@runtime/nexus/server/mutation-ticket-service';
import type { MutationPrepareHandlerKey } from '@runtime/nexus/server/mutation-intent-registry';
import { createMutationPrepareHandlerMap } from '@runtime/nexus/server/fortress-handler-domains';
import type { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type PreparedMutationResult = {
  ticket: MutationTicket;
  prepared_mutation: PreparedMutation;
};

type PreparedMutationOrTicket = PreparedMutation | PreparedMutationResult;

type PrepareHandlerInput = {
  intent: MutationIntent;
  actorPacket: PacketEnvelopeByType['Element'];
  actorKey: string;
};

type PrepareHandler = (input: PrepareHandlerInput) => Promise<PreparedMutationOrTicket>;

export class MutationPrepareHandlers {
  constructor(
    private readonly packetStore: NodeSQLitePacketStore,
    private readonly policyGate: MutationPolicyGate,
    private readonly ticketService: MutationTicketService,
    private readonly attestationService: SQLiteAttestationService
  ) {}

  async prepareDiscussionThreadPost(input: {
    intent: Extract<MutationIntent, { kind: 'discussion.thread_post.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutation>;
  }

  async prepareDiscussionReply(input: {
    intent: Extract<MutationIntent, { kind: 'discussion.reply.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutation>;
  }

  async preparePacketSignal(input: {
    intent: Extract<MutationIntent, { kind: 'attestation.packet_signal.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      attestationService: this.attestationService,
      actorKey: input.actorKey,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
  }

  async prepareActorWritePolicyUpdate(input: {
    intent: Extract<MutationIntent, { kind: 'actor.write_policy.update' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutation>;
  }

  async prepareAssemblyElementCreate(input: {
    intent: Extract<MutationIntent, { kind: 'assembly.element.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutation>;
  }

  async prepareAssemblyAssociationRelation(input: {
    intent:
      | Extract<MutationIntent, { kind: 'assembly_association.relation.set' }>
      | Extract<MutationIntent, { kind: 'assembly_association.relation.clear' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
  }

  async prepareHomeLocalityRelation(input: {
    intent: Extract<MutationIntent, { kind: 'home_locality.relation.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
  }

  async prepareFollowRelation(input: {
    intent:
      | Extract<MutationIntent, { kind: 'follows.relation.set' }>
      | Extract<MutationIntent, { kind: 'follows.relation.clear' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
  }

  async prepareRoleAssociationClaim(input: {
    intent: Extract<MutationIntent, { kind: 'role_association.claim.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
  }

  async prepareRoleAssociationAttestation(input: {
    intent: Extract<MutationIntent, { kind: 'role_association.attestation.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutation>;
  }


  async prepareLocalityPathCreate(input: {
    intent: Extract<MutationIntent, { kind: 'locality.path.create' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutationResult & { prepared_result: unknown }> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutationResult & { prepared_result: unknown }>;
  }

  async prepareLocalityGraphApply(input: {
    intent: Extract<MutationIntent, { kind: 'locality.graph.apply' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutationResult & { prepared_result: unknown }> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutationResult & { prepared_result: unknown }>;
  }

  async prepareDiscussionSurfacesEnsure(input: {
    intent: Extract<MutationIntent, { kind: 'discussion.surfaces.ensure' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedCompositeWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      ticketService: this.ticketService,
      actorPacket: input.actorPacket,
      intent: input.intent,
    }) as Promise<PreparedMutation>;
  }

  private createPrepareHandlerMap(): Record<MutationPrepareHandlerKey, PrepareHandler> {
    return createMutationPrepareHandlerMap(this);
  }

  run(handlerKey: MutationPrepareHandlerKey, input: PrepareHandlerInput) {
    return this.createPrepareHandlerMap()[handlerKey](input);
  }
}
