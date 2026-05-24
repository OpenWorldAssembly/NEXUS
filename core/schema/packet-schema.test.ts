import assert from 'node:assert/strict';
import test from 'node:test';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

import {
  PACKET_BODY_SCHEMAS,
  PACKET_TYPES,
  PacketTypeSchema,
  createPacketEnvelope,
  getPacketCurrentSchemaVersion,
  type PacketEnvelope,
  type PacketType,
} from './packet-schema.ts';
import {
  createActionPacket,
  createAssemblyPacket,
  createReactionPacket,
  createBundlePacket,
  createClaimPacket,
  createDefinitionPacket,
  createDiscussionPacket,
  createLocationPacket,
  createPersonPacket,
  createPolicyPacket,
  createPreferencePacket,
  createProposalPacket,
  createRelationPacket,
  createReportPacket,
  createRolePacket,
} from '@core/packets/builders.ts';
import { buildDefinitionPacketSeedEnvelopes } from '@core/packets/packet-definition-seeds.ts';

const ACTIVE_PACKET_TYPES = [
  'Definition',
  'Element',
  'Location',
  'Role',
  'Claim',
  'Relation',
  'Report',
  'Proposal',
  'Reaction',
  'Decision',
  'Action',
  'Policy',
  'Preference',
  'Discussion',
  'Bundle',
] as const satisfies readonly PacketType[];

const PRUNED_PACKET_TYPES = [
  'Cause',
  'Signal',
  'Initiative',
  'Program',
  'Campaign',
  'MissionTemplate',
  'MissionPlan',
  'MissionReport',
  'Module',
  'DiscussionSpace',
  'DiscussionForum',
  'DiscussionThread',
  'DiscussionPost',
  'DiscussionReply',
  'Minutes',
  'Artifact',
] as const;

function packetIds(packet: PacketEnvelope) {
  return {
    packet_id: packet.header.packet_id,
  };
}

const actorRef = { packet_id: 'nexus:element/actor' };
const scopeRef = { packet_id: 'nexus:element/scope' };
const targetRef = { packet_id: 'nexus:element/target' };

test('active packet type ontology is pruned to the reseed set', () => {
  assert.deepEqual(PACKET_TYPES, ACTIVE_PACKET_TYPES);

  for (const type of ACTIVE_PACKET_TYPES) {
    assert.equal(PacketTypeSchema.parse(type), type);
    assert.ok(PACKET_BODY_SCHEMAS[type]);
    assert.ok(getPacketCurrentSchemaVersion(type));
  }

  for (const type of PRUNED_PACKET_TYPES) {
    assert.equal(PacketTypeSchema.safeParse(type).success, false, type);
  }
});

test('active packet builders emit top-level subtype classifiers', () => {
  const definition = buildDefinitionPacketSeedEnvelopes()[0]!;
  const element = createAssemblyPacket({
    packet_id: 'nexus:element/scope',
    name: 'Scope',
  });
  const person = createPersonPacket({
    packet_id: 'nexus:element/actor',
    name: 'Actor',
  });
  const location = createLocationPacket({
    packet_id: 'nexus:location/region',
    subtype: 'region',
    title: 'Region',
  });
  const role = createRolePacket({
    packet_id: 'nexus:role/facilitator',
    subtype: 'facilitator',
    title: 'Facilitator',
    status: 'active',
  });
  const relation = createRelationPacket({
    packet_id: 'nexus:relation/follow',
    subtype: 'follow',
    subject_ref: actorRef,
    target_ref: targetRef,
  });
  const claim = createClaimPacket({
    packet_id: 'nexus:claim/relation',
    subtype: 'relation_assertion',
    target_ref: packetIds(relation),
    subject_ref: actorRef,
    relation_assertion: {
      subtype: 'follow',
      subject_ref: actorRef,
      target_ref: targetRef,
    },
  });
  const report = createReportPacket({
    packet_id: 'nexus:report/import',
    subtype: 'import_report',
    report_markdown: 'Imported.',
  });
  const proposal = createProposalPacket({
    packet_id: 'nexus:proposal/test',
    subtype: 'proposal',
    title: 'Proposal',
    status: 'draft',
  });
  const reaction = createReactionPacket({
    packet_id: 'nexus:reaction/test',
    subtype: 'reaction',
    target_ref: packetIds(claim),
    vote_value: 'up',
    attestation_value: 'support',
  });
  const decision = createPacketEnvelope({
    header: {
      ...definition.header,
      packet_id: 'nexus:decision/test',
      revision_id: 'nexus:decision/test@r1',
      type: 'Decision',
      schema_version: getPacketCurrentSchemaVersion('Decision'),
    },
    body: {
      subtype: 'decision',
      title: 'Decision',
      outcome: 'approved',
      proposal_ref: packetIds(proposal),
      vote_ref: packetIds(reaction),
    },
  });
  const action = createActionPacket({
    packet_id: 'nexus:action/owa',
    subtype: 'initiative',
    title: 'OWA',
    status: 'active',
  });
  const policy = createPolicyPacket({
    packet_id: 'nexus:policy/write',
    subtype: 'write_lock',
    title: 'Write Lock',
    body_markdown: 'Session proof required.',
    status: 'active',
  });
  const preference = createPreferencePacket({
    packet_id: 'nexus:preference/actor/interface',
    body: {
      subtype: 'element',
      owner_ref: actorRef,
      value: { interface: {} },
    },
  });
  const discussionPost = createDiscussionPacket({
    packet_id: 'nexus:discussion/post',
    subtype: 'post',
    role: 'forum_post',
    title: 'Welcome',
    parent_ref: scopeRef,
    content_markdown: 'Welcome.',
  });
  const discussionMessage = createDiscussionPacket({
    packet_id: 'nexus:discussion/message',
    subtype: 'message',
    role: 'reply',
    title: 'Reply',
    parent_ref: packetIds(discussionPost),
    topic_ref: packetIds(discussionPost),
    content_markdown: 'Reply.',
  });
  const bundle = createBundlePacket({
    packet_id: 'nexus:bundle/definitions',
    body: {
      subtype: 'packet_set',
      title: 'Definitions',
      purpose: 'Active definition set.',
      items: [],
    },
  });

  const packets: PacketEnvelope[] = [
    definition,
    element,
    person,
    location,
    role,
    relation,
    claim,
    report,
    proposal,
    reaction,
    decision,
    action,
    policy,
    preference,
    discussionPost,
    discussionMessage,
    bundle,
  ];

  for (const packet of packets) {
    assert.equal(typeof packet.body.subtype, 'string', packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'policy_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'role_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'proposal_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'claim_kind'), false, packet.header.type);
    assert.equal(Object.hasOwn(packet.body, 'attestation_kind'), false, packet.header.type);
  }
});

test('fresh schemas reject old top-level classifier fields', () => {
  assert.equal(
    PACKET_BODY_SCHEMAS.Element.safeParse({
      kind: 'person',
      name: 'Old Person',
    }).success,
    false
  );
  assert.equal(
    PACKET_BODY_SCHEMAS.Discussion.safeParse({
      kind: 'post',
      role: 'forum_post',
      title: 'Old Post',
      parent_ref: scopeRef,
    }).success,
    false
  );
  assert.equal(
    PACKET_BODY_SCHEMAS.Policy.safeParse({
      policy_kind: 'write_lock',
      title: 'Old Policy',
      body_markdown: 'Old.',
      status: 'active',
    }).success,
    false
  );
});

test('active canonical source does not use packet family terminology', () => {
  const roots = ['core', 'runtime', 'app', 'src', 'docs', 'scripts'];
  const textExtensions = new Set([
    '.ts',
    '.tsx',
    '.js',
    '.jsx',
    '.mjs',
    '.cjs',
    '.md',
    '.json',
  ]);
  const ignoredSegments = [
    join('app', 'public', 'generated'),
    join('public', 'downloads'),
    join('docs', 'public', 'version-records'),
    'node_modules',
  ];
  const forbiddenPatterns = [
    /\bPacketFamily\b/,
    /\bPACKET_FAMILIES\b/,
    /\bPacketFamilySchema\b/,
    /header\.family\b/,
    /\bpacket_family\b/,
    /\bfamily_history\b/,
    /\bsource_family\b/,
    /\btarget_family\b/,
    /\blistPreferredPacketsByFamily\b/,
    /\bByFamily\b/,
    /\bfamilies\b/,
    /\bfamily\b/,
  ];
  const violations: string[] = [];

  function walk(directory: string) {
    for (const entry of readdirSync(directory)) {
      const path = join(directory, entry);

      if (ignoredSegments.some((segment) => path.includes(segment))) {
        continue;
      }

      if (path === join('core', 'schema', 'packet-schema.test.ts')) {
        continue;
      }

      const stat = statSync(path);

      if (stat.isDirectory()) {
        walk(path);
        continue;
      }

      const extension = path.slice(path.lastIndexOf('.'));

      if (!textExtensions.has(extension)) {
        continue;
      }

      const text = readFileSync(path, 'utf8');

      for (const pattern of forbiddenPatterns) {
        if (pattern.test(text)) {
          violations.push(`${path}: ${pattern}`);
        }
      }
    }
  }

  for (const root of roots) {
    walk(root);
  }

  assert.deepEqual(violations, []);
});
