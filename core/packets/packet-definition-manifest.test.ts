/**
 * File: packet-definition-manifest.test.ts
 * Description: Regression coverage for the experimental packet definition manifest and shadow-mode packet schemas.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BundleBodySchema,
  CompatibilityBodySchema,
  PACKET_MANIFEST_TEMPLATE_VERSION,
  PACKET_DEFINITION_MANIFEST,
  PreferenceBodySchema,
  derivePacketDefinitionActionKinds,
  getExperimentalPacketTypeDefinition,
  getPacketDefinitionSectionStatus,
  listExperimentalPacketActions,
  listExperimentalPacketBuilders,
  listExperimentalPacketMutations,
  listExperimentalPacketPlanners,
  listExperimentalPacketTypeDefinitions,
  listPacketManifestTemplateSections,
  validatePacketDefinitionTemplateCompliance,
} from '@core/packets/packet-definition-manifest';

test('experimental manifest exposes Preference, Bundle, and Compatibility packet types', () => {
  const packetTypes = listExperimentalPacketTypeDefinitions().map(
    (definition) => definition.packet_type
  );

  assert.deepEqual(packetTypes.sort(), ['Bundle', 'Compatibility', 'Preference']);
  assert.equal(PACKET_DEFINITION_MANIFEST.manifest_type, 'packet_definition_manifest');
  assert.equal(PACKET_DEFINITION_MANIFEST.template_version, PACKET_MANIFEST_TEMPLATE_VERSION);
  assert.ok(PACKET_DEFINITION_MANIFEST.items.every((item) => item.action_count > 0));
  assert.ok(PACKET_DEFINITION_MANIFEST.items.every((item) => item.builder_count > 0));
  assert.ok(PACKET_DEFINITION_MANIFEST.items.every((item) => item.planner_count > 0));
  assert.ok(
    PACKET_DEFINITION_MANIFEST.items.every((item) => item.action_kinds.length > 0)
  );
});

test('Preference.scope_display can represent current shell scope display preferences', () => {
  const parsed = PreferenceBodySchema.parse({
    owner_ref: { packet_id: 'nexus:element/person/alice' },
    subtype: 'scope_display',
    value: {
      main_visible_scope_packet_ids: ['nexus:element/locality/city/example'],
      show_associated_parent_chains: true,
      show_followed_parent_chains: false,
    },
  });

  assert.equal(parsed.type, 'preference');
  assert.equal(parsed.privacy, 'private_sync');
  assert.deepEqual(parsed.value.main_visible_scope_packet_ids, [
    'nexus:element/locality/city/example',
  ]);
});

test('Compatibility packet supports nearest-current two-way adapter metadata', () => {
  const parsed = CompatibilityBodySchema.parse({
    packet_type: 'Preference',
    packet_subtype: 'scope_display',
    current_schema_version: '0.2.0',
    supported_schema_versions: ['0.1.0', '0.2.0'],
    nearest_current_steps: [
      {
        adapter_id: 'preference.scope_display.0_1_to_0_2',
        source_packet_type: 'Preference',
        source_packet_subtype: 'scope_display',
        source_schema_version: '0.1.0',
        target_packet_type: 'Preference',
        target_packet_subtype: 'scope_display',
        target_schema_version: '0.2.0',
        direction: 'bidirectional_neighbor',
      },
    ],
  });

  assert.equal(parsed.nearest_current_steps[0].direction, 'bidirectional_neighbor');
});

test('Bundle packet can carry compatibility-chain transport metadata', () => {
  const parsed = BundleBodySchema.parse({
    subtype: 'compatibility_bundle',
    title: 'Preference compatibility bundle',
    purpose: 'Transport full adapter chain for Preference.scope_display.',
    compatibility_chains: [
      {
        packet_type: 'Preference',
        packet_subtype: 'scope_display',
        current_schema_version: '0.2.0',
        known_schema_versions: ['0.1.0', '0.2.0'],
        adapter_packet_refs: [{ packet_id: 'nexus:compatibility/preference/scope-display/0-1-0-2' }],
      },
    ],
  });

  assert.equal(parsed.type, 'bundle');
  assert.equal(parsed.compatibility_chains[0].packet_type, 'Preference');
});

test('manifest lookup returns null for packet types not enrolled in shadow mode', () => {
  assert.equal(getExperimentalPacketTypeDefinition('Relation')?.packet_type, undefined);
  assert.equal(getExperimentalPacketTypeDefinition('Preference')?.packet_type, 'Preference');
});


test('manifest exposes shadow action, builder, planner, and mutation descriptors', () => {
  const preferenceActions = listExperimentalPacketActions('Preference').map(
    (action) => action.action_id
  );
  const preferenceBuilders = listExperimentalPacketBuilders('Preference').map(
    (builder) => builder.builder_id
  );
  const preferencePlanners = listExperimentalPacketPlanners('Preference').map(
    (planner) => planner.planner_id
  );
  const preferenceMutations = listExperimentalPacketMutations('Preference').map(
    (mutation) => mutation.mutation_intent
  );

  assert.ok(preferenceActions.includes('preference.scope_display.create'));
  assert.ok(preferenceBuilders.includes('preference.scope_display.body.v0'));
  assert.ok(
    preferencePlanners.includes('preference.scope_display.latest_active_revision.v0')
  );
  assert.ok(preferenceMutations.includes('preference.scope_display.set'));
});

test('Bundle and Compatibility definitions include portable propagation affordances', () => {
  const bundleActions = listExperimentalPacketActions('Bundle').map(
    (action) => action.action_id
  );
  const compatibilityPlanners = listExperimentalPacketPlanners('Compatibility').map(
    (planner) => planner.planner_id
  );

  assert.ok(bundleActions.includes('bundle.schema_manifest.create'));
  assert.ok(bundleActions.includes('bundle.compatibility_bundle.create'));
  assert.ok(
    compatibilityPlanners.includes('compatibility.nearest_current_adapter.v0')
  );
});


test('packet manifest template exposes the expected section contract', () => {
  const sections = listPacketManifestTemplateSections().map(
    (section) => section.section_key
  );

  assert.ok(sections.includes('identity'));
  assert.ok(sections.includes('schema'));
  assert.ok(sections.includes('actions'));
  assert.ok(sections.includes('planners'));
  assert.ok(sections.includes('compatibility'));
  assert.ok(sections.includes('bundling'));
});

test('packet actions are the source of derived affordances', () => {
  const preferenceDefinition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const actionKinds = derivePacketDefinitionActionKinds(preferenceDefinition);
  assert.ok(actionKinds.includes('create'));
  assert.ok(actionKinds.includes('revise'));
  assert.ok(actionKinds.includes('project'));
  assert.ok(actionKinds.includes('bundle'));
  assert.equal('affordances' in preferenceDefinition, false);
});

test('section helpers report template compliance for shadow packet definitions', () => {
  for (const definition of listExperimentalPacketTypeDefinitions()) {
    const compliance = validatePacketDefinitionTemplateCompliance(
      definition,
      PACKET_MANIFEST_TEMPLATE_VERSION
    );

    assert.equal(compliance.packet_type, definition.packet_type);
    assert.deepEqual(compliance.missing_required_sections, []);
    assert.notEqual(getPacketDefinitionSectionStatus(definition, 'actions'), 'unsupported');
    assert.notEqual(getPacketDefinitionSectionStatus(definition, 'schema'), 'unsupported');
  }
});

test('Preference definition declares concrete shadow compatibility adapters', () => {
  const preferenceDefinition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const adapterIds = preferenceDefinition.compatibility_adapters.map(
    (adapter) => adapter.adapter_id
  );

  assert.ok(adapterIds.includes('preference.scope_display.legacy_v0_to_0_1'));
  assert.ok(adapterIds.includes('preference.scope_display.0_1_to_legacy_v0'));
  assert.ok(adapterIds.includes('preference.scope_display.0_1_current_neighbor'));
});
