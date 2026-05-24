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
import {
  preparePreferenceElementFortressMutation,
} from '@runtime/nexus/server/preference-fortress-workflow';
import type { SQLiteReactionService } from '@runtime/nexus/server/reaction-service';
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
    private readonly reactionService: SQLiteReactionService
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

  async preparePacketVoteReaction(input: {
    intent: Extract<MutationIntent, { kind: 'reaction.vote.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      reactionService: this.reactionService,
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

  async prepareAssociationRelation(input: {
    intent:
      | Extract<MutationIntent, { kind: 'relation.association.add' }>
      | Extract<MutationIntent, { kind: 'relation.association.clear' }>;
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
    intent: Extract<MutationIntent, { kind: 'relation.residence.add' }>;
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
      | Extract<MutationIntent, { kind: 'relation.follow.add' }>
      | Extract<MutationIntent, { kind: 'relation.follow.clear' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
  }

  async prepareRoleParticipationRelation(input: {
    intent:
      | Extract<MutationIntent, { kind: 'relation.participation.add' }>
      | Extract<MutationIntent, { kind: 'relation.participation.clear' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutation> {
    return runTrustedPacketWorkflowMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });
  }

  async prepareRoleParticipationReaction(input: {
    intent: Extract<MutationIntent, { kind: 'relation.participation.reaction.set' }>;
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

  async preparePreferenceElementSet(input: {
    intent: Extract<MutationIntent, { kind: 'preference.element.set' }>;
    actorPacket: PacketEnvelopeByType['Element'];
  }): Promise<PreparedMutationResult> {
    const prepared = await preparePreferenceElementFortressMutation({
      packetStore: this.packetStore,
      policyGate: this.policyGate,
      actorPacket: input.actorPacket,
      intent: input.intent,
    });

    return this.ticketService.createPreparedMutationTicket({
      actorPacketId: input.actorPacket.header.packet_id,
      preparedMutation: prepared.preparedMutation,
      intent: input.intent,
      preparedResult: prepared.preparedResult,
    });
  }

  private createPrepareHandlerMap(): Record<MutationPrepareHandlerKey, PrepareHandler> {
    return createMutationPrepareHandlerMap(this);
  }

  run(handlerKey: MutationPrepareHandlerKey, input: PrepareHandlerInput) {
    return this.createPrepareHandlerMap()[handlerKey](input);
  }
}
