import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import {
  createActionPacket,
  createAssemblyPacket,
  createPersonPacket,
  createPolicyPacket,
} from '@core/packets/builders';
import { createAssociationClaimPacket, createRelationAssertionClaimPacket } from '@core/packets/claims';
import { createScopedRelationPacket } from '@core/packets/relations';
import type { PacketEnvelope } from '@core/schema/packet-schema';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

import { buildNexusScopeGraphProjection } from './scope-graph.ts';

async function writePreferredPacket(
  packetStore: NodeSQLitePacketStore,
  packet: PacketEnvelope
) {
  await packetStore.writeRevision(packet);
  await packetStore.publishRevision({
    packet_id: packet.header.packet_id,
    revision_id: packet.header.revision_id,
  });
}

function createScopeGraphHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'owa-scope-graph-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-scope-graph.db'),
  });

  return {
    packetStore,
    cleanup() {
      packetStore.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

test('scope graph prefers canonical ancestry relations and projects packet-native home locality with support', async () => {
  const harness = createScopeGraphHarness();

  try {
    const global = createAssemblyPacket({
      packet_id: 'nexus:element/global-commons',
      created_at: '2026-05-08T00:00:00.000Z',
      name: 'Global Commons',
      subtype: 'global',
      summary: 'Global scope.',
      locality_label: 'Global',
    });
    const california = createAssemblyPacket({
      packet_id: 'nexus:element/california',
      created_at: '2026-05-08T00:01:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      name: 'California',
      subtype: 'state',
      locality_label: 'California',
    });
    const morenoValley = createAssemblyPacket({
      packet_id: 'nexus:element/moreno-valley',
      created_at: '2026-05-08T00:02:00.000Z',
      authority_scope_ref: { packet_id: california.header.packet_id },
      applicable_scope_refs: [
        { packet_id: california.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      edges: [{ edge_type: 'parent_scope', target: { packet_id: global.header.packet_id }, metadata: {} }],
      name: 'Moreno Valley',
      subtype: 'city',
      locality_label: 'Moreno Valley',
    });
    const sunnymead = createAssemblyPacket({
      packet_id: 'nexus:element/sunnymead-ranch',
      created_at: '2026-05-08T00:03:00.000Z',
      authority_scope_ref: { packet_id: morenoValley.header.packet_id },
      applicable_scope_refs: [
        { packet_id: morenoValley.header.packet_id },
        { packet_id: california.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      name: 'Sunnymead Ranch',
      subtype: 'neighborhood',
      locality_label: 'Sunnymead Ranch',
    });
    const followedScope = createAssemblyPacket({
      packet_id: 'nexus:element/remote-farm',
      created_at: '2026-05-08T00:04:00.000Z',
      name: 'Remote Farm',
      subtype: 'district',
      locality_label: 'Remote Farm',
    });
    const associatedScope = createAssemblyPacket({
      packet_id: 'nexus:element/canyon-lake',
      created_at: '2026-05-08T00:05:00.000Z',
      name: 'Canyon Lake',
      subtype: 'city',
      locality_label: 'Canyon Lake',
    });
    const actor = createPersonPacket({
      packet_id: 'nexus:element/aaron',
      created_at: '2026-05-08T00:06:00.000Z',
      authority_scope_ref: { packet_id: sunnymead.header.packet_id },
      applicable_scope_refs: [
        { packet_id: sunnymead.header.packet_id },
        { packet_id: morenoValley.header.packet_id },
        { packet_id: california.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      name: 'Aaron',
      subtype: 'resident',
      locality_label: 'Sunnymead Ranch',
    });
    const owaPolicy = createPolicyPacket({
      packet_id: 'nexus:policy/owa-home-locality',
      created_at: '2026-05-08T00:07:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      title: 'OWA home locality policy',
      subtype: 'charter',
      body_markdown: 'Require a relation assertion claim for home locality relations.',
      status: 'active',
      relation_requirements: {
        rules: [
          {
            relation_subtype: 'home_locality',
            required_claim_subtypes: ['relation_assertion'],
            required_attestation_subtypes: [],
            claim_target_mode: 'relation_packet',
            subject_match_mode: 'relation_subject',
          },
        ],
      },
    });
    const owaAction = createActionPacket({
      packet_id: 'nexus:action/initiative/owa',
      created_at: '2026-05-08T00:08:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      subtype: 'initiative',
      title: 'OWA',
      status: 'active',
      policy_refs: [{ packet_id: owaPolicy.header.packet_id }],
    });
    const californiaParent = createScopedRelationPacket({
      subtype: 'default_ancestry_parent',
      subjectPacketId: california.header.packet_id,
      targetPacketId: global.header.packet_id,
      scopePacketId: california.header.packet_id,
      applicableScopeRefs: [{ packet_id: global.header.packet_id }],
      createdByPacketId: global.header.packet_id,
    });
    const morenoParent = createScopedRelationPacket({
      subtype: 'default_ancestry_parent',
      subjectPacketId: morenoValley.header.packet_id,
      targetPacketId: california.header.packet_id,
      scopePacketId: morenoValley.header.packet_id,
      applicableScopeRefs: [
        { packet_id: california.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      createdByPacketId: global.header.packet_id,
    });
    const sunnymeadParent = createScopedRelationPacket({
      subtype: 'default_ancestry_parent',
      subjectPacketId: sunnymead.header.packet_id,
      targetPacketId: morenoValley.header.packet_id,
      scopePacketId: sunnymead.header.packet_id,
      applicableScopeRefs: [
        { packet_id: morenoValley.header.packet_id },
        { packet_id: california.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      createdByPacketId: global.header.packet_id,
    });
    const homeRelation = createScopedRelationPacket({
      subtype: 'home_locality',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: sunnymead.header.packet_id,
      scopePacketId: sunnymead.header.packet_id,
      applicableScopeRefs: [
        { packet_id: sunnymead.header.packet_id },
        { packet_id: morenoValley.header.packet_id },
        { packet_id: california.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      createdByPacketId: actor.header.packet_id,
    });
    const supportingClaim = createRelationAssertionClaimPacket({
      claimKind: 'home_locality',
      subjectPacketId: actor.header.packet_id,
      relationPacketId: homeRelation.header.packet_id,
      assertedTargetPacketId: sunnymead.header.packet_id,
      scopePacketId: sunnymead.header.packet_id,
      applicableScopeRefs: [
        { packet_id: sunnymead.header.packet_id },
        { packet_id: morenoValley.header.packet_id },
        { packet_id: california.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      createdByPacketId: actor.header.packet_id,
    });
    const associatedRelation = createScopedRelationPacket({
      subtype: 'association',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: associatedScope.header.packet_id,
      scopePacketId: associatedScope.header.packet_id,
      applicableScopeRefs: [{ packet_id: associatedScope.header.packet_id }],
      createdByPacketId: actor.header.packet_id,
    });
    const associatedClaim = createRelationAssertionClaimPacket({
      claimKind: 'association',
      subjectPacketId: actor.header.packet_id,
      relationPacketId: associatedRelation.header.packet_id,
      assertedTargetPacketId: associatedScope.header.packet_id,
      scopePacketId: associatedScope.header.packet_id,
      applicableScopeRefs: [{ packet_id: associatedScope.header.packet_id }],
      createdByPacketId: actor.header.packet_id,
      note: 'Associated here too.',
    });

    for (const packet of [
      global,
      california,
      morenoValley,
      sunnymead,
      followedScope,
      associatedScope,
      actor,
      owaPolicy,
      owaAction,
      californiaParent,
      morenoParent,
      sunnymeadParent,
      homeRelation,
      supportingClaim,
      associatedRelation,
      associatedClaim,
    ]) {
      await writePreferredPacket(harness.packetStore, packet);
    }

    const graph = await buildNexusScopeGraphProjection({
      packetStore: harness.packetStore,
      actorPacketId: actor.header.packet_id,
      followedScopeIds: ['remote-farm'],
    });
    const morenoNode = graph.nodes.find((node) => node.packetId === morenoValley.header.packet_id);

    assert.equal(morenoNode?.parentRouteId, 'california');
    assert.equal(graph.homeScopeId, 'sunnymead-ranch');
    assert.equal(graph.effectiveHomeLocality?.source, 'canonical_relation');
    assert.equal(graph.followedScopeIds.has('remote-farm'), true);
    assert.equal(graph.associatedScopeIds.has('canyon-lake'), true);
    assert.equal(graph.mountedScopeIds.has('canyon-lake'), true);
    assert.equal(graph.mountedScopeIds.has('global-commons'), true);
    assert.equal(graph.mountedScopeIds.has('california'), true);
    assert.equal(graph.mountedScopeIds.has('moreno-valley'), true);
    assert.equal(graph.mountedScopeIds.has('sunnymead-ranch'), true);
    assert.equal(
      graph.associationKindByRouteId.get('canyon-lake'),
      'canonical_relation_assertion'
    );
    assert.deepEqual(
      graph.mountReasonsByScopeId.get('canyon-lake'),
      ['global_default', 'associated']
    );
    assert.deepEqual(
      graph.justificationPacketIdsByScopeId.get('sunnymead-ranch'),
      [homeRelation.header.packet_id, supportingClaim.header.packet_id]
    );
    assert.deepEqual(
      graph.justificationPacketIdsByScopeId.get('canyon-lake'),
      [associatedRelation.header.packet_id, associatedClaim.header.packet_id]
    );
  } finally {
    harness.cleanup();
  }
});

test('scope graph keeps canonical association projection when the supporting claim also matches compatibility filters', async () => {
  const harness = createScopeGraphHarness();

  try {
    const global = createAssemblyPacket({
      packet_id: 'nexus:element/global-commons',
      created_at: '2026-05-08T02:00:00.000Z',
      name: 'Global Commons',
      subtype: 'global',
      locality_label: 'Global',
    });
    const scope = createAssemblyPacket({
      packet_id: 'nexus:element/canyon-lake',
      created_at: '2026-05-08T02:01:00.000Z',
      name: 'Canyon Lake',
      subtype: 'city',
      locality_label: 'Canyon Lake',
    });
    const actor = createPersonPacket({
      packet_id: 'nexus:element/aaron',
      created_at: '2026-05-08T02:02:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      name: 'Aaron',
      subtype: 'resident',
      locality_label: 'Aaron',
    });
    const canonicalRelation = createScopedRelationPacket({
      subtype: 'association',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: scope.header.packet_id,
      scopePacketId: scope.header.packet_id,
      applicableScopeRefs: [{ packet_id: scope.header.packet_id }],
      createdByPacketId: actor.header.packet_id,
    });
    const canonicalClaim = createRelationAssertionClaimPacket({
      claimKind: 'association',
      subjectPacketId: actor.header.packet_id,
      relationPacketId: canonicalRelation.header.packet_id,
      assertedTargetPacketId: scope.header.packet_id,
      scopePacketId: scope.header.packet_id,
      applicableScopeRefs: [{ packet_id: scope.header.packet_id }],
      createdByPacketId: actor.header.packet_id,
    });
    for (const packet of [
      global,
      scope,
      actor,
      canonicalRelation,
      canonicalClaim,
    ]) {
      await writePreferredPacket(harness.packetStore, packet);
    }

    const graph = await buildNexusScopeGraphProjection({
      packetStore: harness.packetStore,
      actorPacketId: actor.header.packet_id,
      followedScopeIds: [],
    });

    assert.equal(graph.associatedScopeIds.has('canyon-lake'), true);
    assert.equal(
      graph.associationKindByRouteId.get('canyon-lake'),
      'canonical_relation_assertion'
    );
    assert.deepEqual(
      graph.justificationPacketIdsByScopeId.get('canyon-lake'),
      [canonicalRelation.header.packet_id, canonicalClaim.header.packet_id]
    );
  } finally {
    harness.cleanup();
  }
});

test('scope graph falls back to explicit legacy home-locality compatibility when no canonical relation exists', async () => {
  const harness = createScopeGraphHarness();

  try {
    const global = createAssemblyPacket({
      packet_id: 'nexus:element/global-commons',
      created_at: '2026-05-08T01:00:00.000Z',
      name: 'Global Commons',
      subtype: 'global',
      locality_label: 'Global',
    });
    const morenoValley = createAssemblyPacket({
      packet_id: 'nexus:element/moreno-valley',
      created_at: '2026-05-08T01:01:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      edges: [{ edge_type: 'parent_scope', target: { packet_id: global.header.packet_id }, metadata: {} }],
      name: 'Moreno Valley',
      subtype: 'city',
      locality_label: 'Moreno Valley',
    });
    const actor = createPersonPacket({
      packet_id: 'nexus:element/aaron',
      created_at: '2026-05-08T01:02:00.000Z',
      name: 'Aaron',
      subtype: 'resident',
    });
    const legacyClaim = createAssociationClaimPacket({
      claimKind: 'home_locality',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: morenoValley.header.packet_id,
      scopePacketId: morenoValley.header.packet_id,
      applicableScopeRefs: [{ packet_id: global.header.packet_id }],
      createdByPacketId: actor.header.packet_id,
    });

    for (const packet of [global, morenoValley, actor, legacyClaim]) {
      await writePreferredPacket(harness.packetStore, packet);
    }

    const graph = await buildNexusScopeGraphProjection({
      packetStore: harness.packetStore,
      actorPacketId: actor.header.packet_id,
      followedScopeIds: [],
    });

    assert.equal(
      graph.effectiveHomeLocality?.source,
      'legacy_home_locality_claim_compatibility'
    );
    assert.equal(graph.effectiveHomeLocality?.compatibilityClaimPacketId, legacyClaim.header.packet_id);
    assert.equal(graph.homeScopeId, 'moreno-valley');
  } finally {
    harness.cleanup();
  }
});

test('scope graph does not let legacy home-locality compatibility bypass an unsatisfied canonical relation policy', async () => {
  const harness = createScopeGraphHarness();

  try {
    const global = createAssemblyPacket({
      packet_id: 'nexus:element/global-commons',
      created_at: '2026-05-08T02:00:00.000Z',
      name: 'Global Commons',
      subtype: 'global',
      locality_label: 'Global',
    });
    const morenoValley = createAssemblyPacket({
      packet_id: 'nexus:element/moreno-valley',
      created_at: '2026-05-08T02:01:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      edges: [{ edge_type: 'parent_scope', target: { packet_id: global.header.packet_id }, metadata: {} }],
      name: 'Moreno Valley',
      subtype: 'city',
      locality_label: 'Moreno Valley',
    });
    const actor = createPersonPacket({
      packet_id: 'nexus:element/aaron',
      created_at: '2026-05-08T02:02:00.000Z',
      authority_scope_ref: { packet_id: morenoValley.header.packet_id },
      applicable_scope_refs: [
        { packet_id: morenoValley.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      name: 'Aaron',
      subtype: 'resident',
    });
    const owaPolicy = createPolicyPacket({
      packet_id: 'nexus:policy/owa-home-locality',
      created_at: '2026-05-08T02:03:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      title: 'OWA home locality policy',
      subtype: 'charter',
      body_markdown: 'Require a supporting relation assertion claim.',
      status: 'active',
      relation_requirements: {
        rules: [
          {
            relation_subtype: 'home_locality',
            required_claim_subtypes: ['relation_assertion'],
            required_attestation_subtypes: [],
            claim_target_mode: 'relation_packet',
            subject_match_mode: 'relation_subject',
          },
        ],
      },
    });
    const owaAction = createActionPacket({
      packet_id: 'nexus:action/initiative/owa',
      created_at: '2026-05-08T02:04:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      subtype: 'initiative',
      title: 'OWA',
      status: 'active',
      policy_refs: [{ packet_id: owaPolicy.header.packet_id }],
    });
    const canonicalHomeRelation = createScopedRelationPacket({
      subtype: 'home_locality',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: morenoValley.header.packet_id,
      scopePacketId: morenoValley.header.packet_id,
      applicableScopeRefs: [
        { packet_id: morenoValley.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      createdByPacketId: actor.header.packet_id,
    });
    const legacyHomeClaim = createAssociationClaimPacket({
      claimKind: 'home_locality',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: morenoValley.header.packet_id,
      scopePacketId: morenoValley.header.packet_id,
      applicableScopeRefs: [
        { packet_id: morenoValley.header.packet_id },
        { packet_id: global.header.packet_id },
      ],
      createdByPacketId: actor.header.packet_id,
    });

    for (const packet of [
      global,
      morenoValley,
      actor,
      owaPolicy,
      owaAction,
      canonicalHomeRelation,
      legacyHomeClaim,
    ]) {
      await writePreferredPacket(harness.packetStore, packet);
    }

    const graph = await buildNexusScopeGraphProjection({
      packetStore: harness.packetStore,
      actorPacketId: actor.header.packet_id,
      followedScopeIds: [],
    });

    assert.equal(graph.homeScopeId, null);
    assert.equal(graph.effectiveHomeLocality, null);
    assert.equal(graph.mountedScopeIds.has('moreno-valley'), true);
  } finally {
    harness.cleanup();
  }
});

test('scope graph does not silently fall back to legacy home-locality compatibility when a canonical relation exists but fails policy', async () => {
  const harness = createScopeGraphHarness();

  try {
    const global = createAssemblyPacket({
      packet_id: 'nexus:element/global-commons',
      created_at: '2026-05-08T02:00:00.000Z',
      name: 'Global Commons',
      subtype: 'global',
      locality_label: 'Global',
    });
    const morenoValley = createAssemblyPacket({
      packet_id: 'nexus:element/moreno-valley',
      created_at: '2026-05-08T02:01:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      name: 'Moreno Valley',
      subtype: 'city',
      locality_label: 'Moreno Valley',
    });
    const actor = createPersonPacket({
      packet_id: 'nexus:element/aaron',
      created_at: '2026-05-08T02:02:00.000Z',
      name: 'Aaron',
      subtype: 'resident',
    });
    const owaPolicy = createPolicyPacket({
      packet_id: 'nexus:policy/owa-home-locality',
      created_at: '2026-05-08T02:03:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      title: 'OWA home locality policy',
      subtype: 'charter',
      body_markdown: 'Require a relation assertion claim for home locality relations.',
      status: 'active',
      relation_requirements: {
        rules: [
          {
            relation_subtype: 'home_locality',
            required_claim_subtypes: ['relation_assertion'],
            required_attestation_subtypes: [],
            claim_target_mode: 'relation_packet',
            subject_match_mode: 'relation_subject',
          },
        ],
      },
    });
    const owaAction = createActionPacket({
      packet_id: 'nexus:action/initiative/owa',
      created_at: '2026-05-08T02:04:00.000Z',
      authority_scope_ref: { packet_id: global.header.packet_id },
      applicable_scope_refs: [{ packet_id: global.header.packet_id }],
      subtype: 'initiative',
      title: 'OWA',
      status: 'active',
      policy_refs: [{ packet_id: owaPolicy.header.packet_id }],
    });
    const homeRelation = createScopedRelationPacket({
      subtype: 'home_locality',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: morenoValley.header.packet_id,
      scopePacketId: morenoValley.header.packet_id,
      applicableScopeRefs: [{ packet_id: global.header.packet_id }],
      createdByPacketId: actor.header.packet_id,
    });
    const legacyClaim = createAssociationClaimPacket({
      claimKind: 'home_locality',
      subjectPacketId: actor.header.packet_id,
      targetPacketId: morenoValley.header.packet_id,
      scopePacketId: morenoValley.header.packet_id,
      applicableScopeRefs: [{ packet_id: global.header.packet_id }],
      createdByPacketId: actor.header.packet_id,
    });

    for (const packet of [global, morenoValley, actor, owaPolicy, owaAction, homeRelation, legacyClaim]) {
      await writePreferredPacket(harness.packetStore, packet);
    }

    const graph = await buildNexusScopeGraphProjection({
      packetStore: harness.packetStore,
      actorPacketId: actor.header.packet_id,
      followedScopeIds: [],
    });

    assert.equal(graph.effectiveHomeLocality, null);
    assert.equal(graph.homeScopeId, null);
  } finally {
    harness.cleanup();
  }
});
