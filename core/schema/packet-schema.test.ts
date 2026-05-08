import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPacketSignatureCanonicalCandidates,
  getRawPacketSignatureCanonicalCandidates,
  getPacketCompatibilityAuditSummary,
  listPacketCompatibilityAuditSummaries,
  inspectPacketEnvelope,
  inspectPacketEnvelopeForTarget,
  PacketCompatibilityError,
  preparePacketEnvelopeForAdaptedWrite,
  preparePacketEnvelopeForVersionedWrite,
  getPacketFamilyRevisionMode,
  parsePacketEnvelope,
} from './packet-schema.ts';

function requirePreparedPacket(preparedPacket: {
  prepared_packet: unknown;
}): asserts preparedPacket is {
  prepared_packet: {
    header: {
      schema_version: string;
    };
    body: unknown;
  };
} {
  assert.ok(preparedPacket.prepared_packet);
}

test('legacy element revisions upcast claimed_role_refs to an empty array', () => {
  const legacyPacket = {
    header: {
      packet_id: 'nexus:element/test-person',
      revision_id: 'nexus:element/test-person@r1',
      family: 'Element',
      schema_version: '0.9.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'person',
      name: 'Test Person',
      subtype: 'guest_identity',
      summary: null,
      locality_label: null,
      identity: null,
      tags: ['person'],
    },
  };
  const packet = parsePacketEnvelope(legacyPacket);
  const compatibilityRead = inspectPacketEnvelope(legacyPacket);

  assert.equal(packet.header.family, 'Element');
  assert.deepEqual(
    (
      packet as {
        body: { claimed_role_refs: { packet_id: string }[] };
      }
    ).body.claimed_role_refs,
    []
  );
  assert.equal(compatibilityRead.status.source_schema_version, '0.9.0');
  assert.equal(compatibilityRead.status.declared_schema_version, '0.9.0');
  assert.equal(compatibilityRead.status.effective_source_schema_version, '0.9.0');
  assert.equal(compatibilityRead.status.interpreted_as_legacy_profile, false);
  assert.equal(compatibilityRead.status.target_schema_version, '1.1.0');
  assert.equal(compatibilityRead.status.direction, 'upcast');
  assert.equal(compatibilityRead.status.is_lossy, false);
  assert.equal(compatibilityRead.status.supported_write_target, 'exact');
  assert.equal(compatibilityRead.status.writable_as_is, false);
  const changePaths = compatibilityRead.status.changes.map((change) => change.path);

  assert.equal(changePaths.includes('body.type'), true);
  assert.equal(changePaths.includes('body.claimed_role_refs'), true);
  assert.equal(changePaths.includes('body.locality'), true);
});

test('declared-current legacy element revisions still use the legacy compatibility profile', () => {
  const legacyCurrentPacket = {
    header: {
      packet_id: 'nexus:element/testy-misdeclared',
      revision_id: 'nexus:element/testy-misdeclared@r1',
      family: 'Element',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-11T02:49:48.397Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-11T02:49:48.397Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: ['person', 'claimed'],
        language: null,
        summary: 'A claimed OWA Nexus person identity.',
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'person',
      name: 'testy mcgee',
      subtype: 'claimed_identity',
      summary: 'A claimed OWA Nexus person identity.',
      locality_label: 'California',
      identity: {
        alias: 'testy mcgee',
        claim_status: 'claimed',
        location_disclosure: {
          scope: 'region',
          value: 'California',
        },
        public_key_bindings: [],
      },
      tags: ['person', 'claimed'],
    },
  };
  const compatibilityRead = inspectPacketEnvelope(legacyCurrentPacket);
  const preparedPacket = preparePacketEnvelopeForAdaptedWrite(legacyCurrentPacket);

  assert.equal(compatibilityRead.status.declared_schema_version, '1.0.0');
  assert.equal(compatibilityRead.status.effective_source_schema_version, '0.9.0');
  assert.equal(compatibilityRead.status.interpreted_as_legacy_profile, true);
  assert.equal(compatibilityRead.status.source_schema_version, '0.9.0');
  assert.equal(compatibilityRead.status.writable_as_is, false);
  const changePaths = compatibilityRead.status.changes.map((change) => change.path);

  assert.equal(changePaths.includes('body.type'), true);
  assert.equal(changePaths.includes('body.claimed_role_refs'), true);
  assert.equal(changePaths.includes('body.locality'), true);
  requirePreparedPacket(preparedPacket);
  assert.equal(preparedPacket.prepared_packet.header.schema_version, '1.1.0');
  assert.equal(preparedPacket.changes.length >= 3, true);
});

test('assembly element locality metadata is additive and optional', () => {
  const packet = parsePacketEnvelope({
    header: {
      packet_id: 'nexus:element/test-locality',
      revision_id: 'nexus:element/test-locality@r1',
      family: 'Element',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'assembly',
      name: 'Test District',
      subtype: 'district',
      summary: null,
      locality_label: 'Test District',
      locality: {
        level: 'district',
        canonical_name_key: 'test district',
        alias_keys: ['test'],
        display_aliases: ['Test'],
      },
      identity: null,
      tags: ['assembly', 'locality'],
      claimed_role_refs: [],
    },
  });

  assert.equal(packet.header.family, 'Element');
  assert.equal(
    (
      packet as {
        body: { locality: { level: string; canonical_name_key: string } | null };
      }
    ).body.locality?.canonical_name_key,
    'test district'
  );
});

test('legacy policy revisions upcast missing trust_policy to null', () => {
  const legacyPacket = {
    header: {
      packet_id: 'nexus:policy/test-policy',
      revision_id: 'nexus:policy/test-policy@r1',
      family: 'Policy',
      schema_version: '0.9.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      title: 'Test Policy',
      summary: null,
      policy_kind: 'trust_baseline',
      body_markdown: '# Test',
      status: 'active',
    },
  };
  const packet = parsePacketEnvelope(legacyPacket);
  const preparedPacket = preparePacketEnvelopeForAdaptedWrite(legacyPacket);

  assert.equal(packet.header.family, 'Policy');
  assert.equal(
    (
      packet as {
        body: { trust_policy: unknown };
      }
    ).body.trust_policy,
    null
  );
  requirePreparedPacket(preparedPacket);
  assert.equal(preparedPacket.prepared_packet.header.schema_version, '1.2.0');
  const changePaths = preparedPacket.changes.map((change) => change.path);

  assert.equal(changePaths.includes('body.trust_policy'), true);
  assert.equal(changePaths.includes('body.write_policy'), true);
  assert.equal(changePaths.includes('body.dependency_policy'), true);
  assert.equal(changePaths.includes('body.alignment_policy'), true);
  assert.equal(changePaths.includes('body.relation_requirements'), true);
  assert.equal(changePaths.includes('header.schema_version'), true);
});

test('current policy revisions treat write_policy as additive and optional', () => {
  const packet = parsePacketEnvelope({
    header: {
      packet_id: 'nexus:policy/test-write-lock',
      revision_id: 'nexus:policy/test-write-lock@r1',
      family: 'Policy',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      title: 'Write Lock',
      summary: null,
      policy_kind: 'write_lock',
      body_markdown: '# Test',
      status: 'active',
    },
  });

  assert.equal(packet.header.family, 'Policy');
  assert.equal(
    (packet as { body: { write_policy: unknown } }).body.write_policy,
    null
  );
});

test('current signature candidates preserve compatibility for additive current defaults', () => {
  const packet = parsePacketEnvelope({
    header: {
      packet_id: 'nexus:element/test-signature-compat',
      revision_id: 'nexus:element/test-signature-compat@r1',
      family: 'Element',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: ['person', 'claimed'],
        language: null,
        summary: 'A claimed OWA Nexus person identity.',
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'person',
      name: 'Test Person',
      subtype: 'claimed_identity',
      summary: 'A claimed OWA Nexus person identity.',
      locality_label: null,
      locality: null,
      identity: {
        alias: 'Test Person',
        claim_status: 'claimed',
        location_disclosure: null,
        public_key_bindings: [],
      },
      tags: ['person', 'claimed'],
      claimed_role_refs: [],
    },
  });
  const candidates = getPacketSignatureCanonicalCandidates(packet);

  assert.equal(candidates.length, 2);
  assert.equal(
    Object.prototype.hasOwnProperty.call(candidates[1]?.body ?? {}, 'claimed_role_refs'),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(candidates[1]?.body ?? {}, 'locality'),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(candidates[1]?.body ?? {}, 'type'),
    false
  );
});

test('raw signature candidates preserve omitted additive header fields and combined body compatibility', () => {
  const rawPacket = {
    header: {
      packet_id: 'nexus:element/test-raw-signature-compat',
      revision_id: 'nexus:element/test-raw-signature-compat@r1',
      family: 'Element',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-28T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-28T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: ['person', 'claimed'],
        language: null,
        summary: 'A claimed OWA Nexus person identity.',
        compatibility: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'person',
      name: 'Raw Compat',
      subtype: 'claimed_identity',
      summary: 'A claimed OWA Nexus person identity.',
      locality_label: null,
      locality: null,
      identity: {
        alias: 'Raw Compat',
        claim_status: 'claimed',
        location_disclosure: null,
        public_key_bindings: [],
      },
      tags: ['person', 'claimed'],
      claimed_role_refs: [],
    },
  };
  const candidates = getRawPacketSignatureCanonicalCandidates(rawPacket);

  assert.equal(candidates.length, 4);
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      (candidates[1]?.header.metadata as Record<string, unknown>) ?? {},
      'compatibility'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      candidates[2]?.body as Record<string, unknown>,
      'claimed_role_refs'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      candidates[3]?.body as Record<string, unknown>,
      'locality'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      (candidates[3]?.header.metadata as Record<string, unknown>) ?? {},
      'compatibility'
    ),
    false
  );
});

test('family metadata exposes revision modes and rejects unknown future schema versions', () => {
  assert.equal(getPacketFamilyRevisionMode('Attestation'), 'append_only');
  assert.equal(getPacketFamilyRevisionMode('Role'), 'replaceable');
  assert.equal(getPacketFamilyRevisionMode('Claim'), 'replaceable');

  assert.throws(() =>
    parsePacketEnvelope({
      header: {
        packet_id: 'nexus:role/test-role',
        revision_id: 'nexus:role/test-role@r1',
        family: 'Role',
        schema_version: '9.0.0',
        protocol_version: '0.1.0',
        created_at: '2026-04-17T00:00:00.000Z',
        parent_revision_refs: [],
        merge_strategy: null,
        authority_scope_ref: null,
        applicable_scope_refs: [],
        edges: [],
        provenance: {
          created_by: null,
          submitted_by: null,
          adapter: 'test',
          recorded_at: '2026-04-17T00:00:00.000Z',
          imported_from_revision: null,
        },
        integrity: {
          canonicalization: 'RFC8785',
          hash_alg: 'sha-256',
          digest: null,
          embedded_signatures: [],
          signature_refs: [],
        },
        moderation: {
          visibility: 'public',
          moderation_state: 'open',
          policy_refs: [],
          content_warning_ids: [],
        },
        external_refs: [],
        metadata: {
          tags: [],
          language: null,
          summary: null,
        },
        producer: {
          adapter: 'test',
          app_version: null,
        },
      },
      body: {
        title: 'Test Role',
        summary: null,
        role_kind: 'facilitator',
        status: 'active',
        responsibility_markdown: null,
      },
    })
  );
});

test('compatibility audit summaries classify legacy support and write preparation explicitly', () => {
  const summaries = listPacketCompatibilityAuditSummaries();

  assert.ok(summaries.length > 0);
  assert.equal(
    summaries.every((summary) => summary.supported_schema_versions.length > 0),
    true
  );

  const elementSummary = getPacketCompatibilityAuditSummary('Element');
  const claimSummary = getPacketCompatibilityAuditSummary('Claim');
  const policySummary = getPacketCompatibilityAuditSummary('Policy');

  assert.equal(elementSummary.support_level, 'legacy_supported');
  assert.equal(claimSummary.support_level, 'legacy_supported');
  assert.equal(policySummary.support_level, 'legacy_supported');
  assert.equal(elementSummary.has_legacy_versions, true);
  assert.equal(claimSummary.has_legacy_versions, true);
  assert.equal(policySummary.has_legacy_versions, true);
  assert.equal(elementSummary.write_target_policy, 'supported_versions');
  assert.equal(claimSummary.write_target_policy, 'supported_versions');
  assert.equal(policySummary.write_target_policy, 'supported_versions');
  assert.equal(elementSummary.has_write_preparation, true);
  assert.equal(claimSummary.has_write_preparation, true);
  assert.equal(policySummary.has_write_preparation, true);

  const discussionSummary = getPacketCompatibilityAuditSummary('Discussion');

  assert.equal(discussionSummary.support_level, 'legacy_supported');
  assert.equal(discussionSummary.has_legacy_versions, false);
  assert.equal(discussionSummary.write_target_policy, 'supported_versions');
  assert.deepEqual(discussionSummary.supported_schema_versions, ['1.0.0']);

  const discussionFamilies = [
    'DiscussionSpace',
    'DiscussionForum',
    'DiscussionThread',
    'DiscussionPost',
    'DiscussionReply',
  ] as const;

  for (const family of discussionFamilies) {
    const summary = getPacketCompatibilityAuditSummary(family);

    assert.equal(summary.support_level, 'current_only');
    assert.equal(summary.has_legacy_versions, false);
    assert.equal(summary.write_target_policy, 'current_only');
    assert.deepEqual(summary.supported_schema_versions, ['1.0.0']);
  }
});

test('claim packets parse with the new scoped association family', () => {
  const packet = parsePacketEnvelope({
    header: {
      packet_id: 'nexus:claim/role-association/test',
      revision_id: 'nexus:claim/role-association/test@r1',
      family: 'Claim',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: {
        packet_id: 'nexus:element/scope-a',
      },
      applicable_scope_refs: [
        {
          packet_id: 'nexus:element/scope-a',
        },
      ],
      edges: [],
      provenance: {
        created_by: {
          packet_id: 'nexus:element/person-a',
        },
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      claim_kind: 'role_association',
      subject_ref: {
        packet_id: 'nexus:element/person-a',
      },
      target_ref: {
        packet_id: 'nexus:role/facilitator',
      },
      scope_ref: {
        packet_id: 'nexus:element/scope-a',
      },
      status: 'active',
      note: 'Claiming facilitator in scope A.',
    },
  });

  assert.equal(packet.header.family, 'Claim');
  assert.equal(
    (packet as { body: { claim_kind: string } }).body.claim_kind,
    'role_association'
  );
});

test('cause, action, relation, and location packets parse with forward subtype semantics', () => {
  const baseHeader = {
    schema_version: '1.0.0',
    protocol_version: '0.1.0',
    created_at: '2026-05-07T00:00:00.000Z',
    parent_revision_refs: [],
    merge_strategy: null,
    authority_scope_ref: null,
    applicable_scope_refs: [],
    edges: [],
    provenance: {
      created_by: null,
      submitted_by: null,
      adapter: 'test',
      recorded_at: '2026-05-07T00:00:00.000Z',
      imported_from_revision: null,
    },
    integrity: {
      canonicalization: 'RFC8785',
      hash_alg: 'sha-256',
      digest: null,
      embedded_signatures: [],
      signature_refs: [],
    },
    moderation: {
      visibility: 'public',
      moderation_state: 'open',
      policy_refs: [],
      content_warning_ids: [],
    },
    external_refs: [],
    metadata: {
      tags: [],
      language: null,
      summary: null,
    },
    producer: {
      adapter: 'test',
      app_version: null,
    },
  };

  const cause = parsePacketEnvelope({
    header: {
      ...baseHeader,
      packet_id: 'nexus:cause/owa',
      revision_id: 'nexus:cause/owa@r1',
      family: 'Cause',
    },
    body: {
      type: 'cause',
      subtype: 'initiative',
      title: 'OWA',
      summary: 'Open World Assembly',
      status: 'active',
    },
  });
  const action = parsePacketEnvelope({
    header: {
      ...baseHeader,
      packet_id: 'nexus:action/rideshare-mission',
      revision_id: 'nexus:action/rideshare-mission@r1',
      family: 'Action',
    },
    body: {
      type: 'action',
      subtype: 'mission',
      title: 'Launch rideshare network',
      summary: null,
      status: 'planned',
    },
  });
  const relation = parsePacketEnvelope({
    header: {
      ...baseHeader,
      packet_id: 'nexus:relation/alice-follows-owa',
      revision_id: 'nexus:relation/alice-follows-owa@r1',
      family: 'Relation',
    },
    body: {
      type: 'relation',
      subtype: 'follows',
      subject_ref: {
        packet_id: 'nexus:element/alice',
      },
      target_ref: {
        packet_id: 'nexus:cause/owa',
      },
    },
  });
  const location = parsePacketEnvelope({
    header: {
      ...baseHeader,
      packet_id: 'nexus:location/mv-service-area',
      revision_id: 'nexus:location/mv-service-area@r1',
      family: 'Location',
    },
    body: {
      type: 'location',
      subtype: 'service_area',
      title: 'Moreno Valley service area',
      summary: null,
      status: 'active',
      spatial_payload: {
        provider: 'manual',
      },
    },
  });

  assert.equal(cause.header.family, 'Cause');
  assert.equal((cause.body as { subtype: string }).subtype, 'initiative');
  assert.equal(action.header.family, 'Action');
  assert.equal((action.body as { subtype: string }).subtype, 'mission');
  assert.equal(relation.header.family, 'Relation');
  assert.equal((relation.body as { subtype: string }).subtype, 'follows');
  assert.equal(location.header.family, 'Location');
  assert.equal((location.body as { subtype: string }).subtype, 'service_area');
});

test('raw packet inspection preserves the original stored body shape', () => {
  const legacyPacket = {
    header: {
      packet_id: 'nexus:claim/test-legacy-claim',
      revision_id: 'nexus:claim/test-legacy-claim@r1',
      family: 'Claim',
      schema_version: '0.9.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      claim_kind: 'assembly_association',
      subject_ref: {
        packet_id: 'nexus:element/person-a',
      },
      target_ref: {
        packet_id: 'nexus:element/scope-a',
      },
      scope_ref: {
        packet_id: 'nexus:element/scope-a',
      },
      status: 'active',
    },
  };
  const compatibilityRead = inspectPacketEnvelope(legacyPacket);

  assert.deepEqual(compatibilityRead.raw_packet, legacyPacket);
  assert.equal(
    (
      compatibilityRead.adapted_packet as {
        body: { note: string | null };
      }
    ).body.note,
    null
  );
});

test('current packets can be inspected against an older supported target schema version', () => {
  const currentPacket = {
    header: {
      packet_id: 'nexus:element/test-current-downcast',
      revision_id: 'nexus:element/test-current-downcast@r1',
      family: 'Element',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: ['person'],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'person',
      name: 'Current Person',
      subtype: 'guest_identity',
      summary: null,
      locality_label: null,
      locality: null,
      identity: null,
      tags: ['person'],
      claimed_role_refs: [],
    },
  };
  const compatibilityRead = inspectPacketEnvelopeForTarget(currentPacket, {
    target_schema_version: '0.9.0',
  });
  const preparedPacket = preparePacketEnvelopeForVersionedWrite(currentPacket, {
    target_schema_version: '0.9.0',
  });

  assert.equal(compatibilityRead.status.direction, 'downcast');
  assert.equal(compatibilityRead.status.target_schema_version, '0.9.0');
  assert.equal(compatibilityRead.status.is_exact, true);
  assert.equal(compatibilityRead.status.is_lossy, false);
  assert.equal(compatibilityRead.status.supported_write_target, 'exact');
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      compatibilityRead.adapted_packet.body as Record<string, unknown>,
      'claimed_role_refs'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      compatibilityRead.adapted_packet.body as Record<string, unknown>,
      'locality'
    ),
    false
  );
  assert.equal(
    Object.prototype.hasOwnProperty.call(
      compatibilityRead.adapted_packet.body as Record<string, unknown>,
      'type'
    ),
    false
  );
  requirePreparedPacket(preparedPacket);
  assert.equal(preparedPacket.prepared_packet.header.schema_version, '0.9.0');
  assert.equal(preparedPacket.supported_write_target, 'exact');
});

test('downcasting unsupported locality metadata reports a lossy adaptation', () => {
  const currentPacket = {
    header: {
      packet_id: 'nexus:element/test-lossy-downcast',
      revision_id: 'nexus:element/test-lossy-downcast@r1',
      family: 'Element',
      schema_version: '1.0.0',
      protocol_version: '0.1.0',
      created_at: '2026-04-17T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-04-17T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: ['assembly', 'locality'],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'assembly',
      name: 'Lossy Town',
      subtype: 'city',
      summary: null,
      locality_label: 'Lossy Town',
      locality: {
        level: 'city',
        canonical_name_key: 'lossy-town',
        alias_keys: ['lossy-town'],
        display_aliases: ['Lossy Town'],
      },
      identity: null,
      tags: ['assembly', 'locality'],
      claimed_role_refs: [],
    },
  };
  const compatibilityRead = inspectPacketEnvelopeForTarget(currentPacket, {
    target_schema_version: '0.9.0',
  });
  const preparedPacket = preparePacketEnvelopeForVersionedWrite(currentPacket, {
    target_schema_version: '0.9.0',
  });

  assert.equal(compatibilityRead.status.direction, 'downcast');
  assert.equal(compatibilityRead.status.is_lossy, true);
  assert.equal(compatibilityRead.status.requires_loss_acknowledgement, true);
  assert.equal(compatibilityRead.status.supported_write_target, 'lossy_allowed');
  assert.deepEqual(
    compatibilityRead.status.losses.map((loss) => loss.path),
    ['body.locality']
  );
  requirePreparedPacket(preparedPacket);
  assert.equal(preparedPacket.supported_write_target, 'lossy_allowed');
  assert.equal(preparedPacket.requires_loss_acknowledgement, true);
});

test('unsupported target schema requests fail with a structured compatibility error', () => {
  assert.throws(
    () =>
      inspectPacketEnvelopeForTarget({
        header: {
          packet_id: 'nexus:role/test-role-target',
          revision_id: 'nexus:role/test-role-target@r1',
          family: 'Role',
          schema_version: '1.0.0',
          protocol_version: '0.1.0',
          created_at: '2026-04-17T00:00:00.000Z',
          parent_revision_refs: [],
          merge_strategy: null,
          authority_scope_ref: null,
          applicable_scope_refs: [],
          edges: [],
          provenance: {
            created_by: null,
            submitted_by: null,
            adapter: 'test',
            recorded_at: '2026-04-17T00:00:00.000Z',
            imported_from_revision: null,
          },
          integrity: {
            canonicalization: 'RFC8785',
            hash_alg: 'sha-256',
            digest: null,
            embedded_signatures: [],
            signature_refs: [],
          },
          moderation: {
            visibility: 'public',
            moderation_state: 'open',
            policy_refs: [],
            content_warning_ids: [],
          },
          external_refs: [],
          metadata: {
            tags: [],
            language: null,
            summary: null,
          },
          producer: {
            adapter: 'test',
            app_version: null,
          },
        },
        body: {
          title: 'Test Role',
          summary: null,
          role_kind: 'facilitator',
          status: 'active',
          responsibility_markdown: null,
        },
      }, {
        target_schema_version: '0.9.0',
      }),
    (error: unknown) =>
      error instanceof PacketCompatibilityError &&
      error.code === 'unsupported_schema_version'
  );
});

test('current Claim packets parse with widened assertion fields while preserving legacy claim_kind compatibility', () => {
  const packet = parsePacketEnvelope({
    header: {
      packet_id: 'nexus:claim/home-locality/alice',
      revision_id: 'nexus:claim/home-locality/alice@r1',
      family: 'Claim',
      schema_version: '1.1.0',
      protocol_version: '0.1.0',
      created_at: '2026-05-07T00:00:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-05-07T00:00:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      type: 'claim',
      subtype: 'relation_assertion',
      target_ref: {
        packet_id: 'nexus:relation/home-locality/alice',
      },
      subject_ref: {
        packet_id: 'nexus:element/person/alice',
      },
      scope_ref: {
        packet_id: 'nexus:element/moreno-valley',
      },
      status: 'active',
      claim_markdown: 'Alice asserts a home-locality relation.',
      supporting_refs: [],
      relation_assertion: {
        subtype: 'home_locality',
        subject_ref: {
          packet_id: 'nexus:element/person/alice',
        },
        target_ref: {
          packet_id: 'nexus:element/moreno-valley',
        },
        scope_ref: {
          packet_id: 'nexus:element/moreno-valley',
        },
      },
      claim_kind: 'home_locality',
      note: null,
    },
  });

  assert.equal(packet.header.family, 'Claim');
  assert.equal(packet.body.subtype, 'relation_assertion');
  assert.equal(packet.body.relation_assertion?.subtype, 'home_locality');
  assert.equal(packet.body.claim_kind, 'home_locality');
});

test('current Attestation packets parse with canonical subtype semantics', () => {
  const packet = parsePacketEnvelope({
    header: {
      packet_id: 'nexus:attestation/claim-support/a',
      revision_id: 'nexus:attestation/claim-support/a@r1',
      family: 'Attestation',
      schema_version: '1.1.0',
      protocol_version: '0.1.0',
      created_at: '2026-05-07T00:01:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-05-07T00:01:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      type: 'attestation',
      subtype: 'claim_support',
      target_ref: {
        packet_id: 'nexus:claim/home-locality/alice',
      },
      value: 1,
      status: 'active',
      attestation_kind: 'claim_support',
      context_ref: null,
      supporting_refs: [],
      note: null,
      supersedes_ref: null,
    },
  });

  assert.equal(packet.header.family, 'Attestation');
  assert.equal(packet.body.subtype, 'claim_support');
  assert.equal(packet.body.attestation_kind, 'claim_support');
});

test('current Policy packets parse relation requirement rules for supporting claims', () => {
  const packet = parsePacketEnvelope({
    header: {
      packet_id: 'nexus:policy/owa-home-locality',
      revision_id: 'nexus:policy/owa-home-locality@r1',
      family: 'Policy',
      schema_version: '1.2.0',
      protocol_version: '0.1.0',
      created_at: '2026-05-07T00:02:00.000Z',
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: '2026-05-07T00:02:00.000Z',
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      title: 'OWA home locality relation policy',
      summary: null,
      policy_kind: 'charter',
      body_markdown: 'Require a supporting relation-assertion claim.',
      status: 'active',
      trust_policy: null,
      write_policy: null,
      dependency_policy: null,
      alignment_policy: null,
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
    },
  });

  assert.equal(packet.header.family, 'Policy');
  assert.equal(packet.body.relation_requirements?.rules.length, 1);
  assert.equal(
    packet.body.relation_requirements?.rules[0]?.relation_subtype,
    'home_locality'
  );
});
