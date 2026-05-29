/**
 * File: trusted_dispatch_coordinator.test.ts
 * Description: Smoke tests for the Trusted Dispatch Coordinator compatibility bridge.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import type { PacketStore } from '@core/contracts';
import { createAssemblyPacket, createDiscussionThreadPacket } from '@core/packets/builders';
import { createPersonIdentityPacket } from '@core/packets/identity';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import { trustedDispatchCoordinator } from './trusted_dispatch_coordinator/trusted_dispatch_coordinator.ts';
import { trustedRequestCoordinator } from './trusted_request_coordinator/trusted_request_coordinator.ts';

const actorPacket = {
  header: {
    packet_id: 'actor.packet',
  },
} as PacketEnvelopeByType['Element'];

function createMemoryPacketStore(seedPackets: PacketEnvelopeByType[keyof PacketEnvelopeByType][] = []) {
  const packets = new Map(seedPackets.map((packet) => [packet.header.packet_id, packet]));
  const writes: { packet_id: string; revision_id: string }[] = [];
  const writtenPackets: PacketEnvelopeByType[keyof PacketEnvelopeByType][] = [];

  return {
    writes,
    store: {
      validate(packet: unknown) {
        return packet as PacketEnvelopeByType[keyof PacketEnvelopeByType];
      },
      async writeRevision(packet: PacketEnvelopeByType[keyof PacketEnvelopeByType]) {
        packets.set(packet.header.packet_id, packet);
        writtenPackets.push(packet);
        const revision = {
          packet_id: packet.header.packet_id,
          revision_id: packet.header.revision_id,
        };
        writes.push(revision);
        return revision;
      },
      async publishRevision() {},
      async fetchByPacket(packetRef: { packet_id: string }) {
        return packets.get(packetRef.packet_id) ?? null;
      },
      async fetchByRevision(revisionRef: { packet_id: string; revision_id: string }) {
        const packet = packets.get(revisionRef.packet_id) ?? null;
        return packet?.header.revision_id === revisionRef.revision_id ? packet : null;
      },
      async resolveRevisionRef(revisionId: string) {
        for (const packet of packets.values()) {
          if (packet.header.revision_id === revisionId) {
            return {
              packet_id: packet.header.packet_id,
              revision_id: packet.header.revision_id,
            };
          }
        }
        return null;
      },
      async fetchPreferredRevision(packetRef: { packet_id: string }) {
        const packet = packets.get(packetRef.packet_id) ?? null;
        return packet
          ? {
              packet_id: packet.header.packet_id,
              revision_id: packet.header.revision_id,
            }
          : null;
      },
      async fetchRevisionHeads() {
        return {
          preferred_revision: null,
          head_revisions: [],
          revision_state: 'linear',
        };
      },
      async queryEdges() {
        return [];
      },
      async mergeRevisions() {
        throw new Error('mergeRevisions is not implemented by this test store.');
      },
      async readByPacket(packetRef: { packet_id: string }) {
        return packets.get(packetRef.packet_id) ?? null;
      },
      async readByRevision(revisionRef: { packet_id: string; revision_id: string }) {
        const packet = packets.get(revisionRef.packet_id) ?? null;
        return packet?.header.revision_id === revisionRef.revision_id ? packet : null;
      },
      async prepareRevisionForAdaptedSave() {
        return null;
      },
      async prepareRevisionForVersionedSave() {
        return null;
      },
      async writePreparedRevision() {
        throw new Error('writePreparedRevision is not implemented by this test store.');
      },
      async importBundle() {
        return { packet_count: 0, revision_count: 0, edge_count: 0 };
      },
      async exportBundle() {
        return { bytes: new Uint8Array(), packet_count: 0, revision_count: 0 };
      },
      async listPreferredPacketsByType(type?: string) {
        return type
          ? [...packets.values()].filter((packet) => packet.header.type === type)
          : [...packets.values()];
      },
      async listPreferredPackets() {
        return [...packets.values()];
      },
      async getPacketVerificationSummary() {
        return null;
      },
      async listPacketVerificationSummaries() {
        return [];
      },
      async writePacketVerificationSummary() {},
    } as PacketStore,
    writtenPackets,
  };
}

async function createSignedActor() {
  const keyPair = await generateP256KeyPair();
  const jwks = await exportIdentityKeyPairToJwk(keyPair);
  const createdAt = '2026-05-28T12:00:00.000Z';
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: jwks.publicJwk,
    addedAt: createdAt,
  });
  const unsignedActor = createPersonIdentityPacket({
    alias: 'Dispatch Writer',
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId: 'nexus:element/dispatch-writer',
    createdAt,
  });
  const actor = await signPacketWithIdentity({
    packet: unsignedActor,
    signerPacketId: unsignedActor.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: createdAt,
  });

  return { actor, keyPair, keyBinding };
}

test('trusted dispatch coordinator normalizes through the request bridge', () => {
  const result = trustedDispatchCoordinator.normalizeRequest({
    source_kind: 'interface_signal',
    source_route: '/api/nexus/mutations/prepare',
    operation_kind: 'mutation_prepare',
    client_intent_id: 'scope.association.set',
    mutation_intent: 'relation.association.add',
    request_id: 'interface.event.test',
  });

  assert.equal(result.coordinator_id, 'trusted_dispatch_coordinator.v0');
  assert.equal(result.coordinator_kind, 'dispatch');
  assert.equal(result.value?.request_id, 'interface.event.test');
  assert.equal(result.value?.mutation_intent, 'relation.association.add');
});

test('trusted dispatch coordinator preserves enrollment parity with request coordinator', () => {
  const dispatchResult = trustedDispatchCoordinator.listEnrollments();
  const requestResult = trustedRequestCoordinator.listEnrollments();

  assert.equal(dispatchResult.coordinator_kind, 'dispatch');
  assert.equal(
    dispatchResult.value?.enrollments.length,
    requestResult.value?.enrollments.length
  );
});

test('dispatch-owned write pipeline prepares and finalizes relation.follow.add', async () => {
  const { actor, keyPair, keyBinding } = await createSignedActor();
  const targetScope = createAssemblyPacket({
    packet_id: 'nexus:element/dispatch-target-scope',
    created_at: '2026-05-28T12:01:00.000Z',
    name: 'Dispatch Target Scope',
    subtype: 'assembly',
    locality_label: 'Dispatch Target Scope',
  });
  const { store, writes, writtenPackets } = createMemoryPacketStore([actor, targetScope]);
  const prepareResult = await trustedDispatchCoordinator.prepareEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/prepare',
    client_intent_id: 'scope.follow.set',
    request_id: 'dispatch.write.prepare.test',
    actor_packet: actor,
    actor_key: 'actor.key',
    intent: {
      kind: 'relation.follow.add',
      scope_id: targetScope.header.packet_id,
      target_scope_packet_id: targetScope.header.packet_id,
    },
    packet_store: store,
  });

  assert.equal(prepareResult.coordinator_id, 'trusted_dispatch_coordinator.v0');
  assert.equal(prepareResult.coordinator_kind, 'dispatch');
  assert.equal(prepareResult.status, 'ok');
  assert.equal(prepareResult.value?.prepared_mutation.prepared_packets.length, 1);
  assert.equal(
    prepareResult.process_chain?.stages.some((stage) =>
      stage.coordinator_kind === 'certification'
    ),
    true
  );

  const unsignedPacket = prepareResult.value!.prepared_mutation.prepared_packets[0]!.packet;
  const signedPacket = await signPacketWithIdentity({
    packet: unsignedPacket,
    signerPacketId: actor.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: '2026-05-28T12:02:00.000Z',
  });
  const finalizeResult = await trustedDispatchCoordinator.finalizeEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/finalize',
    client_intent_id: 'scope.follow.set',
    request_id: 'dispatch.write.finalize.test',
    mutation_intent: 'relation.follow.add',
    actor_packet: actor,
    request: {
      ticket_id: prepareResult.value!.ticket.ticket_id,
      signed_packets: [signedPacket],
    },
    packet_store: store,
  });

  assert.equal(finalizeResult.status, 'ok');
  assert.equal(finalizeResult.value?.kind, 'relation.follow.add');
  assert.equal(finalizeResult.value?.persist_effects.length, 1);
  assert.equal(
    finalizeResult.process_chain?.stages.some((stage) =>
      stage.coordinator_kind === 'archive'
    ),
    true
  );
  assert.equal(writes.length, 1);
  const writtenRelation = writtenPackets[0] as PacketEnvelopeByType['Relation'];
  assert.equal(writtenRelation.header.packet_id, signedPacket.header.packet_id);
  assert.equal(writtenRelation.header.revision_id, signedPacket.header.revision_id);
  assert.equal(writtenRelation.header.integrity.embedded_signatures.length, 1);
  assert.equal(writtenRelation.body.subtype, 'follow');
  assert.equal(writtenRelation.body.status, 'active');
  assert.equal(writtenRelation.body.subject_ref.packet_id, actor.header.packet_id);
  assert.equal(writtenRelation.body.target_ref.packet_id, targetScope.header.packet_id);
  assert.equal(writtenRelation.body.scope_ref?.packet_id, targetScope.header.packet_id);
});

test('dispatch-owned write pipeline prepares and finalizes relation.association.add', async () => {
  const { actor, keyPair, keyBinding } = await createSignedActor();
  const targetScope = createAssemblyPacket({
    packet_id: 'nexus:element/dispatch-association-target-scope',
    created_at: '2026-05-28T12:05:00.000Z',
    name: 'Dispatch Association Target Scope',
    subtype: 'assembly',
    locality_label: 'Dispatch Association Target Scope',
  });
  const { store, writes, writtenPackets } = createMemoryPacketStore([actor, targetScope]);
  const prepareResult = await trustedDispatchCoordinator.prepareEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/prepare',
    client_intent_id: 'scope.association.set',
    request_id: 'dispatch.association.prepare.test',
    actor_packet: actor,
    actor_key: 'actor.key',
    intent: {
      kind: 'relation.association.add',
      target_packet_id: targetScope.header.packet_id,
      scope_id: targetScope.header.packet_id,
      note: 'association note',
    },
    packet_store: store,
  });

  assert.equal(prepareResult.status, 'ok');
  assert.equal(prepareResult.value?.prepared_mutation.kind, 'relation.association.add');
  assert.equal(prepareResult.value?.prepared_mutation.action_ids.includes('relation.association.add'), true);
  assert.equal(prepareResult.value?.prepared_mutation.prepared_packets.length, 1);

  const unsignedPacket = prepareResult.value!.prepared_mutation.prepared_packets[0]!.packet as PacketEnvelopeByType['Relation'];
  assert.equal(unsignedPacket.body.subtype, 'association');
  assert.equal(unsignedPacket.body.note, 'association note');

  const signedPacket = await signPacketWithIdentity({
    packet: unsignedPacket,
    signerPacketId: actor.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: '2026-05-28T12:06:00.000Z',
  });
  const finalizeResult = await trustedDispatchCoordinator.finalizeEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/finalize',
    client_intent_id: 'scope.association.set',
    request_id: 'dispatch.association.finalize.test',
    mutation_intent: 'relation.association.add',
    actor_packet: actor,
    request: {
      ticket_id: prepareResult.value!.ticket.ticket_id,
      signed_packets: [signedPacket],
    },
    packet_store: store,
  });

  assert.equal(finalizeResult.status, 'ok');
  assert.equal(finalizeResult.value?.kind, 'relation.association.add');
  assert.equal(finalizeResult.value?.persist_effects.length, 1);
  assert.equal(writes.length, 1);
  const writtenRelation = writtenPackets[0] as PacketEnvelopeByType['Relation'];
  assert.equal(writtenRelation.header.packet_id, signedPacket.header.packet_id);
  assert.equal(writtenRelation.header.revision_id, signedPacket.header.revision_id);
  assert.equal(writtenRelation.header.integrity.embedded_signatures.length, 1);
  assert.equal(writtenRelation.body.subtype, 'association');
  assert.equal(writtenRelation.body.status, 'active');
  assert.equal(writtenRelation.body.subject_ref.packet_id, actor.header.packet_id);
  assert.equal(writtenRelation.body.target_ref.packet_id, targetScope.header.packet_id);
  assert.equal(writtenRelation.body.scope_ref?.packet_id, targetScope.header.packet_id);
  assert.equal(writtenRelation.body.note, 'association note');
});

test('dispatch-owned write pipeline prepares and finalizes reaction.vote.set', async () => {
  const { actor, keyPair, keyBinding } = await createSignedActor();
  const targetScope = createAssemblyPacket({
    packet_id: 'nexus:element/dispatch-reaction-scope',
    created_at: '2026-05-28T12:07:00.000Z',
    name: 'Dispatch Reaction Scope',
    subtype: 'assembly',
    locality_label: 'Dispatch Reaction Scope',
  });
  const targetThread = createDiscussionThreadPacket({
    packet_id: 'nexus:discussion/dispatch-reaction-target',
    created_at: '2026-05-28T12:07:30.000Z',
    title: 'Dispatch Reaction Target',
    summary: 'Target for dispatch reaction write test.',
    forum_ref: { packet_id: targetScope.header.packet_id },
    thread_kind: 'general',
    authority_scope_ref: { packet_id: targetScope.header.packet_id },
    applicable_scope_refs: [{ packet_id: targetScope.header.packet_id }],
    created_by: { packet_id: actor.header.packet_id },
  });
  const { store, writes, writtenPackets } = createMemoryPacketStore([
    actor,
    targetScope,
    targetThread,
  ]);
  const prepareResult = await trustedDispatchCoordinator.prepareEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/prepare',
    client_intent_id: 'reaction.vote.set',
    request_id: 'dispatch.reaction.prepare.test',
    actor_packet: actor,
    actor_key: 'actor.key',
    intent: {
      kind: 'reaction.vote.set',
      scope_id: targetScope.header.packet_id,
      target_packet_id: targetThread.header.packet_id,
      value: 'up',
      created_at: '2026-05-28T12:08:00.000Z',
    },
    packet_store: store,
  });

  assert.equal(prepareResult.status, 'ok');
  assert.equal(prepareResult.value?.prepared_mutation.kind, 'reaction.vote.set');
  assert.equal(prepareResult.value?.prepared_mutation.action_ids.includes('reaction.vote.set'), true);
  assert.equal(prepareResult.value?.prepared_mutation.prepared_packets.length, 1);

  const unsignedPacket = prepareResult.value!.prepared_mutation.prepared_packets[0]!.packet as PacketEnvelopeByType['Reaction'];
  assert.equal(unsignedPacket.header.type, 'Reaction');
  assert.equal(unsignedPacket.body.subtype, 'reaction');
  assert.equal(unsignedPacket.body.status, 'active');
  assert.equal(unsignedPacket.body.vote_value, 'up');
  assert.equal(unsignedPacket.body.target_ref.packet_id, targetThread.header.packet_id);
  assert.equal(unsignedPacket.header.authority_scope_ref?.packet_id, targetScope.header.packet_id);

  const signedPacket = await signPacketWithIdentity({
    packet: unsignedPacket,
    signerPacketId: actor.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: '2026-05-28T12:08:30.000Z',
  });
  const finalizeResult = await trustedDispatchCoordinator.finalizeEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/finalize',
    client_intent_id: 'reaction.vote.set',
    request_id: 'dispatch.reaction.finalize.test',
    mutation_intent: 'reaction.vote.set',
    actor_packet: actor,
    request: {
      ticket_id: prepareResult.value!.ticket.ticket_id,
      signed_packets: [signedPacket],
    },
    packet_store: store,
  });

  assert.equal(finalizeResult.status, 'ok');
  assert.equal(finalizeResult.value?.kind, 'reaction.vote.set');
  assert.equal(finalizeResult.value?.persist_effects.length, 1);
  assert.equal(writes.length, 1);
  const writtenReaction = writtenPackets[0] as PacketEnvelopeByType['Reaction'];
  assert.equal(writtenReaction.header.packet_id, signedPacket.header.packet_id);
  assert.equal(writtenReaction.header.revision_id, signedPacket.header.revision_id);
  assert.equal(writtenReaction.header.integrity.embedded_signatures.length, 1);
  assert.equal(writtenReaction.body.subtype, 'reaction');
  assert.equal(writtenReaction.body.status, 'active');
  assert.equal(writtenReaction.body.vote_value, 'up');
  assert.equal(writtenReaction.body.target_ref.packet_id, targetThread.header.packet_id);
});

test('dispatch-owned finalize rejects mutation intent labels that do not match the certification plan', async () => {
  const { actor, keyPair, keyBinding } = await createSignedActor();
  const targetScope = createAssemblyPacket({
    packet_id: 'nexus:element/dispatch-mismatch-target-scope',
    created_at: '2026-05-28T12:03:00.000Z',
    name: 'Dispatch Mismatch Target Scope',
    subtype: 'assembly',
    locality_label: 'Dispatch Mismatch Target Scope',
  });
  const { store } = createMemoryPacketStore([actor, targetScope]);
  const prepareResult = await trustedDispatchCoordinator.prepareEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/prepare',
    client_intent_id: 'scope.follow.set',
    request_id: 'dispatch.write.prepare.mismatch.test',
    actor_packet: actor,
    actor_key: 'actor.key',
    intent: {
      kind: 'relation.follow.add',
      scope_id: targetScope.header.packet_id,
      target_scope_packet_id: targetScope.header.packet_id,
    },
    packet_store: store,
  });
  assert.equal(prepareResult.status, 'ok');

  const unsignedPacket = prepareResult.value!.prepared_mutation.prepared_packets[0]!.packet;
  const signedPacket = await signPacketWithIdentity({
    packet: unsignedPacket,
    signerPacketId: actor.header.packet_id,
    kid: keyBinding.kid,
    privateKey: keyPair.privateKey,
    signedAt: '2026-05-28T12:04:00.000Z',
  });
  const finalizeResult = await trustedDispatchCoordinator.finalizeEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/finalize',
    client_intent_id: 'scope.follow.set',
    request_id: 'dispatch.write.finalize.mismatch.test',
    mutation_intent: 'relation.association.add',
    actor_packet: actor,
    request: {
      ticket_id: prepareResult.value!.ticket.ticket_id,
      signed_packets: [signedPacket],
    },
    packet_store: store,
  });

  assert.equal(finalizeResult.status, 'blocked');
  assert.equal(finalizeResult.issues[0]?.code, 'dispatch.mutation_intent_mismatch');
});

test('dispatch-owned finalize write pipeline rejects unknown certification tickets', async () => {
  const result = await trustedDispatchCoordinator.finalizeEnrolledMutationWrite({
    source_route: '/api/nexus/mutations/finalize',
    client_intent_id: 'scope.follow.set',
    request_id: 'dispatch.write.finalize.test',
    actor_packet: actorPacket,
    request: {
      ticket_id: 'certification.ticket',
      signed_packets: [],
    },
  });

  assert.equal(result.status, 'blocked');
  assert.equal(result.issues[0]?.code, 'dispatch.certification_payload_unsupported');
});

test('live mutation routes and registry do not call the legacy mutation service corridor', () => {
  const prepareRoute = readFileSync(
    'src/app/api/nexus/mutations/prepare+api.ts',
    'utf8'
  );
  const finalizeRoute = readFileSync(
    'src/app/api/nexus/mutations/finalize+api.ts',
    'utf8'
  );
  const serviceRegistry = readFileSync(
    'runtime/nexus/server/nexus-packet-service-registry.ts',
    'utf8'
  );
  const serviceTypes = readFileSync(
    'runtime/nexus/server/nexus-packet-services.types.ts',
    'utf8'
  );
  const routeSource = `${prepareRoute}\n${finalizeRoute}`;

  assert.equal(routeSource.includes('mutationService.prepareMutation('), false);
  assert.equal(routeSource.includes('mutationService.finalizeMutation('), false);
  assert.equal(routeSource.includes('mutationService.readTicket('), false);
  assert.equal(finalizeRoute.includes('parsePacketEnvelope'), false);
  assert.equal(serviceRegistry.includes('NexusMutationService'), false);
  assert.equal(serviceRegistry.includes('MutationTicketStore'), false);
  assert.equal(serviceRegistry.includes('mutationService'), false);
  assert.equal(serviceTypes.includes('mutationService'), false);
});

test('trusted dispatch does not import reaction runtime services', () => {
  const dispatchSource = readFileSync(
    'runtime/trusted_coordinators/trusted_dispatch_coordinator/trusted_dispatch_coordinator.ts',
    'utf8'
  );
  const finalizeRoute = readFileSync(
    'src/app/api/nexus/mutations/finalize+api.ts',
    'utf8'
  );

  assert.equal(dispatchSource.includes('SQLiteReactionService'), false);
  assert.equal(dispatchSource.includes('@runtime/nexus/server/reaction'), false);
  assert.equal(dispatchSource.includes('reaction-service'), false);
  assert.equal(finalizeRoute.includes('decorateReactionFinalizeResponse'), true);
});
