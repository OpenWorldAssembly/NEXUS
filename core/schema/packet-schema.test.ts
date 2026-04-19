import test from 'node:test';
import assert from 'node:assert/strict';

import {
  getPacketFamilyRevisionMode,
  parsePacketEnvelope,
} from './packet-schema.ts';

test('legacy element revisions upcast claimed_role_refs to an empty array', () => {
  const packet = parsePacketEnvelope({
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
  });

  assert.equal(packet.header.family, 'Element');
  assert.deepEqual(
    (
      packet as {
        body: { claimed_role_refs: { packet_id: string }[] };
      }
    ).body.claimed_role_refs,
    []
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
  const packet = parsePacketEnvelope({
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
  });

  assert.equal(packet.header.family, 'Policy');
  assert.equal(
    (
      packet as {
        body: { trust_policy: unknown };
      }
    ).body.trust_policy,
    null
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
