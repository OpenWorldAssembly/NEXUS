/**
 * File: mutation-service.ts
 * Description: Orchestrates the shared fortress prepare/finalize mutation corridor over adapted packet state and runtime proofs.
 *
 * Per-intent packet preparation and finalization live behind registry-dispatched handler bridges so routes and UI surfaces use one corridor.
 */

import type {
  MutationFinalizeRequest,
  MutationIntent,
  MutationPersistEffect,
  MutationTicket,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type { MutationProofBundle } from '@core/auth/proof-types';
import type {
  DiscussionActorClass,
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import type { NexusAuthService } from '@runtime/nexus/server/auth-service';
import { SQLiteAttestationService } from '@runtime/nexus/server/attestation-service';
import { SQLiteDiscussionService } from '@runtime/nexus/server/discussion-service';
import { MutationTicketStore, type StoredMutationTicket } from '@runtime/nexus/server/mutation-ticket-store';
import { MutationTicketService } from '@runtime/nexus/server/mutation-ticket-service';
import { MutationPolicyGate } from '@runtime/nexus/server/mutation-policy-gate';
import { SignedPacketFinalizer } from '@runtime/nexus/server/signed-packet-finalizer';
import {
  getMutationIntentDescriptor,
  type MutationFinalizeHandlerKey,
} from '@runtime/nexus/server/mutation-intent-registry';
import { MutationFinalizeHandlers } from '@runtime/nexus/server/mutation-finalize-handlers';
import { MutationPrepareHandlers } from '@runtime/nexus/server/mutation-prepare-handlers';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type ActorContext = {
  actorPacket: PacketEnvelopeByType['Element'];
  actorKey: string;
  actorClass: DiscussionActorClass;
  proofBundle: MutationProofBundle;
};

type PreparedMutationResult = {
  ticket: MutationTicket;
  prepared_mutation: PreparedMutation;
};

type FinalizedMutationResult = {
  kind: MutationIntent['kind'];
  persist_effects: MutationPersistEffect[];
  result: unknown;
};

type PreparedMutationOrTicket = PreparedMutation | PreparedMutationResult;

type FinalizeHandlerInput = {
  storedTicket: StoredMutationTicket;
  actorContext: ActorContext;
  signedPackets: PacketEnvelope[];
};

type FinalizeHandlerResult = {
  persist_effects: MutationPersistEffect[];
  result: unknown;
};

type FinalizeHandler = (input: FinalizeHandlerInput) => Promise<FinalizeHandlerResult>;


function isPreparedMutationResult(
  value: PreparedMutationOrTicket
): value is PreparedMutationResult {
  return (
    typeof value === 'object' &&
    value !== null &&
    'ticket' in value &&
    'prepared_mutation' in value
  );
}

export class NexusMutationService {
  private readonly ticketService: MutationTicketService;
  private readonly signedPacketFinalizer: SignedPacketFinalizer;
  private readonly policyGate: MutationPolicyGate;
  private readonly prepareHandlers: MutationPrepareHandlers;
  private readonly finalizeHandlers: MutationFinalizeHandlers;

  constructor(
    private readonly packetStore: NodeSQLitePacketStore,
    private readonly authService: NexusAuthService,
    private readonly discussionService: SQLiteDiscussionService,
    private readonly attestationService: SQLiteAttestationService,
    ticketStore: MutationTicketStore
  ) {
    this.ticketService = new MutationTicketService(ticketStore);
    this.signedPacketFinalizer = new SignedPacketFinalizer(packetStore);
    this.policyGate = new MutationPolicyGate(packetStore, authService);
    this.prepareHandlers = new MutationPrepareHandlers(
      packetStore,
      this.policyGate,
      this.ticketService
    );
    this.finalizeHandlers = new MutationFinalizeHandlers(
      packetStore,
      authService,
      discussionService,
      attestationService,
      this.signedPacketFinalizer
    );
  }


  readTicket(ticketId: string) {
    return this.ticketService.read(ticketId);
  }

  async prepareMutation(input: {
    intent: MutationIntent;
    actorPacket: PacketEnvelopeByType['Element'];
    actorKey: string;
  }): Promise<PreparedMutationResult> {
    const descriptor = getMutationIntentDescriptor(input.intent.kind);
    const prepared = await this.prepareHandlers.run(descriptor.prepare, input);

    if (isPreparedMutationResult(prepared)) {
      return prepared;
    }

    return this.ticketService.createPreparedMutationTicket({
      actorPacketId: input.actorPacket.header.packet_id,
      preparedMutation: prepared,
      intent: input.intent,
    });
  }

  private createFinalizeHandlerMap(): Record<MutationFinalizeHandlerKey, FinalizeHandler> {
    return {
      finalizeLocalityPathCreate: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeLocalityPathCreate({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeLocalityGraphApply: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeLocalityGraphApply({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeDiscussionThreadPost: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeDiscussionThreadPost({
          storedTicket,
          actorContext,
          signedPackets,
        }),
      finalizeDiscussionReply: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeDiscussionReply({
          storedTicket,
          actorContext,
          signedPackets,
        }),
      finalizePacketSignal: async ({ actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizePacketSignal({
          actorContext,
          signedPackets: signedPackets as [PacketEnvelopeByType['Attestation']],
        }),
      finalizeAssemblyElementCreate: async ({ actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeAssemblyElementCreate({
          actorContext,
          signedPackets,
        }),
      finalizeAssociationRelationUpdate: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeAssociationRelationUpdate({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeHomeLocalityRelation: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeHomeLocalityRelation({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeFollowRelationUpdate: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeFollowRelationUpdate({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeClaimUpdate: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeClaimUpdate({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeRoleAssociationAttestation: async ({
        storedTicket,
        actorContext,
        signedPackets,
      }) =>
        this.finalizeHandlers.finalizeRoleAssociationAttestation({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeDiscussionSurfacesEnsure: async ({ storedTicket, actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeDiscussionSurfacesEnsure({
          actorContext,
          signedPackets,
          storedTicket,
        }),
      finalizeActorWritePolicyUpdate: async ({ actorContext, signedPackets }) =>
        this.finalizeHandlers.finalizeActorWritePolicyUpdate({
          actorContext,
          signedPackets,
        }),
    };
  }

  async finalizeMutation(input: {
    request: MutationFinalizeRequest;
    actorContext: ActorContext;
  }): Promise<FinalizedMutationResult> {
    const storedTicket = this.ticketService.consumeForActor({
      ticketId: input.request.ticket_id,
      actorPacketId: input.actorContext.actorPacket.header.packet_id,
    });

    await this.signedPacketFinalizer.validateSignedMutationBundle({
      storedTicket,
      signedPackets: input.request.signed_packets,
      proofBundle: input.actorContext.proofBundle,
    });

    const descriptor = getMutationIntentDescriptor(storedTicket.intent.kind);
    const finalized = await this.createFinalizeHandlerMap()[descriptor.finalize]({
      storedTicket,
      actorContext: input.actorContext,
      signedPackets: input.request.signed_packets,
    });

    return {
      kind: storedTicket.intent.kind,
      persist_effects: finalized.persist_effects,
      result: finalized.result,
    };
  }

}
