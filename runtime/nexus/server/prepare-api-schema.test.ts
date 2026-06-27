import test from 'node:test';
import assert from 'node:assert/strict';

import {
  listPrepareMutationIntentSchemaKinds,
  MutationIntentSchema,
  PrepareMutationRequestSchema,
} from '@runtime/nexus/server/prepare-mutation-intent-schema';
import { listMutationIntentDescriptors } from '@runtime/nexus/server/mutation-intent-registry';
import { resolvePrepareMutationApiPreflight } from '@runtime/nexus/server/packet-api-crossing-guard';

test('prepare route mutation schema matches the live mutation registry', () => {
  assert.deepEqual(
    listPrepareMutationIntentSchemaKinds(),
    listMutationIntentDescriptors()
      .map((descriptor) => descriptor.kind)
      .sort((left, right) => left.localeCompare(right))
  );
});

test('prepare route accepts Preference.element set intents and resolves preflight', () => {
  const actorAssertion = {
    actor_packet_id: 'nexus:actor/alice',
    kid: 'key-1',
    method: 'POST',
    path: '/api/nexus/mutations/prepare',
    body_digest: 'digest',
    issued_at: '2026-05-20T00:00:00.000Z',
    signature: 'signature',
  };

  for (const intent of [
    {
      kind: 'preference.element.set',
      scope_display: {
        main_visible_scope_packet_ids: ['nexus:element/city'],
      },
    },
    {
      kind: 'preference.element.set',
      shell_chrome: {
        navigation_mode: 'scope',
      },
    },
  ]) {
    const parsedRequest = PrepareMutationRequestSchema.parse({
      actor_packet: { packet_id: 'nexus:actor/alice' },
      actor_assertion: actorAssertion,
      intent,
    });
    const parsed = parsedRequest.intent;
    const preflight = resolvePrepareMutationApiPreflight(parsed);

    assert.equal(parsed.kind, 'preference.element.set');
    assert.equal(preflight.status, 'allowed_definition');
    assert.equal(preflight.client_intent_id, 'preference.interface.set');
  }
});

test('prepare route accepts optional initiative refs for default-surface intents', () => {
  const assemblyIntent = MutationIntentSchema.parse({
    kind: 'assembly.element.create',
    name: 'District 9',
    parent_scope_packet_id: 'nexus:element/city',
    initiative_packet_id: 'nexus:action/owa',
  });
  assert.equal(assemblyIntent.kind, 'assembly.element.create');
  assert.equal(assemblyIntent.initiative_packet_id, 'nexus:action/owa');

  const discussionIntent = MutationIntentSchema.parse({
    kind: 'discussion.surfaces.ensure',
    scope_id: 'district-9',
    initiative_packet_id: 'nexus:action/owa',
  });
  assert.equal(discussionIntent.kind, 'discussion.surfaces.ensure');
  assert.equal(discussionIntent.initiative_packet_id, 'nexus:action/owa');
});

test('prepare route rejects empty Preference.element set intents', () => {
  assert.throws(
    () =>
      MutationIntentSchema.parse({
        kind: 'preference.element.set',
      }),
    /Preference\.element interface writes require at least one/
  );
});

test('prepare route rejects retired legacy claim mutation intents at schema boundary', () => {
  for (const intent of [
    {
      kind: 'association.claim.set',
      target_packet_id: 'nexus:element/assembly',
      scope_id: 'nexus:element/scope',
    },
    {
      kind: 'residence.claim.set',
      residence_scope_packet_id: 'nexus:element/home',
    },
  ]) {
    assert.equal(MutationIntentSchema.safeParse(intent).success, false);
  }
});
