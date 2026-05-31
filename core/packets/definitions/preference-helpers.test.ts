/**
 * File: preference-helpers.test.ts
 * Description: Tests for Preference.element and Preference.node builders, projection, compatibility helpers, and canonical schema alignment.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  ElementPreferenceBodySchema as CanonicalElementPreferenceBodySchema,
  NodePreferenceBodySchema as CanonicalNodePreferenceBodySchema,
} from '@core/schema/packet-body-schemas';
import {
  ElementPreferenceBodySchema as DefinitionElementPreferenceBodySchema,
  NodePreferenceBodySchema as DefinitionNodePreferenceBodySchema,
  preferencePacketDefinition,
} from './preference.ts';
import {
  buildElementPreferenceBody,
  buildNodePreferenceBody,
  createElementPreferenceContextKey,
  createElementPreferencePacketId,
  createNodePreferencePacketId,
  downcastScopeDisplayPreferenceValueToLegacyV0,
  normalizeNodePreferenceValue,
  normalizeScopeDisplayPreferenceValue,
  normalizeShellChromePreferenceValue,
  projectLatestActiveNodePreference,
  projectLatestActiveScopeDisplayPreference,
  upcastLegacyScopeDisplayPreferenceValueV0,
} from './preference-helpers.ts';

test('Preference.element builder normalizes current runtime preference shape', () => {
  const body = buildElementPreferenceBody({
    owner_ref: { packet_id: 'nexus:element/person/alice' },
    value: {
      main_visible_scope_packet_ids: [
        'nexus:element/locality/city/example',
        ' nexus:element/locality/state/example ',
        'nexus:element/locality/city/example',
      ],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    },
  });

  assert.equal(body.subtype, 'element');
  assert.equal(body.subtype, 'element');
  assert.equal(body.status, 'active');
  assert.equal(body.privacy, 'private_sync');
  assert.deepEqual(body.value.interface.scope_display.main_visible_scope_packet_ids, [
    'nexus:element/locality/city/example',
    'nexus:element/locality/state/example',
  ]);
  assert.deepEqual(body.value.interface.shell_chrome, {
    navigation_mode: 'function',
    theme_mode: 'dark',
    ui_density: 'small',
  });
});

test('Preference.element defaults match current runtime element defaults', () => {
  assert.deepEqual(normalizeScopeDisplayPreferenceValue({}), {
    main_visible_scope_packet_ids: [],
    show_associated_parent_chains: true,
    show_followed_parent_chains: true,
  });
  assert.deepEqual(normalizeShellChromePreferenceValue({}), {
    navigation_mode: 'function',
    theme_mode: 'dark',
    ui_density: 'small',
  });
});

test('Preference.element accepts the prepared interface shell chrome section', () => {
  const body = buildElementPreferenceBody({
    owner_ref: { packet_id: 'nexus:element/person/alice' },
    value: {},
    shell_chrome: {
      navigation_mode: 'scope',
      theme_mode: 'light',
      ui_density: 'large',
    },
  });

  assert.deepEqual(body.value.interface.shell_chrome, {
    navigation_mode: 'scope',
    theme_mode: 'light',
    ui_density: 'large',
  });
});

test('Preference.element derives deterministic context key and packet id', () => {
  const context = {
    namespace: 'nexus',
    surface_key: 'sidebar',
  };

  assert.equal(
    createElementPreferenceContextKey(context),
    'nexus|||sidebar|'
  );
  assert.match(
    createElementPreferencePacketId({
      owner_ref: { packet_id: 'nexus:element/person/alice' },
      context,
    }),
    /^nexus:preference\/element\//
  );
});

test('Preference.element latest-active projection selects the newest matching active body', () => {
  const owner_ref = { packet_id: 'nexus:element/person/alice' };
  const older = buildElementPreferenceBody({
    owner_ref,
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/older'],
    },
  });
  const newer = buildElementPreferenceBody({
    owner_ref,
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/newer'],
    },
  });
  const otherOwner = buildElementPreferenceBody({
    owner_ref: { packet_id: 'nexus:element/person/bob' },
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/bob'],
    },
  });

  const projected = projectLatestActiveScopeDisplayPreference({
    owner_ref,
    records: [
      { body: newer, recorded_at: '2026-01-02T00:00:00.000Z' },
      { body: older, recorded_at: '2026-01-01T00:00:00.000Z' },
      { body: otherOwner, recorded_at: '2026-01-03T00:00:00.000Z' },
    ],
  });

  assert.deepEqual(projected?.value.interface.scope_display.main_visible_scope_packet_ids, [
    'nexus:element/locality/city/newer',
  ]);
});

test('Preference.element compatibility helpers upcast and loss-aware downcast legacy values', () => {
  const upcast = upcastLegacyScopeDisplayPreferenceValueV0({
    main_scope_ids: ['nexus:element/a', 'nexus:element/a', ' nexus:element/b '],
    show_parent_chains: false,
  });

  assert.deepEqual(upcast.loss_notes, []);
  assert.deepEqual(upcast.value, {
    main_visible_scope_packet_ids: ['nexus:element/a', 'nexus:element/b'],
    show_associated_parent_chains: false,
    show_followed_parent_chains: false,
  });

  const downcast = downcastScopeDisplayPreferenceValueToLegacyV0({
    main_visible_scope_packet_ids: ['nexus:element/a'],
    show_associated_parent_chains: true,
    show_followed_parent_chains: false,
  });

  assert.equal(downcast.value.show_parent_chains, false);
  assert.equal(downcast.loss_notes.length, 1);
});

test('Preference.element definition schema stays aligned with canonical packet body schema', () => {
  const body = buildElementPreferenceBody({
    owner_ref: { packet_id: 'nexus:element/person/alice' },
    context: {
      namespace: 'nexus',
      surface_key: 'shell',
    },
    value: {
      main_visible_scope_packet_ids: [
        'nexus:element/locality/state/example',
        'nexus:element/locality/city/example',
        'nexus:element/locality/city/example',
      ],
      show_associated_parent_chains: false,
      show_followed_parent_chains: true,
    },
  });

  const definitionParsed = DefinitionElementPreferenceBodySchema.parse(body);
  const canonicalParsed = CanonicalElementPreferenceBodySchema.parse(body);

  assert.deepEqual(canonicalParsed, definitionParsed);
  assert.deepEqual(canonicalParsed.value.interface.scope_display, {
    main_visible_scope_packet_ids: [
      'nexus:element/locality/city/example',
      'nexus:element/locality/state/example',
    ],
    show_associated_parent_chains: false,
    show_followed_parent_chains: true,
  });
});


test('Preference.node builder normalizes node-owned definition and trust defaults', () => {
  const body = buildNodePreferenceBody({
    owner_ref: { packet_id: 'nexus:element/node/local-dev' },
    value: {
      definitions: {
        active_definition_profile_ref: {
          packet_id: 'nexus:bundle/definition-profile/default',
        },
      },
      trust_graph: {
        trusted_node_refs: [
          { packet_id: 'nexus:element/node/railway' },
        ],
        trusted_node_attestation_refs: [
          { packet_id: 'nexus:reaction/node-trust/railway' },
        ],
      },
    },
  });

  assert.equal(body.subtype, 'node');
  assert.equal(body.privacy, 'sealed_private');
  assert.equal(body.value.definitions.update_mode, 'manual_review');
  assert.equal(body.value.import_verification.unknown_signer_mode, 'quarantine');
  assert.equal(body.value.storage_cleanup.cleanup_mode, 'manual');
  assert.deepEqual(body.value.trust_graph.trusted_node_refs, [
    { packet_id: 'nexus:element/node/railway' },
  ]);
});

test('Preference.node derives deterministic packet id under the node subtype', () => {
  assert.match(
    createNodePreferencePacketId({
      owner_ref: { packet_id: 'nexus:element/node/local-dev' },
      context: { namespace: 'nexus', surface_key: 'runtime' },
    }),
    /^nexus:preference\/node\//
  );
});

test('Preference.node latest-active projection selects the newest matching active body', () => {
  const owner_ref = { packet_id: 'nexus:element/node/local-dev' };
  const older = buildNodePreferenceBody({
    owner_ref,
    value: {
      import_verification: {
        unknown_signer_mode: 'advisory',
      },
    },
  });
  const newer = buildNodePreferenceBody({
    owner_ref,
    value: {
      import_verification: {
        unknown_signer_mode: 'block',
      },
    },
  });
  const otherOwner = buildNodePreferenceBody({
    owner_ref: { packet_id: 'nexus:element/node/other' },
    value: {
      import_verification: {
        unknown_signer_mode: 'accept_after_verification',
      },
    },
  });

  const projected = projectLatestActiveNodePreference({
    owner_ref,
    records: [
      { body: newer, recorded_at: '2026-01-02T00:00:00.000Z' },
      { body: older, recorded_at: '2026-01-01T00:00:00.000Z' },
      { body: otherOwner, recorded_at: '2026-01-03T00:00:00.000Z' },
    ],
  });

  assert.equal(projected?.value.import_verification.unknown_signer_mode, 'block');
});

test('Preference.node definition schema stays aligned with canonical packet body schema', () => {
  const body = buildNodePreferenceBody({
    owner_ref: { packet_id: 'nexus:element/node/local-dev' },
    context: {
      namespace: 'nexus',
      surface_key: 'runtime',
    },
    value: normalizeNodePreferenceValue({
      definitions: {
        active_definition_profile_ref: {
          packet_id: 'nexus:bundle/definition-profile/default',
        },
        trusted_definition_profile_refs: [
          { packet_id: 'nexus:bundle/definition-profile/default' },
        ],
      },
      trust_graph: {
        trusted_node_attestation_refs: [
          { packet_id: 'nexus:reaction/node-trust/railway' },
        ],
      },
    }),
  });

  const definitionParsed = DefinitionNodePreferenceBodySchema.parse(body);
  const canonicalParsed = CanonicalNodePreferenceBodySchema.parse(body);

  assert.deepEqual(canonicalParsed, definitionParsed);
  assert.equal(canonicalParsed.value.definitions.update_mode, 'manual_review');
  assert.equal(canonicalParsed.value.trust_graph.minimum_import_trust_level, 'trusted');
});

test('Preference definition declares node as an official packet subtype with definition parts', () => {
  assert.ok(preferencePacketDefinition.declared_subtypes.includes('node'));
  assert.ok(
    preferencePacketDefinition.actions.some(
      (action) => action.action_id === 'preference.node.create'
    )
  );
  assert.ok(
    preferencePacketDefinition.packet_definition_parts.some(
      (part) => part.part_id === 'preference.node.packet_definition.v0'
    )
  );
});
