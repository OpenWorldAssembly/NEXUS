/**
 * File: fortress-handler-contracts.ts
 * Description: Shared runtime contracts for composed fortress prepare/finalize handlers.
 */

import type {
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
import type {
  MutationFinalizeHandlerKey,
  MutationPrepareHandlerKey,
} from '@runtime/nexus/server/mutation-intent-registry';
import type { StoredMutationTicket } from '@runtime/nexus/server/mutation-ticket-store';

export type FortressPreparedMutationResult = {
  ticket: MutationTicket;
  prepared_mutation: PreparedMutation;
};

export type FortressPreparedMutationOrTicket =
  | PreparedMutation
  | FortressPreparedMutationResult;

export type FortressPrepareHandlerInput = {
  intent: MutationIntent;
  actorPacket: PacketEnvelopeByType['Element'];
  actorKey: string;
};

export type FortressPrepareHandler = (
  input: FortressPrepareHandlerInput
) => Promise<FortressPreparedMutationOrTicket>;

export type FortressPrepareHandlerMap = Record<
  MutationPrepareHandlerKey,
  FortressPrepareHandler
>;

export type FortressFinalizeActorContext = {
  actorPacket: PacketEnvelopeByType['Element'];
  actorKey: string;
  actorClass: DiscussionActorClass;
  proofBundle: MutationProofBundle;
};

export type FortressFinalizeHandlerInput = {
  storedTicket: StoredMutationTicket;
  actorContext: FortressFinalizeActorContext;
  signedPackets: PacketEnvelope[];
};

export type FortressFinalizeHandlerResult = {
  persist_effects: MutationPersistEffect[];
  result: unknown;
};

export type FortressFinalizeHandler = (
  input: FortressFinalizeHandlerInput
) => Promise<FortressFinalizeHandlerResult>;

export type FortressFinalizeHandlerMap = Record<
  MutationFinalizeHandlerKey,
  FortressFinalizeHandler
>;

export type FortressHandlerDomain =
  | 'locality'
  | 'discussion'
  | 'reaction'
  | 'assembly'
  | 'relation'
  | 'role'
  | 'actor_policy'
  | 'preference';
