import test from 'node:test';
import assert from 'node:assert/strict';

import type {
  PacketHeadStatus,
  PacketReadValue,
  PacketStore,
} from '@core/contracts';
import type {
  PacketEnvelope,
  PacketEnvelopeByType,
  PacketReadMode,
  PacketRevisionRef,
} from '@core/schema/packet-schema';
import { createAssociationClaimPacket } from '@core/packets/claims';

import { PacketStoreBrowserQueryService } from './query-services.ts';

function createPacketStoreStub(input: {
  packet: PacketEnvelope;
}): PacketStore {
  const preferredRevision: PacketRevisionRef = {
    packet_id: input.packet.header.packet_id,
    revision_id: input.packet.header.revision_id,
  };
  const headStatus: PacketHeadStatus = {
    preferred_revision: preferredRevision,
    head_revisions: [preferredRevision],
    revision_state: 'linear',
  };

  return {
    validate: () => input.packet,
    writeRevision: async () => preferredRevision,
    publishRevision: async () => undefined,
    fetchByPacket: async () => input.packet,
    fetchByRevision: async () => input.packet,
    resolveRevisionRef: async () => preferredRevision,
    fetchPreferredRevision: async () => preferredRevision,
    listPreferredPacketsByType: async <TType extends PacketEnvelope['header']['type']>() =>
      [input.packet] as unknown as PacketEnvelopeByType[TType][],
    listPreferredPackets: async () => [input.packet],
    fetchRevisionHeads: async () => headStatus,
    queryEdges: async () => [],
    mergeRevisions: async () => preferredRevision,
    readByPacket: async <TMode extends PacketReadMode>() =>
      input.packet as PacketReadValue<TMode> | null,
    readByRevision: async <TMode extends PacketReadMode>() =>
      input.packet as PacketReadValue<TMode> | null,
    prepareRevisionForAdaptedSave: async () => null,
    prepareRevisionForVersionedSave: async () => null,
    writePreparedRevision: async () => preferredRevision,
    getPacketVerificationSummary: async () => null,
    listPacketVerificationSummaries: async () => [],
    writePacketVerificationSummary: async () => undefined,
    importBundle: async () => ({ packet_count: 0, revision_count: 0, edge_count: 0 }),
    exportBundle: async () => ({ bytes: new Uint8Array(), packet_count: 0, revision_count: 0 }),
  };
}

test('browser packet projection uses the shared packet title helper', async () => {
  const packet = createAssociationClaimPacket({
    claimKind: 'role_association',
    subjectPacketId: 'nexus:element/testy-mcgee',
    targetPacketId: 'nexus:role/coordinator',
    scopePacketId: 'nexus:element/global-commons',
    applicableScopeRefs: [{ packet_id: 'nexus:element/global-commons' }],
    createdByPacketId: 'nexus:element/testy-mcgee',
  });
  const browserQueryService = new PacketStoreBrowserQueryService(
    createPacketStoreStub({ packet })
  );

  const projection = await browserQueryService.getPacket({
    packet_id: packet.header.packet_id,
  });

  assert.equal(projection?.title, 'Relation Assertion claim');
});
