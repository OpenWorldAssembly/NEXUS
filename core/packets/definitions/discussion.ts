/**
 * File: discussion.ts
 * Description: Discussion packet definition overlay for definition-backed aggregate projection surfaces.
 */

import { genericDiscussionPacketDefinition } from './generic-type.ts';
import type {
  PacketActionDescriptor,
  PacketDefinitionPartDescriptor,
  PacketProjectionDescriptor,
  PacketTypeDefinition,
} from './packet-definition-types.ts';

const DISCUSSION_REQUIRED_PART_SUBTYPES = [
  'packet_definition',
  'packet_schema',
  'packet_action_registry',
  'packet_builder_descriptor',
  'packet_planner_descriptor',
  'packet_projection_descriptor',
  'packet_compatibility',
  'defaults_definition',
  'dependencies_definition',
] as const;

function currentPacket(path: string, required = false) {
  return {
    binding_kind: 'current_packet' as const,
    path,
    required,
  };
}

function staticValue(value: unknown) {
  return {
    binding_kind: 'static_value' as const,
    value,
  };
}

export const DISCUSSION_SURFACE_ACTIONS = [
  {
    action_id: 'discussion.space.create',
    action_kind: 'create',
    packet_subtype: 'space',
    label: 'Create discussion space',
    policy_action_id: 'discussion.space.create',
    availability: 'canonical',
    notes:
      'Creates a discussion space anchored to a scope; live writes remain owned by the trusted planner/building pipeline.',
  },
  {
    action_id: 'discussion.forum.create',
    action_kind: 'create',
    packet_subtype: 'forum',
    label: 'Create forum',
    policy_action_id: 'discussion.forum.create',
    availability: 'canonical',
    notes:
      'Creates a forum beneath a discussion space for a named role such as general, proposals, or announcements.',
  },
  {
    action_id: 'discussion.topic.create',
    action_kind: 'create',
    packet_subtype: 'topic',
    label: 'Create topic',
    policy_action_id: 'discussion.topic.create',
    availability: 'canonical',
    notes:
      'Creates a topic beneath a forum; topic feeds may be projected without custom UI code.',
  },
  {
    action_id: 'discussion.post.create',
    action_kind: 'create',
    packet_subtype: 'post',
    label: 'Create post',
    policy_action_id: 'discussion.post.create',
    availability: 'canonical',
    notes:
      'Creates a top-level post beneath a forum or topic using definition-backed discussion defaults and policy gates.',
  },
  {
    action_id: 'discussion.reply.create',
    action_kind: 'create',
    packet_subtype: 'message',
    label: 'Reply',
    policy_action_id: 'discussion.reply.create',
    availability: 'runtime_ready',
    notes:
      'Creates a Discussion.message reply through the existing discussion.reply workflow descriptor.',
  },
  {
    action_id: 'discussion.workspace.project',
    action_kind: 'project',
    packet_subtype: 'space',
    label: 'Project discussion workspace',
    policy_action_id: null,
    availability: 'canonical',
    notes:
      'Projects a discussion space into the aggregate workspace shell, including forum navigation and feed regions.',
  },
  {
    action_id: 'discussion.feed.project',
    action_kind: 'project',
    packet_subtype: null,
    label: 'Project discussion feed',
    policy_action_id: null,
    availability: 'canonical',
    notes:
      'Projects forum/topic/post aggregates using Definition projection descriptors and adapter-owned archive queries.',
  },
  {
    action_id: 'discussion.thread.project',
    action_kind: 'project',
    packet_subtype: 'post',
    label: 'Project discussion thread',
    policy_action_id: null,
    availability: 'canonical',
    notes:
      'Projects a root post and reply tree into a focused thread surface.',
  },
] as const satisfies readonly PacketActionDescriptor[];

export const DISCUSSION_AGGREGATE_PROJECTIONS = [
  {
    projection_key: 'discussion.workspace.aggregate.v0',
    target_surface: 'nexus.discussions.workspace',
    mode: 'aggregate',
    resolver_preset_ids: [
      'resolution.ui.card_projection.v0',
      'resolution.discussion.thread_context.v0',
    ],
    field_descriptors: [
      {
        field_key: 'title',
        label: 'Workspace title',
        binding: currentPacket('body.title', true),
        display_role: 'title',
        required: true,
      },
      {
        field_key: 'summary',
        label: 'Workspace summary',
        binding: currentPacket('body.summary'),
        display_role: 'summary',
        required: false,
      },
      {
        field_key: 'scope_ref',
        label: 'Scope',
        binding: currentPacket('body.scope_ref', true),
        display_role: 'meta',
        required: true,
      },
      {
        field_key: 'forum_query',
        label: 'Forum query',
        binding: staticValue({
          packet_type: 'Discussion',
          packet_subtype: 'forum',
          edge_kind: 'belongs_to',
          edge_source_field: 'parent_ref',
          sort_key: 'role_then_title',
        }),
        display_role: 'body',
        required: true,
      },
      {
        field_key: 'feed_regions',
        label: 'Feed regions',
        binding: staticValue([
          'forum_tabs',
          'selected_forum_feed',
          'thread_focus_panel',
          'composer',
        ]),
        display_role: 'body',
        required: true,
      },
      {
        field_key: 'empty_state',
        label: 'Empty state',
        binding: staticValue({
          title: 'No discussion packets yet',
          summary: 'Create a forum or import a discussion bundle to populate this workspace.',
          primary_action_id: 'discussion.forum.create',
        }),
        display_role: 'meta',
        required: true,
      },
    ],
    layout: {
      layout_key: 'discussion.workspace_shell.v0',
      component_key: 'discussion.workspace_shell',
      density: 'expanded',
      slots: [
        'title',
        'summary',
        'forum_tabs',
        'selected_forum_feed',
        'thread_focus_panel',
        'composer',
        'actions',
        'empty_state',
      ],
      notes:
        'Workspace shell layout keeps the UI wrapper dynamic while adapter aggregation supplies child forum/feed packets.',
    },
    preferred_surface: 'discussions',
    action_registry_keys: [
      'discussion.workspace.actions.v0',
      'discussion.forum.actions.v0',
      'reaction.vote.actions.v0',
    ],
    policy_action_ids: [
      'discussion.forum.create',
      'discussion.topic.create',
      'discussion.post.create',
      'discussion.reply.create',
      'reaction.vote.set',
    ],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.trusted_coordinator.archive',
      'runtime.trusted_coordinator.projection',
      'runtime.trusted_coordinator.resolution',
      'generic.resolver.projection',
      'generic.operation.discussion',
      'generic.operation.reaction',
    ],
    notes:
      'Aggregate descriptor for the discussion landing surface; runtime query composition remains adapter-owned, but layout/actions/regions are definition-owned.',
  },
  {
    projection_key: 'discussion.forum.feed.aggregate.v0',
    target_surface: 'nexus.discussions.forum_feed',
    mode: 'aggregate',
    resolver_preset_ids: ['resolution.ui.card_projection.v0'],
    field_descriptors: [
      {
        field_key: 'title',
        label: 'Forum title',
        binding: currentPacket('body.title', true),
        display_role: 'title',
        required: true,
      },
      {
        field_key: 'role',
        label: 'Forum role',
        binding: currentPacket('body.role', true),
        display_role: 'badge',
        required: true,
      },
      {
        field_key: 'summary',
        label: 'Forum summary',
        binding: currentPacket('body.summary'),
        display_role: 'summary',
        required: false,
      },
      {
        field_key: 'default_sort',
        label: 'Default sort',
        binding: currentPacket('body.default_sort'),
        display_role: 'meta',
        required: false,
      },
      {
        field_key: 'item_query',
        label: 'Forum item query',
        binding: staticValue({
          packet_type: 'Discussion',
          packet_subtypes: ['topic', 'post'],
          edge_kind: 'belongs_to',
          edge_source_field: 'parent_ref',
          sort_options: ['new', 'hot', 'top', 'controversial', 'old'],
        }),
        display_role: 'body',
        required: true,
      },
    ],
    layout: {
      layout_key: 'discussion.forum_feed.v0',
      component_key: 'discussion.forum_feed',
      density: 'standard',
      slots: ['title', 'role', 'summary', 'sort_controls', 'items', 'composer', 'actions'],
      notes:
        'Forum feed layout for reusable tabs/cards without hardcoded discussion role layouts.',
    },
    preferred_surface: 'discussions',
    action_registry_keys: [
      'discussion.forum.actions.v0',
      'discussion.feed.actions.v0',
      'reaction.vote.actions.v0',
    ],
    policy_action_ids: [
      'discussion.topic.create',
      'discussion.post.create',
      'reaction.vote.set',
    ],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.trusted_coordinator.archive',
      'runtime.trusted_coordinator.projection',
      'generic.operation.discussion',
      'generic.operation.reaction',
    ],
    notes:
      'Aggregate descriptor for forum-level feeds; the descriptor owns sort/action/layout semantics while Archive supplies matching child packets.',
  },
  {
    projection_key: 'discussion.topic.feed.aggregate.v0',
    target_surface: 'nexus.discussions.topic_feed',
    mode: 'aggregate',
    resolver_preset_ids: ['resolution.ui.card_projection.v0'],
    field_descriptors: [
      {
        field_key: 'title',
        label: 'Topic title',
        binding: currentPacket('body.title', true),
        display_role: 'title',
        required: true,
      },
      {
        field_key: 'summary',
        label: 'Topic summary',
        binding: currentPacket('body.summary'),
        display_role: 'summary',
        required: false,
      },
      {
        field_key: 'related_refs',
        label: 'Related packets',
        binding: currentPacket('body.related_refs'),
        display_role: 'meta',
        required: false,
      },
      {
        field_key: 'post_query',
        label: 'Topic post query',
        binding: staticValue({
          packet_type: 'Discussion',
          packet_subtype: 'post',
          edge_kind: 'belongs_to',
          edge_source_field: 'parent_ref',
          sort_options: ['new', 'top', 'controversial', 'old'],
        }),
        display_role: 'body',
        required: true,
      },
    ],
    layout: {
      layout_key: 'discussion.topic_feed.v0',
      component_key: 'discussion.forum_feed',
      density: 'standard',
      slots: ['title', 'summary', 'related_refs', 'sort_controls', 'items', 'composer', 'actions'],
      notes:
        'Topic feed reuses the forum feed component contract while narrowing child results to posts.',
    },
    preferred_surface: 'discussions',
    action_registry_keys: [
      'discussion.feed.actions.v0',
      'reaction.vote.actions.v0',
    ],
    policy_action_ids: ['discussion.post.create', 'reaction.vote.set'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.trusted_coordinator.archive',
      'runtime.trusted_coordinator.projection',
      'generic.operation.discussion',
      'generic.operation.reaction',
    ],
    notes:
      'Aggregate descriptor for topic-focused feeds so topic pages do not need bespoke UI wiring.',
  },
  {
    projection_key: 'discussion.post.thread.aggregate.v0',
    target_surface: 'nexus.discussions.thread',
    mode: 'aggregate',
    resolver_preset_ids: [
      'resolution.ui.card_projection.v0',
      'resolution.discussion.thread_context.v0',
    ],
    field_descriptors: [
      {
        field_key: 'title',
        label: 'Post title',
        binding: currentPacket('body.title', true),
        display_role: 'title',
        required: true,
      },
      {
        field_key: 'summary',
        label: 'Post summary',
        binding: currentPacket('body.summary'),
        display_role: 'summary',
        required: false,
      },
      {
        field_key: 'content_markdown',
        label: 'Post content',
        binding: currentPacket('body.content_markdown'),
        display_role: 'body',
        required: false,
      },
      {
        field_key: 'reply_query',
        label: 'Reply query',
        binding: staticValue({
          packet_type: 'Discussion',
          packet_subtype: 'message',
          edge_kind: 'reply_to',
          edge_source_field: 'parent_ref',
          root_message_field: 'root_message_ref',
          sort_options: ['new', 'top', 'controversial', 'old'],
          pagination: {
            default_limit: 25,
            cursor_mode: 'created_at_then_packet_id',
          },
        }),
        display_role: 'body',
        required: true,
      },
    ],
    layout: {
      layout_key: 'discussion.thread_panel.v0',
      component_key: 'discussion.thread_panel',
      density: 'expanded',
      slots: [
        'title',
        'summary',
        'content_markdown',
        'vote_summary',
        'reply_tree',
        'composer',
        'actions',
      ],
      notes:
        'Focused thread layout for a root post plus paginated reply tree.',
    },
    preferred_surface: 'discussions',
    action_registry_keys: [
      'discussion.thread.actions.v0',
      'reaction.vote.actions.v0',
    ],
    policy_action_ids: ['discussion.reply.create', 'reaction.vote.set'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.trusted_coordinator.archive',
      'runtime.trusted_coordinator.projection',
      'runtime.trusted_coordinator.resolution',
      'generic.operation.discussion',
      'generic.operation.reaction',
    ],
    notes:
      'Aggregate descriptor for thread projection; vote summaries and reply pagination can be adapter computed against this contract.',
  },
  {
    projection_key: 'discussion.message.reply_card.v0',
    target_surface: 'nexus.discussions.reply_card',
    mode: 'derived',
    resolver_preset_ids: ['resolution.ui.card_projection.v0'],
    field_descriptors: [
      {
        field_key: 'title',
        label: 'Reply title',
        binding: currentPacket('body.title'),
        display_role: 'title',
        required: false,
      },
      {
        field_key: 'content_markdown',
        label: 'Reply content',
        binding: currentPacket('body.content_markdown', true),
        display_role: 'body',
        required: true,
      },
      {
        field_key: 'parent_ref',
        label: 'Parent reply',
        binding: currentPacket('body.parent_ref', true),
        display_role: 'meta',
        required: true,
      },
      {
        field_key: 'topic_ref',
        label: 'Topic',
        binding: currentPacket('body.topic_ref', true),
        display_role: 'meta',
        required: true,
      },
      {
        field_key: 'root_message_ref',
        label: 'Root message',
        binding: currentPacket('body.root_message_ref'),
        display_role: 'meta',
        required: false,
      },
    ],
    layout: {
      layout_key: 'discussion.reply_card.v0',
      component_key: 'discussion.reply_tree',
      density: 'compact',
      slots: ['content_markdown', 'vote_summary', 'children', 'actions'],
      notes:
        'Reply-card layout for recursive message rendering inside a discussion thread.',
    },
    preferred_surface: 'discussions',
    action_registry_keys: [
      'discussion.thread.actions.v0',
      'reaction.vote.actions.v0',
    ],
    policy_action_ids: ['discussion.reply.create', 'reaction.vote.set'],
    dependency_ids: [
      'runtime.packet_store.read',
      'runtime.trusted_coordinator.projection',
      'generic.operation.discussion',
      'generic.operation.reaction',
    ],
    notes:
      'Derived reply-card descriptor so Discussion.message rendering can use normal packet projection resolution.',
  },
  {
    projection_key: 'discussion.composer.surface.v0',
    target_surface: 'nexus.discussions.composer',
    mode: 'derived',
    resolver_preset_ids: ['resolution.discussion.thread_context.v0'],
    field_descriptors: [
      {
        field_key: 'target_ref',
        label: 'Target',
        binding: currentPacket('header.packet_id', true),
        display_role: 'action_target',
        required: true,
      },
      {
        field_key: 'subtype',
        label: 'Discussion subtype',
        binding: currentPacket('body.subtype', true),
        display_role: 'badge',
        required: true,
      },
      {
        field_key: 'composer_actions',
        label: 'Composer actions',
        binding: staticValue([
          'discussion.topic.create',
          'discussion.post.create',
          'discussion.reply.create',
        ]),
        display_role: 'body',
        required: true,
      },
    ],
    layout: {
      layout_key: 'discussion.composer_surface.v0',
      component_key: 'discussion.composer_surface',
      density: 'standard',
      slots: ['target_ref', 'subtype', 'composer_actions', 'policy_state'],
      notes:
        'Composer target/action descriptor; actual write execution remains behind planner, regulation, and building coordinators.',
    },
    preferred_surface: 'discussions',
    action_registry_keys: ['discussion.composer.actions.v0'],
    policy_action_ids: [
      'discussion.topic.create',
      'discussion.post.create',
      'discussion.reply.create',
    ],
    dependency_ids: [
      'runtime.policy_gate',
      'runtime.trusted_coordinator.regulation',
      'runtime.trusted_coordinator.planning',
      'runtime.trusted_coordinator.building',
      'generic.operation.discussion',
    ],
    notes:
      'Descriptor for showing valid composer actions without hardcoding discussion-specific button rules in core projection code.',
  },
] as const satisfies readonly PacketProjectionDescriptor[];

const DISCUSSION_PROJECTION_DESCRIPTOR_PART: PacketDefinitionPartDescriptor = {
  part_id: 'discussion.packet_projection_descriptor.aggregate_surfaces.v0',
  part_subtype: 'packet_projection_descriptor',
  defines_packet_type: 'Discussion',
  defines_packet_subtype: null,
  schema_version: genericDiscussionPacketDefinition.current_schema_version,
  availability: 'runtime_ready',
  required: true,
  references: DISCUSSION_AGGREGATE_PROJECTIONS.map(
    (projection) => projection.projection_key
  ),
  notes:
    'Discussion aggregate projection part for workspace, forum feed, topic feed, thread, reply-card, and composer surfaces.',
};

const DISCUSSION_AGGREGATE_DEPENDENCIES_PART: PacketDefinitionPartDescriptor = {
  part_id: 'discussion.dependencies_definition.aggregate_surfaces.v0',
  part_subtype: 'dependencies_definition',
  defines_packet_type: 'Discussion',
  defines_packet_subtype: null,
  schema_version: genericDiscussionPacketDefinition.current_schema_version,
  availability: 'runtime_ready',
  required: true,
  references: [
    'runtime.packet_store.read',
    'runtime.policy_gate',
    'runtime.trusted_coordinator.archive',
    'runtime.trusted_coordinator.projection',
    'runtime.trusted_coordinator.resolution',
    'runtime.trusted_coordinator.regulation',
    'runtime.trusted_coordinator.planning',
    'runtime.trusted_coordinator.building',
    'generic.operation.discussion',
    'generic.operation.reaction',
    'generic.resolver.projection',
    'reaction.packet_projection_descriptor.v0',
  ],
  notes:
    'Dependency part for definition-backed discussion aggregate surfaces; adapters may aggregate child packets but must stay behind trusted coordinator seams.',
};

const genericRootDefinitionPart = genericDiscussionPacketDefinition.packet_definition_parts?.find(
  (part) => part.part_subtype === 'packet_definition'
);

function enrichDiscussionRootPart(): PacketDefinitionPartDescriptor[] {
  if (!genericRootDefinitionPart) {
    return [];
  }

  return [
    {
      ...genericRootDefinitionPart,
      references: [
        ...(genericRootDefinitionPart.references ?? []),
        DISCUSSION_PROJECTION_DESCRIPTOR_PART.part_id,
        DISCUSSION_AGGREGATE_DEPENDENCIES_PART.part_id,
      ],
      notes:
        'Root Canonical definition record for Discussion, enriched with packetized aggregate projection surfaces.',
    },
  ];
}

const genericNonRootDefinitionParts = (
  genericDiscussionPacketDefinition.packet_definition_parts ?? []
).filter((part) => part.part_subtype !== 'packet_definition');

export const discussionPacketDefinition = {
  ...genericDiscussionPacketDefinition,
  actions: [
    ...genericDiscussionPacketDefinition.actions,
    ...DISCUSSION_SURFACE_ACTIONS,
  ],
  projections: [
    ...genericDiscussionPacketDefinition.projections,
    ...DISCUSSION_AGGREGATE_PROJECTIONS,
  ],
  packet_definition_parts: [
    ...enrichDiscussionRootPart(),
    ...genericNonRootDefinitionParts,
    DISCUSSION_PROJECTION_DESCRIPTOR_PART,
    DISCUSSION_AGGREGATE_DEPENDENCIES_PART,
  ],
  notes: [
    ...genericDiscussionPacketDefinition.notes,
    'Discussion is the first aggregate-projection pilot: workspace/feed/thread/composer layout and action contracts are definition-owned while child packet aggregation stays adapter/runtime-owned.',
    `Definition overlay keeps required definition part families explicit: ${DISCUSSION_REQUIRED_PART_SUBTYPES.join(', ')}.`,
  ],
} as const satisfies PacketTypeDefinition;
