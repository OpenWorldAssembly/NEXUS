import assert from 'node:assert/strict';
import test from 'node:test';

import {
  listTrustedResolutionPresets,
  runTrustedResolutionStep,
} from './trusted_resolution_coordinator.ts';

test('trusted resolution coordinator resolves primitive bindings and registered presets', () => {
  const presets = listTrustedResolutionPresets();

  assert.ok(
    presets.some(
      (preset) => preset.preset_id === 'resolution.primitive_bindings.v0'
    )
  );

  const result = runTrustedResolutionStep({
    step: {
      step_id: 'resolve_target',
      preset_ids: ['resolution.primitive_bindings.v0'],
      input_bindings: {
        target_ref: {
          binding_kind: 'input_path',
          path: 'target_ref',
          required: true,
        },
        mode: {
          binding_kind: 'static_value',
          value: 'preview',
        },
      },
      output_key: 'resolved_target',
      on_failure: 'abort_workflow',
      notes: 'Smoke test for shared resolution DSL execution.',
    },
    context: {
      input: {
        target_ref: {
          packet_id: 'nexus:element/test-target',
        },
      },
    },
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.values.mode, 'preview');
  assert.deepEqual(result.value?.values.target_ref, {
    packet_id: 'nexus:element/test-target',
  });
});
