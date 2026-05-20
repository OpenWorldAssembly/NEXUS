/**
 * File: families/discussion.ts
 * Description: Family-owned build rules for canonical Discussion packets.
 */

import type { DiscussionPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import {
  createPacketEdge,
  createTextExcerpt,
} from '@core/packets/packet-build-helpers';
import type { PacketRef } from '@core/schema/packet-schema';

function createParticipationRules(input: DiscussionPacketInput) {
  return {
    top_level_actor_classes:
      input.participation_rules?.top_level_actor_classes ?? [],
    reply_actor_classes: input.participation_rules?.reply_actor_classes ?? [],
    reaction_actor_classes:
      input.participation_rules?.reaction_actor_classes ?? [],
    top_level_post_cost: input.participation_rules?.top_level_post_cost ?? 0,
  };
}

export const discussionBuildDefinition: PacketFamilyBuildDefinition<
  'Discussion',
  DiscussionPacketInput
> = {
  validateBody: (input) => {
    if (input.kind === 'space') {
      if (!input.scope_ref) {
        throw new Error('Discussion space packets require scope_ref.');
      }
      return;
    }

    if (!input.parent_ref) {
      throw new Error(`Discussion ${input.kind} packets require parent_ref.`);
    }

    if (input.kind === 'message' && !input.topic_ref) {
      throw new Error('Discussion message packets require topic_ref.');
    }
  },
  extractRelationships: (input) => {
    if (input.kind === 'space') {
      return {
        dependencies: [input.scope_ref as PacketRef],
      };
    }

    if (input.kind === 'forum') {
      return {
        dependencies: [input.parent_ref as PacketRef],
      };
    }

    if (input.kind === 'topic' || input.kind === 'post') {
      return {
        dependencies: [input.parent_ref as PacketRef],
        references: input.related_refs ?? [],
      };
    }

    return {
      dependencies: [
        input.parent_ref as PacketRef,
        input.topic_ref as PacketRef,
        ...(input.root_message_ref ? [input.root_message_ref] : []),
      ],
    };
  },
  prepareEdges: (input, relationships) => {
    const edges = [];

    if (input.kind === 'space') {
      edges.push(
        createPacketEdge('belongs_to', input.scope_ref as PacketRef, {
          source_field: 'scope_ref',
        })
      );

      return edges;
    }

    edges.push(
      createPacketEdge('belongs_to', input.parent_ref as PacketRef, {
        source_field: 'parent_ref',
      })
    );

    if (input.kind === 'topic' || input.kind === 'post') {
      for (const relatedRef of relationships?.references ?? []) {
        edges.push(
          createPacketEdge('references', relatedRef, {
            source_field: 'related_refs',
          })
        );
      }

      return edges;
    }

    if (input.kind === 'post') {
      for (const attachmentRef of input.attachment_refs ?? []) {
        edges.push(
          createPacketEdge('references', attachmentRef, {
            source_field: 'attachment_refs',
          })
        );
      }

      return edges;
    }

    if (input.kind !== 'message') {
      return edges;
    }

    edges.push(
      createPacketEdge('references', input.topic_ref as PacketRef, {
        source_field: 'topic_ref',
      })
    );

    if (
      input.root_message_ref &&
      input.root_message_ref.packet_id !== input.parent_ref?.packet_id
    ) {
      edges.push(
        createPacketEdge('belongs_to', input.root_message_ref, {
          source_field: 'root_message_ref',
        })
      );
    }

    edges.push(
      createPacketEdge('reply_to', input.parent_ref as PacketRef, {
        source_field: 'parent_ref',
      })
    );

    return edges;
  },
  finalizeBody: (input) => {
    if (input.kind === 'space') {
      return {
        kind: 'space',
        role: input.role,
        title: input.title,
        summary: input.summary ?? null,
        status: input.status ?? 'open',
        scope_ref: input.scope_ref as PacketRef,
      };
    }

    if (input.kind === 'forum') {
      return {
        kind: 'forum',
        role: input.role,
        title: input.title,
        summary: input.summary ?? null,
        status: input.status ?? 'open',
        parent_ref: input.parent_ref as PacketRef,
        participation_rules: createParticipationRules(input),
        default_sort: input.default_sort ?? 'new',
      };
    }

    if (input.kind === 'topic') {
      return {
        kind: 'topic',
        role: input.role,
        title: input.title,
        summary: input.summary ?? null,
        status: input.status ?? 'open',
        parent_ref: input.parent_ref as PacketRef,
        related_refs: input.related_refs ?? [],
        participation_rules: createParticipationRules(input),
        default_sort: input.default_sort ?? 'new',
      };
    }

    if (input.kind === 'post') {
      return {
        kind: 'post',
        role: input.role,
        title: input.title,
        summary: input.summary ?? null,
        status: input.status ?? 'open',
        parent_ref: input.parent_ref as PacketRef,
        related_refs: input.related_refs ?? [],
        participation_rules: createParticipationRules(input),
        default_sort: input.default_sort ?? 'new',
        content_markdown: input.content_markdown ?? null,
        attachment_refs: input.attachment_refs ?? [],
      };
    }

    return {
      kind: 'message',
      role: input.role,
      title: input.title,
      summary: input.summary ?? null,
      status: input.status ?? 'open',
      parent_ref: input.parent_ref as PacketRef,
      topic_ref: input.topic_ref as PacketRef,
      root_message_ref: input.root_message_ref ?? null,
      content_markdown: input.content_markdown ?? '',
    };
  },
  prepareMetadataSummary: (input) =>
    input.summary ?? (input.content_markdown ? createTextExcerpt(input.content_markdown) : null),
};
