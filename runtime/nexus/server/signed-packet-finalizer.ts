/**
 * File: signed-packet-finalizer.ts
 * Description: Verifies and persists signed packet bundles for prepared fortress mutation tickets.
 */

import { getPacketUnsignedDigestCandidates } from '@core/auth/mutation-digests';
import {
  describeWriteProofLevel,
  doesProofBundleSatisfyRequirement,
  type MutationProofBundle,
} from '@core/auth/proof-types';
import type {
  MutationPersistEffect,
  PreparedMutation,
} from '@core/auth/mutation-corridor';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
} from '@core/schema/packet-schema';
import { verifyPacketSignature } from '@runtime/nexus/identity-crypto';
import type { StoredMutationTicket } from '@runtime/nexus/server/mutation-ticket-store';
import type { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

export function toMutationPersistEffects(
  packets: PacketEnvelope[]
): MutationPersistEffect[] {
  return packets.map((packet) => ({
    packet: {
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    },
  }));
}

export class SignedPacketFinalizer {
  constructor(private readonly packetStore: NodeSQLitePacketStore) {}

  async validateSignedMutationBundle(input: {
    storedTicket: StoredMutationTicket;
    signedPackets: PacketEnvelope[];
    proofBundle: MutationProofBundle;
  }): Promise<void> {
    await assertSignedPacketsMatchPreparedDigests({
      preparedMutation: input.storedTicket.prepared_mutation,
      signedPackets: input.signedPackets,
    });

    if (
      !doesProofBundleSatisfyRequirement({
        proofs: input.proofBundle,
        requiredLevel: input.storedTicket.prepared_mutation.required_proof_level,
        acceptedMethods:
          input.storedTicket.prepared_mutation.accepted_proof_methods,
      })
    ) {
      throw new Error(
        `This mutation requires ${describeWriteProofLevel(
          input.storedTicket.prepared_mutation.required_proof_level
        )} before it can be finalized.`
      );
    }
  }

  async persistSignedPacketsForActor(input: {
    actorPacket: PacketEnvelopeByType['Element'];
    signedPackets: PacketEnvelope[];
    signatureFailureMessage?: string;
  }): Promise<void> {
    for (const signedPacket of input.signedPackets) {
      const signatureIsValid = await verifyPacketSignature({
        packet: signedPacket,
        signerPacket: input.actorPacket,
      });

      if (!signatureIsValid) {
        throw new Error(
          input.signatureFailureMessage ??
            `Signed ${signedPacket.header.type} packet verification failed.`
        );
      }

      await this.packetStore.writeRevision(signedPacket);
      await this.packetStore.publishRevision({
        packet_id: signedPacket.header.packet_id,
        revision_id: signedPacket.header.revision_id,
      });
    }
  }
}

async function assertSignedPacketsMatchPreparedDigests(input: {
  preparedMutation: PreparedMutation;
  signedPackets: PacketEnvelope[];
}): Promise<void> {
  if (input.preparedMutation.prepared_packets.length !== input.signedPackets.length) {
    throw new Error('Signed mutation packet bundle does not match the prepared candidate size.');
  }

  for (let index = 0; index < input.preparedMutation.prepared_packets.length; index += 1) {
    const preparedPacket = input.preparedMutation.prepared_packets[index];
    const signedPacket = input.signedPackets[index];

    if (!signedPacket || signedPacket.header.type !== preparedPacket.packet.header.type) {
      throw new Error('Signed mutation packet bundle does not match the prepared packet types.');
    }

    const digestCandidates = await getPacketUnsignedDigestCandidates(signedPacket);
    const matchesPreparedDigest = digestCandidates.some(
      (candidate) => candidate.digest === preparedPacket.unsigned_digest
    );

    if (!matchesPreparedDigest) {
      throw new Error('Signed mutation packet bundle does not match the prepared packet digest.');
    }
  }
}
