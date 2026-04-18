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
