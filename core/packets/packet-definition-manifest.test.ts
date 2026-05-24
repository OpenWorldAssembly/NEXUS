/**
 * File: packet-definition-manifest.test.ts
 * Description: Regression coverage for the active packet definition manifest and canonical packet schemas.
 */

import assert from 'node:assert/strict';
import test from 'node:test';

import {
  BundleBodySchema,
  DefinitionBodySchema,
  PACKET_DEFINITION_MANIFEST,
  PACKET_MANIFEST_TEMPLATE_VERSION,
  derivePacketDefinitionActionKinds,
  getDefinedPacketTypeDefinition,
  getPacketDefinitionSectionStatus,
  listPacketDefinitionActions,
  listPacketDefinitionBuilders,
  listPacketDefinitionMutations,
  listPacketDefinitionPlanners,
  listDefinedPacketTypeDefinitions,
  listPacketDefinitionParts,
  listPacketManifestTemplateSections,
  validatePacketDefinitionTemplateCompliance,
} from '@core/packets/packet-definition-manifest';
import { PreferenceBodySchema } from '@core/packets/definitions/preference.ts';
import { GENERIC_PACKET_BUILD_TYPES } from '@core/packets/packet-build-pipeline';
import { listDefinitionBootstrapParts } from '@core/packets/definitions/index.ts';
import {
  PACKET_COMPATIBILITY_REGISTRY,
  PACKET_TYPES,
} from '@core/schema/packet-schema';

const EXPECTED_MANIFEST_PACKET_TYPES = [
  ...GENERIC_PACKET_BUILD_TYPES,
].sort();

test('active manifest exposes core generic packet definitions', () => {
  const packetTypes = listDefinedPacketTypeDefinitions().map(
    (definition) => definition.packet_type
  );

  assert.deepEqual(packetTypes.sort(), EXPECTED_MANIFEST_PACKET_TYPES);
  assert.equal(PACKET_DEFINITION_MANIFEST.manifest_type, 'packet_definition_manifest');
  assert.equal(PACKET_DEFINITION_MANIFEST.template_version, PACKET_MANIFEST_TEMPLATE_VERSION);
  assert.ok(PACKET_DEFINITION_MANIFEST.items.every((item) => item.action_count > 0));
  assert.ok(
    PACKET_DEFINITION_MANIFEST.items.every((item) => item.action_kinds.length > 0)
  );
});

test('Definition, Bundle, and Preference are canonical packet types', () => {
  assert.equal(PACKET_TYPES.includes('Preference'), true);
  assert.equal(PACKET_TYPES.includes('Definition'), true);
  assert.equal(PACKET_TYPES.includes('Bundle'), true);
});

test('Definition and Bundle expose canonical builder descriptors', () => {
  const definition = getDefinedPacketTypeDefinition('Definition');
  const bundle = getDefinedPacketTypeDefinition('Bundle');
  assert.ok(definition);
  assert.ok(bundle);

  assert.ok(
    definition.builders.some(
      (builder) => builder.builder_id === 'definition.part.body.v0'
    )
  );
  assert.ok(
    definition.compatibility_adapters.some(
      (adapter) => adapter.adapter_id === 'definition.0_1_current_neighbor'
    )
  );
  assert.ok(
    bundle.compatibility_adapters.some(
      (adapter) => adapter.adapter_id === 'bundle.0_1_current_neighbor'
    )
  );
});

test('active Definition, Bundle, and Preference descriptors are canonical and runtime-ready', () => {
  for (const packetType of ['Definition', 'Bundle', 'Preference']) {
    const definition = getDefinedPacketTypeDefinition(packetType);
    assert.ok(definition);
    const serializedDefinition = JSON.stringify(definition);

    assert.equal(definition.definition_status, 'canonical');
    assert.equal(serializedDefinition.includes('experimental'), false);
    assert.equal(serializedDefinition.includes('shadow'), false);
    assert.equal(serializedDefinition.includes('definition_only'), false);
    assert.ok(
      definition.actions.every(
        (descriptor) =>
          descriptor.availability === 'runtime_ready' ||
          descriptor.availability === 'canonical'
      )
    );
  }
});

test('every manifest definition exposes required compatibility parts and current identity', () => {
  for (const definition of listDefinedPacketTypeDefinitions()) {
    assert.ok(
      listPacketDefinitionParts(definition).some(
        (part) => part.required && part.part_subtype === 'packet_compatibility'
      ),
      `${definition.packet_type} compatibility part`
    );
    assert.ok(
      definition.compatibility_adapters.some(
        (adapter) =>
          adapter.from_schema_version === definition.current_schema_version &&
          adapter.to_schema_version === definition.current_schema_version &&
          adapter.direction === 'bidirectional_neighbor'
      ),
      `${definition.packet_type} current identity adapter`
    );
  }
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

  assert.equal(parsed.subtype, 'packet_schema');
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

  assert.equal(parsed.subtype, 'element');
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

  assert.equal(parsed.subtype, 'packet_set');
  assert.equal(parsed.items[0].item_role, 'definition_part');
});

test('manifest lookup returns definitions for generic types and null for removed types', () => {
  assert.equal(getDefinedPacketTypeDefinition('Relation')?.packet_type, 'Relation');
  assert.equal(getDefinedPacketTypeDefinition('Preference')?.packet_type, 'Preference');
  assert.equal(getDefinedPacketTypeDefinition('Signal'), null);
});

test('manifest exposes action, builder, planner, and mutation descriptors', () => {
  const preferenceActions = listPacketDefinitionActions('Preference').map(
    (action) => action.action_id
  );
  const preferenceBuilders = listPacketDefinitionBuilders('Preference').map(
    (builder) => builder.builder_id
  );
  const preferencePlanners = listPacketDefinitionPlanners('Preference').map(
    (planner) => planner.planner_id
  );
  const preferenceMutations = listPacketDefinitionMutations('Preference').map(
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
  const preferenceDefinition = getDefinedPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const partSubtypes = listPacketDefinitionParts(preferenceDefinition).map(
    (part) => part.part_subtype
  );

  assert.ok(partSubtypes.includes('packet_definition'));
  assert.ok(partSubtypes.includes('packet_schema'));
  assert.ok(partSubtypes.includes('packet_compatibility'));
  assert.ok(partSubtypes.includes('dependencies_definition'));
});

test('generic type definitions expose required Definition parts', () => {
  for (const type of GENERIC_PACKET_BUILD_TYPES) {
    const definition = getDefinedPacketTypeDefinition(type);
    assert.ok(definition, `${type} should have a staged definition`);

    const partSubtypes = listPacketDefinitionParts(definition).map(
      (part) => part.part_subtype
    );

    assert.ok(partSubtypes.includes('packet_definition'), `${type} root part`);
    assert.ok(partSubtypes.includes('packet_schema'), `${type} schema part`);
    assert.ok(partSubtypes.includes('packet_action_registry'), `${type} action part`);
    assert.ok(partSubtypes.includes('packet_builder_descriptor'), `${type} builder part`);
    assert.ok(partSubtypes.includes('packet_planner_descriptor'), `${type} planner part`);
    assert.ok(partSubtypes.includes('packet_projection_descriptor'), `${type} projection part`);
    assert.ok(partSubtypes.includes('packet_compatibility'), `${type} compatibility part`);
    assert.ok(partSubtypes.includes('dependencies_definition'), `${type} dependency part`);
  }
});

test('definitions barrel exposes bootstrap parts through prefixed aliases', () => {
  const preferenceDefinition = getDefinedPacketTypeDefinition('Preference');
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
  const preferenceDefinition = getDefinedPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const actionKinds = derivePacketDefinitionActionKinds(preferenceDefinition);
  assert.ok(actionKinds.includes('create'));
  assert.ok(actionKinds.includes('revise'));
  assert.ok(actionKinds.includes('project'));
  assert.equal('affordances' in preferenceDefinition, false);
});

test('section helpers report template compliance for definition packet definitions', () => {
  for (const definition of listDefinedPacketTypeDefinitions()) {
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

test('Preference definition declares concrete compatibility adapters', () => {
  const preferenceDefinition = getDefinedPacketTypeDefinition('Preference');
  assert.ok(preferenceDefinition);

  const adapterIds = preferenceDefinition.compatibility_adapters.map(
    (adapter) => adapter.adapter_id
  );

  assert.ok(adapterIds.includes('preference.element.legacy_v0_to_0_1'));
  assert.ok(adapterIds.includes('preference.element.0_1_to_legacy_v0'));
  assert.ok(adapterIds.includes('preference.element.0_1_current_neighbor'));
});

test('generic legacy types expose registry-derived compatibility ladders', () => {
  for (const type of ['Element', 'Claim', 'Attestation', 'Policy'] as const) {
    const definition = getDefinedPacketTypeDefinition(type);
    assert.ok(definition);

    const registryEntry = PACKET_COMPATIBILITY_REGISTRY[type];
    const edges = new Set(
      definition.compatibility_adapters.map(
        (adapter) => `${adapter.from_schema_version}->${adapter.to_schema_version}`
      )
    );

    assert.ok(
      edges.has(
        `${registryEntry.current_schema_version}->${registryEntry.current_schema_version}`
      ),
      `${type} identity edge`
    );

    for (const [schemaVersion, versionDefinition] of Object.entries(
      registryEntry.versions
    )) {
      if (versionDefinition.next_schema_version && versionDefinition.adaptToNext) {
        assert.ok(
          edges.has(`${schemaVersion}->${versionDefinition.next_schema_version}`),
          `${type} upcast edge ${schemaVersion}`
        );
      }

      if (
        versionDefinition.previous_schema_version &&
        versionDefinition.adaptToPrevious
      ) {
        assert.ok(
          edges.has(`${schemaVersion}->${versionDefinition.previous_schema_version}`),
          `${type} downcast edge ${schemaVersion}`
        );
      }
    }
  }
});
