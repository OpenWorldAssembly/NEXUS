/**
 * File: packet-definition-manifest.test.ts
 * Description: Regression coverage for the experimental packet definition manifest and shadow-mode packet schemas.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BundleBodySchema,
  DefinitionBodySchema,
  PACKET_DEFINITION_MANIFEST,
  PACKET_MANIFEST_TEMPLATE_VERSION,
  PreferenceBodySchema,
  derivePacketDefinitionActionKinds,
  getExperimentalPacketTypeDefinition,
  getPacketDefinitionSectionStatus,
  listExperimentalPacketActions,
  listExperimentalPacketBuilders,
  listExperimentalPacketMutations,
  listExperimentalPacketPlanners,
  listExperimentalPacketTypeDefinitions,
  listPacketDefinitionParts,
  listPacketManifestTemplateSections,
  validatePacketDefinitionTemplateCompliance,
} from '@core/packets/packet-definition-manifest';
import { listDefinitionBootstrapParts } from '@core/packets/definitions/index.ts';
import { PACKET_FAMILIES } from '@core/schema/packet-schema';

test('experimental manifest exposes Definition, Preference, and Bundle packet types', () => {
  const packetTypes = listExperimentalPacketTypeDefinitions().map(
    (definition) => definition.packet_type
  );

  assert.deepEqual(packetTypes.sort(), ['Bundle', 'Definition', 'Preference']);
  assert.equal(PACKET_DEFINITION_MANIFEST.manifest_type, 'packet_definition_manifest');
  assert.equal(PACKET_DEFINITION_MANIFEST.template_version, PACKET_MANIFEST_TEMPLATE_VERSION);
  assert.ok(PACKET_DEFINITION_MANIFEST.items.every((item) => item.action_count > 0));
  assert.ok(
    PACKET_DEFINITION_MANIFEST.items.every((item) => item.action_kinds.length > 0)
  );
});

test('Definition and Bundle remain manifest-only packet types for this chapter', () => {
  assert.equal(PACKET_FAMILIES.includes('Preference'), true);
  assert.equal((PACKET_FAMILIES as readonly string[]).includes('Definition'), false);
  assert.equal((PACKET_FAMILIES as readonly string[]).includes('Bundle'), false);
});

test('Definition packet can represent a packet_schema definition part', () => {
  const parsed = DefinitionBodySchema.parse({
    subtype: 'packet_schema',
    defines_packet_type: 'Preference',
    defines_packet_subtype: 'element',
    summary: 'Defines the Preference.element body shape.',
    schema_key: 'ElementPreferenceBodySchema',
    supported_subtypes: ['element'],
  });

  assert.equal(parsed.type, 'definition');
  assert.equal(parsed.subtype, 'packet_schema');
  assert.deepEqual(parsed.supported_subtypes, ['element']);
});

test('Preference.element can represent current shell scope display preferences', () => {
  const parsed = PreferenceBodySchema.parse({
    owner_ref: { packet_id: 'nexus:element/person/alice' },
    subtype: 'element',
    value: {
      interface: {
        scope_display: {
          main_visible_scope_packet_ids: ['nexus:element/locality/city/example'],
          show_associated_parent_chains: true,
          show_followed_parent_chains: false,
        },
      },
    },
  });

  assert.equal(parsed.type, 'preference');
  assert.equal(parsed.privacy, 'private_sync');
  assert.deepEqual(parsed.value.interface.scope_display.main_visible_scope_packet_ids, [
    'nexus:element/locality/city/example',
  ]);
  assert.deepEqual(parsed.value.interface.shell_chrome, {
    navigation_mode: 'function',
    theme_mode: 'dark',
    ui_density: 'small',
  });
});

test('Bundle packet stays a generic carrier inventory', () => {
  const parsed = BundleBodySchema.parse({
    subtype: 'packet_set',
    title: 'Preference definition parts bundle',
    purpose: 'Transport definition parts while preserving their own packet semantics.',
    items: [
      {
        item_role: 'definition_part',
        packet_type: 'Definition',
        packet_subtype: 'packet_schema',
        schema_version: '0.1.0',
      },
    ],
  });

  assert.equal(parsed.type, 'bundle');
  assert.equal(parsed.items[0].item_role, 'definition_part');
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

  assert.ok(preferenceActions.includes('preference.element.create'));
  assert.ok(preferenceBuilders.includes('preference.element.body.v0'));
  assert.ok(
    preferencePlanners.includes('preference.element.latest_active_revision.v0')
  );
  assert.ok(preferenceMutations.includes('preference.element.set'));
});

test('Preference definition exposes required Definition parts', () => {
  const preferenceDefinition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const partSubtypes = listPacketDefinitionParts(preferenceDefinition).map(
    (part) => part.part_subtype
  );

  assert.ok(partSubtypes.includes('packet_definition'));
  assert.ok(partSubtypes.includes('packet_schema'));
  assert.ok(partSubtypes.includes('packet_compatibility'));
  assert.ok(partSubtypes.includes('packet_dependency'));
});

test('definitions barrel exposes bootstrap parts through prefixed aliases', () => {
  const preferenceDefinition = getExperimentalPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const partIds = listDefinitionBootstrapParts(preferenceDefinition).map(
    (part) => part.part_id
  );

  assert.ok(partIds.includes('preference.element.packet_definition.v0'));
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

  assert.ok(adapterIds.includes('preference.element.legacy_v0_to_0_1'));
  assert.ok(adapterIds.includes('preference.element.0_1_to_legacy_v0'));
  assert.ok(adapterIds.includes('preference.element.0_1_current_neighbor'));
});
