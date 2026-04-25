import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPacketSignatureCanonicalCandidates,
  inspectPacketEnvelope,
  preparePacketEnvelopeForAdaptedWrite,
  getPacketFamilyRevisionMode,
  parsePacketEnvelope,
} from './packet-schema.ts';

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
  assert.equal(compatibilityRead.status.target_schema_version, '1.0.0');
  assert.equal(compatibilityRead.status.writable_as_is, false);
  assert.deepEqual(
    compatibilityRead.status.changes.map((change) => change.path),
    ['body.claimed_role_refs', 'body.locality']
  );
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
  assert.deepEqual(
    compatibilityRead.status.changes.map((change) => change.path),
    ['body.claimed_role_refs', 'body.locality']
  );
  assert.equal(preparedPacket.prepared_packet.header.schema_version, '1.0.0');
  assert.deepEqual(
    preparedPacket.changes.map((change) => change.kind),
    ['added_default_field', 'added_default_field']
  );
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
  assert.equal(preparedPacket.prepared_packet.header.schema_version, '1.0.0');
  assert.deepEqual(
    preparedPacket.changes.map((change) => change.kind),
    ['normalized_null_default', 'schema_version_bump']
  );
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
