import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assertMutationProofBundle,
  assertSignedPacketsMatchCandidate,
  evaluateDiscussionReplyMutation,
  evaluateDiscussionThreadPostMutation,
} from './mutation-verifier.ts';
import {
  createDiscussionForumPacket,
  createElementPacket,
  createPolicyPacket,
} from '@core/packets/builders';
import type { DiscussionViewerContext } from '@core/contracts';
import type { PacketEnvelope } from '@core/schema/packet-schema';

function createActorPacket(claimStatus: 'claimed' | 'ephemeral_guest') {
  return createElementPacket({
    packet_id: `nexus:element/${claimStatus}-actor`,
    created_at: '2026-04-23T00:00:00.000Z',
    kind: 'person',
    name: claimStatus === 'claimed' ? 'Claimed Actor' : 'Guest Actor',
    subtype: 'person',
    summary: null,
    adapter: 'test',
    identity: {
      alias: claimStatus === 'claimed' ? 'claimed' : 'guest',
      claim_status: claimStatus,
      public_key_bindings: [],
    },
  });
}

function createForumPacket() {
  return createDiscussionForumPacket({
    packet_id: 'nexus:discussion-forum/test-general',
    created_at: '2026-04-23T00:00:00.000Z',
    title: 'Test General',
    summary: null,
    discussion_space_ref: {
      packet_id: 'nexus:discussion-space/test-scope',
    },
    forum_kind: 'general',
    status: 'open',
    authority_scope_ref: {
      packet_id: 'nexus:element/test-scope',
    },
    applicable_scope_refs: [{ packet_id: 'nexus:element/test-scope' }],
    adapter: 'test',
  });
}

function createViewer(
  overrides?: Partial<DiscussionViewerContext>
): DiscussionViewerContext {
  return {
    actor_key: 'element:claimed-actor',
    actor_class: 'scope_member',
    can_create_top_level: true,
    can_reply: true,
    can_vote: true,
    write_block_reason: 'none',
    ...overrides,
  };
}

test('guest visitor-lobby baseline remains allowed without a write-lock policy', () => {
  const actorPacket = createActorPacket('ephemeral_guest');
  const decision = evaluateDiscussionThreadPostMutation({
    intent: {
      kind: 'discussion.thread_post.create',
      scope_id: 'global',
      mutation_nonce: 'guestnonce',
      created_at: '2026-04-23T01:00:00.000Z',
      forum_packet_id: 'nexus:discussion-forum/visitor',
      forum_kind: 'visitor_lobby',
      authority_scope_packet_id: 'nexus:element/global',
      applicable_scope_packet_ids: ['nexus:element/global'],
      default_sort: 'new',
      thread_title: '',
      post_markdown: 'Hello from a guest.',
      thread_kind: 'visitor_lobby',
      related_packet_ids: [],
    },
    actorPacket,
    viewer: createViewer({
      actor_key: 'element:guest-actor',
      actor_class: 'anonymous_guest',
    }),
    governingScopePacket: null,
    policyPackets: [],
  });

  assert.equal(decision.required_proof_level, 'session');
  assert.deepEqual(decision.accepted_proof_methods, ['claimed_session']);
  assert.doesNotThrow(() =>
    assertMutationProofBundle({
      decision,
      proofs: {
        actor_packet_id: actorPacket.header.packet_id,
        is_claimed_identity: false,
        has_actor_assertion: true,
        has_claimed_session: false,
        has_unlocked_identity: true,
        has_recent_reauth: false,
        has_passkey_confirmation: false,
        proof_methods: ['bundle_unlocked'],
      },
    })
  );
});

test('write-lock policy can require reauth for discussion replies', () => {
  const actorPacket = createActorPacket('claimed');
  const governingScopePacket = createElementPacket({
    packet_id: 'nexus:element/test-scope',
    created_at: '2026-04-23T00:00:00.000Z',
    kind: 'assembly',
    name: 'Test Scope',
    subtype: 'city',
    summary: null,
    adapter: 'test',
    policy_refs: [{ packet_id: 'nexus:policy/test-write-lock' }],
  });
  const writeLockPolicy = createPolicyPacket({
    packet_id: 'nexus:policy/test-write-lock',
    created_at: '2026-04-23T00:00:00.000Z',
    title: 'Reply Writelock',
    summary: null,
    policy_kind: 'write_lock',
    body_markdown: '# Reply lock',
    status: 'active',
    adapter: 'test',
    write_policy: {
      default_proof_level: 'session',
      action_overrides: {
        'discussion.reply.create': 'reauth',
      },
    },
  });
  const decision = evaluateDiscussionReplyMutation({
    intent: {
      kind: 'discussion.reply.create',
      scope_id: 'test-scope',
      mutation_nonce: 'replylock',
      created_at: '2026-04-23T02:00:00.000Z',
      forum_kind: 'general',
      authority_scope_packet_id: governingScopePacket.header.packet_id,
      applicable_scope_packet_ids: [governingScopePacket.header.packet_id],
      thread_packet_id: 'nexus:discussion-thread/test',
      root_post_packet_id: 'nexus:discussion-post/root',
      parent_post_packet_id: 'nexus:discussion-post/root',
      reply_markdown: 'A reply.',
    },
    actorPacket,
    viewer: createViewer(),
    governingScopePacket,
    policyPackets: [writeLockPolicy],
  });

  assert.equal(decision.required_proof_level, 'reauth');
  assert.deepEqual(decision.accepted_proof_methods, [
    'signed_reauth',
    'bundle_passphrase_unlock',
    'passkey_confirmation',
  ]);
  assert.throws(() =>
    assertMutationProofBundle({
      decision,
      proofs: {
        actor_packet_id: actorPacket.header.packet_id,
        is_claimed_identity: true,
        has_actor_assertion: true,
        has_claimed_session: true,
        has_unlocked_identity: true,
        has_recent_reauth: false,
        has_passkey_confirmation: false,
        proof_methods: ['claimed_session', 'bundle_unlocked'],
      },
    })
  );
});

test('signed packet bundles must match the canonical discussion candidate', () => {
  const actorPacket = createActorPacket('claimed');
  const forumPacket = createForumPacket();
  const decision = evaluateDiscussionThreadPostMutation({
    intent: {
      kind: 'discussion.thread_post.create',
      scope_id: 'test-scope',
      mutation_nonce: 'bundleok',
      created_at: '2026-04-23T03:00:00.000Z',
      forum_packet_id: forumPacket.header.packet_id,
      forum_kind: forumPacket.body.forum_kind,
      authority_scope_packet_id:
        forumPacket.header.authority_scope_ref?.packet_id ?? null,
      applicable_scope_packet_ids: forumPacket.header.applicable_scope_refs.map(
        (scopeRef) => scopeRef.packet_id
      ),
      default_sort: forumPacket.body.default_sort,
      thread_title: 'Hello',
      post_markdown: 'World',
      thread_kind: forumPacket.body.forum_kind,
      related_packet_ids: [],
    },
    actorPacket,
    viewer: createViewer(),
    governingScopePacket: null,
    policyPackets: [],
  });

  assert.doesNotThrow(() =>
    assertSignedPacketsMatchCandidate({
      candidatePackets: decision.packets,
      signedPackets: decision.packets,
    })
  );
  assert.deepEqual(
    decision.packets.map((packet) => packet.header.family),
    ['Discussion', 'Discussion']
  );

  const mismatchedPackets: PacketEnvelope[] = [
    {
      ...decision.packets[1],
      body: {
        ...decision.packets[1].body,
        content_markdown: 'Changed body',
      },
    } as PacketEnvelope,
  ];

  assert.throws(() =>
    assertSignedPacketsMatchCandidate({
      candidatePackets: [decision.packets[1]],
      signedPackets: mismatchedPackets,
    })
  );
});
