import assert from 'node:assert/strict';
import test from 'node:test';

import { createAssemblyPacket } from '@core/packets/builders';
import { createScopedRelationPacket } from '@core/packets/relations';

import { resolveScopeParentResolutions } from './scope-parent-resolution.ts';

test('scope parent resolution marks conflicting canonical parents explicitly', () => {
  const global = createAssemblyPacket({
    packet_id: 'nexus:element/global-commons',
    created_at: '2026-05-08T00:00:00.000Z',
    name: 'Global Commons',
    subtype: 'global',
    locality_label: 'Global',
  });
  const california = createAssemblyPacket({
    packet_id: 'nexus:element/california',
    created_at: '2026-05-08T00:01:00.000Z',
    name: 'California',
    subtype: 'state',
    locality_label: 'California',
  });
  const nevada = createAssemblyPacket({
    packet_id: 'nexus:element/nevada',
    created_at: '2026-05-08T00:02:00.000Z',
    name: 'Nevada',
    subtype: 'state',
    locality_label: 'Nevada',
  });
  const district = createAssemblyPacket({
    packet_id: 'nexus:element/test-district',
    created_at: '2026-05-08T00:03:00.000Z',
    name: 'Test District',
    subtype: 'district',
    locality_label: 'Test District',
  });
  const californiaParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: district.header.packet_id,
    targetPacketId: california.header.packet_id,
    scopePacketId: district.header.packet_id,
    applicableScopeRefs: [{ packet_id: california.header.packet_id }],
    createdByPacketId: global.header.packet_id,
  });
  const nevadaParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: district.header.packet_id,
    targetPacketId: nevada.header.packet_id,
    scopePacketId: district.header.packet_id,
    applicableScopeRefs: [{ packet_id: nevada.header.packet_id }],
    createdByPacketId: global.header.packet_id,
  });

  const resolutions = resolveScopeParentResolutions({
    scopePackets: [global, california, nevada, district],
    relationPackets: [californiaParent, nevadaParent],
  });
  const districtResolution = resolutions.get(district.header.packet_id);

  assert.ok(districtResolution);
  assert.equal(districtResolution?.parentPacketId, null);
  assert.equal(districtResolution?.structuralState, 'conflicting_parents');
  assert.deepEqual(
    districtResolution?.conflictParentPacketIds.sort(),
    [california.header.packet_id, nevada.header.packet_id].sort()
  );
});

test('scope parent resolution severs cyclic ancestry chains', () => {
  const alpha = createAssemblyPacket({
    packet_id: 'nexus:element/alpha',
    created_at: '2026-05-08T01:00:00.000Z',
    name: 'Alpha',
    subtype: 'city',
    locality_label: 'Alpha',
  });
  const beta = createAssemblyPacket({
    packet_id: 'nexus:element/beta',
    created_at: '2026-05-08T01:01:00.000Z',
    name: 'Beta',
    subtype: 'district',
    locality_label: 'Beta',
  });
  const alphaParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: alpha.header.packet_id,
    targetPacketId: beta.header.packet_id,
    scopePacketId: alpha.header.packet_id,
    applicableScopeRefs: [{ packet_id: beta.header.packet_id }],
    createdByPacketId: alpha.header.packet_id,
  });
  const betaParent = createScopedRelationPacket({
    subtype: 'default_ancestry_parent',
    subjectPacketId: beta.header.packet_id,
    targetPacketId: alpha.header.packet_id,
    scopePacketId: beta.header.packet_id,
    applicableScopeRefs: [{ packet_id: alpha.header.packet_id }],
    createdByPacketId: beta.header.packet_id,
  });

  const resolutions = resolveScopeParentResolutions({
    scopePackets: [alpha, beta],
    relationPackets: [alphaParent, betaParent],
  });

  assert.equal(
    resolutions.get(alpha.header.packet_id)?.structuralState,
    'cyclic_ancestry'
  );
  assert.equal(
    resolutions.get(beta.header.packet_id)?.structuralState,
    'cyclic_ancestry'
  );
  assert.equal(resolutions.get(alpha.header.packet_id)?.parentPacketId, null);
  assert.equal(resolutions.get(beta.header.packet_id)?.parentPacketId, null);
});
