/**
 * File: discussions.tsx
 * Description: Renders the packet-backed Nexus discussions surface with chunked forum feeds, collapsible reply trees, and universal packet voting.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  GestureResponderEvent,
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusPreviewTargetParams } from '@app/components/nexus/preview';
import { NexusTabStack, type NexusTabNode } from '@app/components/nexus/ui/tabs/nexus-tabs';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
  useNexusAppearance,
} from '@app/components/nexus/nexus-ui';
import { useIdentityShell } from '@app/components/nexus/identity-shell-context';
import type {
  NexusDiscussionPost,
  NexusDiscussionReply,
  NexusDiscussionThreadPayload,
  NexusDiscussionsPayload,
  NexusDiscussionWorkspacePayload,
} from '@runtime/nexus/nexus-api-types';
import {
  fetchNexusDiscussionReplyChildrenPayload,
  fetchNexusDiscussionsPayload,
  fetchNexusDiscussionWorkspacePayload,
} from '@runtime/nexus/nexus-query-api';

const DISCUSSION_WORKSPACE_VIEWS = ['feed', 'thread', 'post'] as const;
const FEED_SORT_OPTIONS = ['new', 'top', 'controversial', 'old'] as const;
const REPLY_SORT_OPTIONS = ['new', 'top', 'controversial', 'old'] as const;
const FEED_PAGE_LIMIT = 20;
const REPLY_PAGE_LIMIT = 10;
const AUTO_LOAD_THRESHOLD = 180;

type DiscussionWorkspaceView = (typeof DISCUSSION_WORKSPACE_VIEWS)[number];
type FeedSort = (typeof FEED_SORT_OPTIONS)[number];
type ReplySort = (typeof REPLY_SORT_OPTIONS)[number];

type InlineReplyComposerProps = {
  appearance: ReturnType<typeof useNexusAppearance>;
  targetLabel: string;
  viewerLabel: string;
  value: string;
  error: string | null;
  disabled: boolean;
  isSubmitting: boolean;
  onChangeText: (nextValue: string) => void;
  onCancel: () => void;
  onSubmit: () => void;
};

type DiscussionVotePillProps = {
  score: number;
  viewerValue: 'up' | 'down' | null;
  canVote: boolean;
  disabled: boolean;
  onVote: (event: GestureResponderEvent, value: 'up' | 'down') => void;
};

type ReplyBranchState = {
  replies: NexusDiscussionReply[];
  nextCursor: string | null;
  hasMore: boolean;
};

type ReplyBranchStateMap = Record<string, ReplyBranchState>;
type ReplyLoadingStateMap = Record<string, boolean>;
type ReplyExpansionState = Record<string, boolean>;

type ReplyNodeProps = {
  reply: NexusDiscussionReply;
  appearance: ReturnType<typeof useNexusAppearance>;
  highlightedPostId: string | null;
  replyTargetPacketId: string | null;
  canVote: boolean;
  canReply: boolean;
  viewerLabel: string;
  replyBody: string;
  replyError: string | null;
  isSubmittingReply: boolean;
  pendingVotePacketId: string | null;
  branchStates: ReplyBranchStateMap;
  branchLoadingStates: ReplyLoadingStateMap;
  replyExpansionState: ReplyExpansionState;
  onToggleReplyExpansion: (reply: NexusDiscussionReply) => void;
  onEnsureReplyChildren: (reply: NexusDiscussionReply) => void;
  onLoadMoreReplyChildren: (reply: NexusDiscussionReply) => void;
  onReply: (postId: string) => void;
  onVote: (post: NexusDiscussionPost, value: 'up' | 'down') => void;
  onChangeReplyBody: (nextValue: string) => void;
  onSubmitReply: () => void;
};

type ReplyTreeProps = Omit<ReplyNodeProps, 'reply'> & {
  replies: NexusDiscussionReply[];
};

function normalizeQueryValue(
  value: string | string[] | undefined
): string | null {
  if (typeof value === 'string' && value.trim().length > 0) {
    return value;
  }

  if (Array.isArray(value) && value[0]?.trim().length) {
    return value[0];
  }

  return null;
}

function normalizeBooleanQueryValue(
  value: string | string[] | undefined
): boolean {
  return normalizeQueryValue(value) === 'true';
}

/**
 * Inputs: a raw workspace query value and whether a thread is selected.
 * Output: the normalized discussions workspace tab that should be visible.
 */
function normalizeWorkspaceView(
  value: string | string[] | undefined,
  hasSelectedThread: boolean
): DiscussionWorkspaceView {
  const normalizedValue = normalizeQueryValue(value);

  if (
    normalizedValue &&
    (DISCUSSION_WORKSPACE_VIEWS as readonly string[]).includes(normalizedValue)
  ) {
    return normalizedValue as DiscussionWorkspaceView;
  }

  return hasSelectedThread ? 'thread' : 'feed';
}

function isDiscussionPostRouteTarget(input: {
  packetId: string | null;
  packetType: string | null;
}): boolean {
  if (!input.packetId) {
    return false;
  }

  if (input.packetType) {
    return (
      input.packetType === 'Discussion' ||
      input.packetType === 'Discussion'
    );
  }

  return (
    input.packetId.includes('/post/') ||
    input.packetId.includes('/reply/')
  );
}

function resolvePreviewDiscussionPostTargetId(input: {
  packetId: string | null;
  focusPacketId: string | null;
  packetType: string | null;
}): string | null {
  if (
    isDiscussionPostRouteTarget({
      packetId: input.focusPacketId,
      packetType: input.packetType,
    })
  ) {
    return input.focusPacketId;
  }

  if (
    isDiscussionPostRouteTarget({
      packetId: input.packetId,
      packetType: input.packetType,
    })
  ) {
    return input.packetId;
  }

  return null;
}

function getDiscussionHref(input: {
  forumId: string | null;
  sort: string | null;
  view?: DiscussionWorkspaceView | null;
  postId?: string | null;
  replyTargetId?: string | null;
  replySort?: string | null;
  showHidden?: boolean;
}): Href {
  const searchParams = new URLSearchParams();

  if (input.forumId) {
    searchParams.set('forum', input.forumId);
  }

  if (input.sort) {
    searchParams.set('sort', input.sort);
  }

  if (input.view) {
    searchParams.set('view', input.view);
  }

  if (input.postId) {
    searchParams.set('post', input.postId);
  }

  if (input.replyTargetId) {
    searchParams.set('replyTo', input.replyTargetId);
  }

  if (input.replySort) {
    searchParams.set('replySort', input.replySort);
  }

  if (input.showHidden) {
    searchParams.set('showHidden', 'true');
  }

  const queryString = searchParams.toString();

  return `/nexus/discussions${queryString.length > 0 ? `?${queryString}` : ''}` as Href;
}

function formatTimestamp(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Inputs: a scroll event.
 * Output: whether the scroll position is close enough to the bottom to auto-load more content.
 */
function shouldAutoLoadMore(
  event: NativeSyntheticEvent<NativeScrollEvent>
): boolean {
  const { contentOffset, contentSize, layoutMeasurement } = event.nativeEvent;

  return (
    contentOffset.y + layoutMeasurement.height >=
    contentSize.height - AUTO_LOAD_THRESHOLD
  );
}

/**
 * Inputs: already-loaded items plus one incoming page.
 * Output: one deduplicated array that preserves existing order and appends new items.
 */
function mergePagedPosts<T extends { packet: { packet_id: string } }>(
  currentItems: T[],
  nextItems: T[]
): T[] {
  const seenPacketIds = new Set(currentItems.map((item) => item.packet.packet_id));
  const mergedItems = [...currentItems];

  for (const nextItem of nextItems) {
    if (seenPacketIds.has(nextItem.packet.packet_id)) {
      continue;
    }

    seenPacketIds.add(nextItem.packet.packet_id);
    mergedItems.push(nextItem);
  }

  return mergedItems;
}

/**
 * Inputs: loaded replies, branch state map, and a target packet id.
 * Output: the first loaded reply that matches that id.
 */
function findLoadedReplyById(
  replies: NexusDiscussionReply[],
  branchStates: ReplyBranchStateMap,
  targetPacketId: string
): NexusDiscussionReply | null {
  for (const reply of replies) {
    if (reply.packet.packet_id === targetPacketId) {
      return reply;
    }

    const childReplies = branchStates[reply.packet.packet_id]?.replies ?? reply.replies;
    const matchingChildReply = findLoadedReplyById(
      childReplies,
      branchStates,
      targetPacketId
    );

    if (matchingChildReply) {
      return matchingChildReply;
    }
  }

  return null;
}

function mapReplyTree(
  replies: NexusDiscussionReply[],
  mapReply: (reply: NexusDiscussionReply) => NexusDiscussionReply
): NexusDiscussionReply[] {
  return replies.map((reply) => {
    const nextReply = mapReply(reply);
    const nextChildren =
      nextReply.replies.length > 0 ? mapReplyTree(nextReply.replies, mapReply) : nextReply.replies;

    return nextChildren === nextReply.replies
      ? nextReply
      : {
          ...nextReply,
          replies: nextChildren,
        };
  });
}

function updateReplyProjectionCollections(
  updateReply: (reply: NexusDiscussionReply) => NexusDiscussionReply,
  rootReplies: NexusDiscussionReply[],
  branchStates: ReplyBranchStateMap
) {
  return {
    nextRootReplies: mapReplyTree(rootReplies, updateReply),
    nextBranchStates: Object.fromEntries(
      Object.entries(branchStates).map(([parentPacketId, branchState]) => [
        parentPacketId,
        {
          ...branchState,
          replies: mapReplyTree(branchState.replies, updateReply),
        },
      ])
    ) as ReplyBranchStateMap,
  };
}

/**
 * Inputs: a reply count.
 * Output: a human-scannable reply label.
 */
function formatReplyLabel(replyCount: number): string {
  return `${replyCount} ${replyCount === 1 ? 'reply' : 'replies'}`;
}

/**
 * Inputs: none.
 * Output: shared classes for the combined vote pill.
 */
function useVotePillClasses() {
  const { themeMode } = useNexusShell();

  return {
    containerClass:
      themeMode === 'dark'
        ? 'border-nexus-line/70 bg-white/5'
        : 'border-slate-300 bg-slate-100',
    dividerClass:
      themeMode === 'dark' ? 'border-nexus-line/70' : 'border-slate-300',
    buttonClass:
      themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900',
  };
}

function InlineReplyComposer({
  appearance,
  targetLabel,
  viewerLabel,
  value,
  error,
  disabled,
  isSubmitting,
  onChangeText,
  onCancel,
  onSubmit,
}: InlineReplyComposerProps) {
  return (
    <NexusCard className="gap-4 border-nexus-sky/60 p-4">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Reply composer
        </Text>
        <Text className={appearance.sectionBodyClass}>{targetLabel}</Text>
      </View>

      <View className="flex-row flex-wrap gap-2">
        <NexusBadge label={`posting as ${viewerLabel}`} tone="sky" />
        <NexusBadge label="nested reply" tone="default" />
      </View>

      <TextInput
        className={`min-h-[120px] rounded-[24px] border px-4 py-4 ${appearance.textInputClass}`}
        multiline
        onChangeText={onChangeText}
        placeholder="Write a reply."
        placeholderTextColor={appearance.textInputPlaceholderColor}
        textAlignVertical="top"
        value={value}
      />

      {error ? (
        <Text className="text-sm leading-6 text-nexus-rose">{error}</Text>
      ) : null}

      <View className="flex-row flex-wrap items-center gap-2">
        <NexusActionButton
          label="Cancel"
          onPress={onCancel}
        />
        <NexusActionButton
          label={isSubmitting ? 'Replying...' : 'Post reply'}
          onPress={onSubmit}
          disabled={disabled}
          variant="primary"
        />
      </View>
    </NexusCard>
  );
}

function DiscussionVotePill({
  score,
  viewerValue,
  canVote,
  disabled,
  onVote,
}: DiscussionVotePillProps) {
  const { containerClass, dividerClass, buttonClass } = useVotePillClasses();
  const { themeMode } = useNexusShell();
  const scoreClass =
    score < 0
      ? 'text-nexus-rose'
      : score > 0
        ? 'text-nexus-mint'
        : buttonClass;
  const activeVoteSegmentClass =
    themeMode === 'dark'
      ? 'bg-nexus-sky/12 text-nexus-sky'
      : 'bg-sky-100 text-sky-700';

  return (
    <View className={`flex-row items-center overflow-hidden rounded-full border ${containerClass}`}>
        <Pressable
          accessibilityRole="button"
          className={`px-4 py-2.5 ${viewerValue === 'up' ? activeVoteSegmentClass : ''}`}
          disabled={!canVote || disabled}
          onPress={(event) => onVote(event, 'up')}
        >
          <Text
            className={`text-sm font-semibold ${
              viewerValue === 'up' ? '' : buttonClass
            }`}
          >
            +1
          </Text>
        </Pressable>
        <View className={`border-l px-4 py-2.5 ${dividerClass}`}>
          <Text className={`text-sm font-semibold ${scoreClass}`}>{score}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          className={`border-l px-4 py-2.5 ${dividerClass} ${
            viewerValue === 'down' ? activeVoteSegmentClass : ''
          }`}
          disabled={!canVote || disabled}
          onPress={(event) => onVote(event, 'down')}
        >
          <Text
            className={`text-sm font-semibold ${
              viewerValue === 'down' ? '' : buttonClass
            }`}
          >
            -1
          </Text>
        </Pressable>
    </View>
  );
}

function ReplyCountPill({ replyLabel }: { replyLabel: string }) {
  const { containerClass } = useVotePillClasses();
  const { themeMode } = useNexusShell();
  const textClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';

  return (
    <View className={`rounded-full border px-4 py-2.5 ${containerClass}`}>
      <Text className={`text-sm font-semibold ${textClass}`}>{replyLabel}</Text>
    </View>
  );
}

function ReplyNode({
  reply,
  appearance,
  highlightedPostId,
  replyTargetPacketId,
  canVote,
  canReply,
  viewerLabel,
  replyBody,
  replyError,
  isSubmittingReply,
  pendingVotePacketId,
  branchStates,
  branchLoadingStates,
  replyExpansionState,
  onToggleReplyExpansion,
  onEnsureReplyChildren,
  onLoadMoreReplyChildren,
  onReply,
  onVote,
  onChangeReplyBody,
  onSubmitReply,
}: ReplyNodeProps) {
  const { themeMode } = useNexusShell();
  const isHighlighted = reply.packet.packet_id === highlightedPostId;
  const isReplyTarget = reply.packet.packet_id === replyTargetPacketId;
  const childBranchState = branchStates[reply.packet.packet_id];
  const childReplies = childBranchState?.replies ?? reply.replies;
  const childHasMore = childBranchState?.hasMore ?? reply.child_page.has_more;
  const isLoadingChildren =
    branchLoadingStates[reply.packet.packet_id] ?? false;
  const collapsedBranchCount = reply.descendant_count + 1;
  const isExpanded =
    replyExpansionState[reply.packet.packet_id] === true ||
    (replyExpansionState[reply.packet.packet_id] !== false &&
      !reply.is_collapsed_by_default);
  const canLoadChildren = reply.reply_count > 0;
  const railButtonClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const railLineClass = themeMode === 'dark' ? 'bg-nexus-line/60' : 'bg-slate-300';
  const railBubbleTextClass =
    themeMode === 'dark' ? 'text-nexus-text' : 'text-slate-900';
  const replyAction = reply.actions['discussion.reply'];
  const voteUpAction = reply.actions['discussion.vote_up'];
  const branchAction = reply.actions['discussion.expand_branch'];
  const loadMoreAction = reply.actions['discussion.load_more_replies'];
  const canReplyHere = replyAction?.visible !== false;
  const isReplyEnabled = replyAction?.enabled ?? canReply;
  const canVoteHere = voteUpAction?.enabled ?? canVote;
  const canToggleBranch = branchAction?.visible !== false && canLoadChildren;
  const canLoadMoreChildren = loadMoreAction?.visible !== false && childHasMore;

  useEffect(() => {
    if (
      !isExpanded ||
      !canLoadChildren ||
      childReplies.length > 0 ||
      isLoadingChildren
    ) {
      return;
    }

    onEnsureReplyChildren(reply);
  }, [
    canLoadChildren,
    childReplies.length,
    isExpanded,
    isLoadingChildren,
    onEnsureReplyChildren,
    reply,
  ]);

  return (
    <View className="flex-row items-stretch gap-3">
      <View className="w-8 items-center">
        <View className="mt-4 gap-2">
          <Pressable
            accessibilityRole="button"
            className={`h-10 w-10 flex-row items-center justify-center gap-0.5 rounded-full border ${railButtonClass}`}
            disabled={!canToggleBranch}
            onPress={() => onToggleReplyExpansion(reply)}
          >
            <Text className={`text-[10px] font-semibold ${railBubbleTextClass}`}>
              {isExpanded ? '<' : '>'}
            </Text>
            <Text className={`text-[10px] font-semibold ${railBubbleTextClass}`}>
              {collapsedBranchCount}
            </Text>
          </Pressable>
        </View>
        <View className={`mt-2 w-px flex-1 ${railLineClass}`} />
      </View>

      <View className="min-w-0 flex-1 gap-3">
        {!isExpanded ? (
          <View className="mt-4 min-h-[52px] justify-center gap-1">
            <Text className={appearance.itemMetaClass}>
              {reply.author_label} - {formatTimestamp(reply.created_at)}
            </Text>
            <Text className={appearance.itemBodyClass} numberOfLines={2}>
              {reply.content_markdown}
            </Text>
          </View>
        ) : null}

        {isExpanded ? (
          <NexusCard
            className={`gap-3 p-4 ${
              isReplyTarget || isHighlighted ? 'border-nexus-sky/70 bg-nexus-panel' : ''
            }`}
          >
            <Text className={appearance.itemMetaClass}>
              {reply.author_label} - {formatTimestamp(reply.created_at)}
            </Text>

            <Text className={appearance.itemBodyClass}>
              {reply.content_markdown}
            </Text>

            <View className="flex-row flex-wrap items-center gap-2">
              <DiscussionVotePill
                score={reply.vote_summary.net_score}
                viewerValue={reply.vote_summary.viewer_value}
                canVote={canVoteHere}
                disabled={pendingVotePacketId === reply.packet.packet_id}
                onVote={(event, value) => {
                  event.stopPropagation?.();
                  onVote(reply, value);
                }}
              />
              {isHighlighted ? <NexusBadge label="focused" tone="mint" /> : null}
              {isReplyTarget ? <NexusBadge label="reply target" tone="sky" /> : null}
              <NexusActionButton
                label={isReplyTarget ? 'Reply target' : 'Reply here'}
                onPress={() => onReply(reply.packet.packet_id)}
              />
            </View>

            {isReplyTarget ? (
            <InlineReplyComposer
              appearance={appearance}
              targetLabel={`Replying to ${reply.author_label} - ${formatTimestamp(
                reply.created_at
              )}`}
                viewerLabel={viewerLabel}
                value={replyBody}
              error={replyError}
              disabled={!replyBody.trim() || isSubmittingReply || !isReplyEnabled}
              isSubmitting={isSubmittingReply}
              onChangeText={onChangeReplyBody}
              onCancel={() => onReply('')}
              onSubmit={onSubmitReply}
            />
          ) : null}
          </NexusCard>
        ) : null}

        {isExpanded ? (
          <View className="gap-3">
            {childReplies.length > 0 ? (
              <ReplyTree
                replies={childReplies}
                appearance={appearance}
                highlightedPostId={highlightedPostId}
                replyTargetPacketId={replyTargetPacketId}
                canVote={canVote}
                canReply={canReply}
                viewerLabel={viewerLabel}
                replyBody={replyBody}
                replyError={replyError}
                isSubmittingReply={isSubmittingReply}
                pendingVotePacketId={pendingVotePacketId}
                branchStates={branchStates}
                branchLoadingStates={branchLoadingStates}
                replyExpansionState={replyExpansionState}
                onToggleReplyExpansion={onToggleReplyExpansion}
                onEnsureReplyChildren={onEnsureReplyChildren}
                onLoadMoreReplyChildren={onLoadMoreReplyChildren}
                onReply={onReply}
                onVote={onVote}
                onChangeReplyBody={onChangeReplyBody}
                onSubmitReply={onSubmitReply}
              />
            ) : null}

            {isLoadingChildren ? (
              <Text className={appearance.itemMetaClass}>Loading replies...</Text>
            ) : null}

            {canLoadMoreChildren ? (
              <NexusActionButton
                label="Load more replies"
                onPress={() => onLoadMoreReplyChildren(reply)}
              />
            ) : null}
          </View>
        ) : null}
      </View>
    </View>
  );
}

function ReplyTree(props: ReplyTreeProps) {
  const { replies, ...replyNodeProps } = props;

  return (
    <View className="gap-3">
      {replies.map((reply) => (
        <ReplyNode
          key={reply.packet.packet_id}
          reply={reply}
          {...replyNodeProps}
        />
      ))}
    </View>
  );
}

export default function NexusDiscussionsPage() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{
    forum?: string | string[];
    sort?: string | string[];
    view?: string | string[];
    post?: string | string[];
    replyTo?: string | string[];
    replySort?: string | string[];
    target_packet_id?: string | string[];
    focus_packet_id?: string | string[];
    highlight_packet_id?: string | string[];
    showHidden?: string | string[];
  }>();
  const { activeScope, themeMode } = useNexusShell();
  const {
    currentActorPacketId,
    currentIdentity,
    currentLabel,
    runFortressMutation,
  } = useIdentityShell();
  const writeScopeId =
    activeScope.id === 'you' && currentActorPacketId
      ? currentActorPacketId
      : activeScope.id;
  const appearance = useNexusAppearance();
  const previewTargetParams = useNexusPreviewTargetParams();
  const requestedForumId = normalizeQueryValue(localParams.forum);
  const previewDiscussionPostTargetId = resolvePreviewDiscussionPostTargetId({
    packetId: previewTargetParams.packetId,
    focusPacketId: previewTargetParams.focusPacketId,
    packetType: previewTargetParams.packetType,
  });
  const requestedNavigationTargetPacketId =
    normalizeQueryValue(localParams.target_packet_id) ?? previewTargetParams.packetId;
  const requestedNavigationFocusPacketId =
    normalizeQueryValue(localParams.focus_packet_id) ?? previewTargetParams.focusPacketId;
  const requestedNavigationHighlightPacketId =
    normalizeQueryValue(localParams.highlight_packet_id) ?? previewTargetParams.highlightPacketId;
  const requestedPostId =
    normalizeQueryValue(localParams.post) ?? previewDiscussionPostTargetId;
  const requestedWorkspaceView = normalizeWorkspaceView(
    localParams.view,
    Boolean(requestedPostId || requestedNavigationTargetPacketId)
  );
  const requestedReplyTargetId = normalizeQueryValue(localParams.replyTo);
  const requestedSort = normalizeQueryValue(localParams.sort);
  const requestedReplySort = normalizeQueryValue(localParams.replySort);
  const requestedShowHidden = normalizeBooleanQueryValue(localParams.showHidden);
  const requestedPreviewHighlightId =
    requestedNavigationHighlightPacketId ??
    requestedNavigationFocusPacketId ??
    requestedNavigationTargetPacketId;
  const hasDiscussionFocusRoute = Boolean(
    requestedNavigationTargetPacketId ||
      requestedNavigationFocusPacketId ||
      requestedNavigationHighlightPacketId
  );

  const [feedPayload, setFeedPayload] = useState<NexusDiscussionsPayload | null>(null);
  const [threadPayload, setThreadPayload] =
    useState<NexusDiscussionThreadPayload | null>(null);
  const [workspacePayload, setWorkspacePayload] =
    useState<NexusDiscussionWorkspacePayload | null>(null);
  const [feedPosts, setFeedPosts] = useState<NexusDiscussionPost[]>([]);
  const [feedNextCursor, setFeedNextCursor] = useState<string | null>(null);
  const [feedHasMore, setFeedHasMore] = useState(false);
  const [rootReplies, setRootReplies] = useState<NexusDiscussionReply[]>([]);
  const [rootRepliesNextCursor, setRootRepliesNextCursor] = useState<string | null>(
    null
  );
  const [rootRepliesHasMore, setRootRepliesHasMore] = useState(false);
  const [replyBranchStates, setReplyBranchStates] = useState<ReplyBranchStateMap>(
    {}
  );
  const [replyBranchLoadingStates, setReplyBranchLoadingStates] =
    useState<ReplyLoadingStateMap>({});
  const [replyExpansionState, setReplyExpansionState] =
    useState<ReplyExpansionState>({});
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingMoreFeed, setIsLoadingMoreFeed] = useState(false);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
  const [isLoadingMoreRootReplies, setIsLoadingMoreRootReplies] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [threadError, setThreadError] = useState<string | null>(null);
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [replyBody, setReplyBody] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [replyError, setReplyError] = useState<string | null>(null);
  const [voteError, setVoteError] = useState<string | null>(null);
  const [isSubmittingPost, setIsSubmittingPost] = useState(false);
  const [isSubmittingReply, setIsSubmittingReply] = useState(false);
  const [isAddingDiscussionSurfaces, setIsAddingDiscussionSurfaces] =
    useState(false);
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [pendingVotePacketId, setPendingVotePacketId] = useState<string | null>(null);

  useEffect(() => {
    if (requestedPreviewHighlightId) {
      setHighlightedPostId(requestedPreviewHighlightId);
    }
  }, [requestedPreviewHighlightId]);

  const selectedForum =
    feedPayload?.forums.find((forum) => forum.id === feedPayload.selected_forum_id) ??
    null;
  const selectedFeedSort = (feedPayload?.selected_sort ?? 'new') as FeedSort;
  const selectedReplySort = (threadPayload?.selected_reply_sort ?? 'new') as ReplySort;
  const selectedViewer =
    threadPayload?.viewer ??
    feedPayload?.viewer ??
    workspacePayload?.workspace.viewer ??
    null;
  const activeForumId = feedPayload?.selected_forum_id ?? requestedForumId;
  const createTopLevelAction =
    workspacePayload?.workspace.workspace_actions['discussion.create_top_level'] ??
    null;
  const canCreateTopLevel =
    createTopLevelAction?.enabled ?? selectedViewer?.can_create_top_level ?? false;
  const canReply = selectedViewer?.can_reply ?? false;
  const canVote = selectedViewer?.can_vote ?? false;
  const communityClaimRequired =
    createTopLevelAction?.auth_gate_reason === 'community_claim_required' ||
    selectedViewer?.write_block_reason === 'residence_required';
  const canAddDiscussionSurfaces =
    activeScope.level !== 'personal' && activeScope.level !== 'global';
  const topLevelPostingLocked =
    Boolean(selectedViewer) && !canCreateTopLevel;
  const isFeedWorkspace = requestedWorkspaceView === 'feed';
  const isThreadWorkspace = requestedWorkspaceView === 'thread';
  const isPostWorkspace = requestedWorkspaceView === 'post';
  const discussionTabTree = (feedPayload?.forums ?? []).map<NexusTabNode>((forum) => ({
    id: forum.id,
    label: forum.title,
    kind: 'view',
    defaultChildId: 'feed',
    children: [
      {
        id: 'feed',
        label: 'Feed',
        kind: 'view',
        defaultChildId: selectedFeedSort,
        children: FEED_SORT_OPTIONS.map((sortOption) => ({
          id: sortOption,
          label: sortOption.replace(/_/g, ' '),
          kind: 'sort',
        })),
      },
      {
        id: 'thread',
        label: 'Thread',
        kind: 'view',
        defaultChildId: selectedReplySort,
        children: REPLY_SORT_OPTIONS.map((sortOption) => ({
          id: sortOption,
          label: sortOption.replace(/_/g, ' '),
          kind: 'sort',
        })),
      },
      {
        id: 'post',
        label: 'Post',
        kind: 'compose',
      },
    ],
  }));
  const discussionTabPath = [
    activeForumId,
    requestedWorkspaceView,
    requestedWorkspaceView === 'thread'
      ? selectedReplySort
      : requestedWorkspaceView === 'feed'
        ? selectedFeedSort
        : null,
  ].filter((pathSegment): pathSegment is string => Boolean(pathSegment));
  const handleDiscussionTabPathChange = useCallback(
    (nextPath: string[]) => {
      const [nextForumId, requestedViewId, requestedSubtabId] = nextPath;
      const nextView = (DISCUSSION_WORKSPACE_VIEWS as readonly string[]).includes(
        requestedViewId ?? ''
      )
        ? (requestedViewId as DiscussionWorkspaceView)
        : 'feed';
      const nextFeedSort =
        nextView === 'feed' &&
        (FEED_SORT_OPTIONS as readonly string[]).includes(requestedSubtabId ?? '')
          ? (requestedSubtabId as FeedSort)
          : selectedFeedSort;
      const nextReplySort =
        nextView === 'thread' &&
        (REPLY_SORT_OPTIONS as readonly string[]).includes(requestedSubtabId ?? '')
          ? (requestedSubtabId as ReplySort)
          : selectedReplySort;

      router.replace(
        getDiscussionHref({
          forumId: nextForumId ?? activeForumId,
          sort: nextFeedSort,
          view: nextView,
          postId: nextView === 'thread' ? requestedPostId : null,
          replySort: nextView === 'thread' ? nextReplySort : null,
          showHidden: requestedShowHidden,
        })
      );
    },
    [
      activeForumId,
      requestedPostId,
      requestedShowHidden,
      router,
      selectedFeedSort,
      selectedReplySort,
    ]
  );
  const forumShellClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-nexus-panel'
      : 'border-slate-300 bg-white';
  const feedListClass =
    themeMode === 'dark'
      ? 'rounded-[24px] border border-nexus-line/50 bg-transparent lg:max-h-[980px]'
      : 'rounded-[24px] border border-slate-300 bg-transparent lg:max-h-[980px]';
  const threadListClass =
    themeMode === 'dark'
      ? 'rounded-[24px] border border-nexus-line/50 bg-transparent lg:max-h-[1020px]'
      : 'rounded-[24px] border border-slate-300 bg-transparent lg:max-h-[1020px]';
  const metaRowClass =
    themeMode === 'dark' ? 'text-nexus-muted' : 'text-slate-600';
  const cardTitleClass =
    themeMode === 'dark'
      ? 'text-xl font-semibold text-nexus-text'
      : 'text-xl font-semibold text-slate-900';
  const rootTitleClass =
    themeMode === 'dark'
      ? 'text-2xl font-semibold text-nexus-text'
      : 'text-2xl font-semibold text-slate-900';
  const resolvedThreadPostId = threadPayload?.root_post.packet.packet_id ?? requestedPostId;
  const currentDiscussionReturnHref = String(
    getDiscussionHref({
      forumId: activeForumId,
      sort: selectedFeedSort,
      view: requestedWorkspaceView,
      postId: resolvedThreadPostId,
      replyTargetId: requestedReplyTargetId,
      replySort: selectedReplySort,
      showHidden: requestedShowHidden,
    })
  );
  const { authGateModal, guardNexusWrite, openNexusAuthGate, openNexusAuthGateForError } =
    useNexusAuthGate({
      returnTo: currentDiscussionReturnHref,
      returnScopeId: activeScope.id,
    });

  const replyTargetLabel = useMemo(() => {
    if (!requestedReplyTargetId) {
      return null;
    }

    if (threadPayload?.root_post.packet.packet_id === requestedReplyTargetId) {
      return 'Replying to OP';
    }

    const targetReply = findLoadedReplyById(
      rootReplies,
      replyBranchStates,
      requestedReplyTargetId
    );

    return targetReply
      ? `Replying to ${targetReply.author_label} - ${formatTimestamp(
          targetReply.created_at
        )}`
      : null;
  }, [replyBranchStates, requestedReplyTargetId, rootReplies, threadPayload]);

  /**
   * Inputs: append flag and optional cursor.
   * Output: refreshes the current feed page window.
   */
  const loadFeed = useCallback(
    async (input?: { cursor?: string | null; append?: boolean }) => {
      const shouldAppend = input?.append === true;

      if (shouldAppend) {
        setIsLoadingMoreFeed(true);
      } else {
        setIsLoadingFeed(true);
        setFeedError(null);
      }

      try {
        const nextFeedPayload = await fetchNexusDiscussionsPayload({
          scopeId: activeScope.id,
          forumId: requestedForumId,
          sort: requestedSort ?? 'new',
          showHidden: requestedShowHidden,
          viewerActorPacketId: currentActorPacketId,
          cursor: input?.cursor ?? null,
          limit: FEED_PAGE_LIMIT,
        });

        setFeedPayload(nextFeedPayload);
        setFeedPosts((currentPosts) =>
          shouldAppend
            ? mergePagedPosts(currentPosts, nextFeedPayload.top_level_posts)
            : nextFeedPayload.top_level_posts
        );
        setFeedNextCursor(nextFeedPayload.next_cursor);
        setFeedHasMore(nextFeedPayload.has_more);
      } catch (error) {
        setFeedError(
          error instanceof Error
            ? error.message
            : 'Unable to load the discussion feed.'
        );

        if (!shouldAppend) {
          setFeedPayload(null);
          setFeedPosts([]);
          setFeedNextCursor(null);
          setFeedHasMore(false);
        }
      } finally {
        if (shouldAppend) {
          setIsLoadingMoreFeed(false);
        } else {
          setIsLoadingFeed(false);
        }
      }
    },
    [
      activeScope.id,
      currentActorPacketId,
      requestedForumId,
      requestedShowHidden,
      requestedSort,
    ]
  );

  /**
   * Inputs: the current route-level workspace selection.
   * Output: refreshes the additive workspace payload plus the visible feed/thread slices.
   */
  const loadWorkspace = useCallback(async () => {
    setIsLoadingFeed(true);
    setIsLoadingThread(Boolean(requestedPostId || requestedNavigationTargetPacketId));
    setFeedError(null);
    setThreadError(null);

    try {
      const nextWorkspacePayload = await fetchNexusDiscussionWorkspacePayload({
        scopeId: activeScope.id,
        forumId: requestedForumId,
        sort: requestedSort ?? 'new',
        view: requestedWorkspaceView,
        postId: requestedPostId,
        targetPacketId: requestedNavigationTargetPacketId,
        focusPacketId: requestedNavigationFocusPacketId,
        highlightPacketId: requestedNavigationHighlightPacketId,
        replyTargetId: requestedReplyTargetId,
        replySort: requestedReplySort ?? 'new',
        showHidden: requestedShowHidden,
        viewerActorPacketId: currentActorPacketId,
        feedLimit: FEED_PAGE_LIMIT,
        replyLimit: REPLY_PAGE_LIMIT,
      });

      setWorkspacePayload(nextWorkspacePayload);
      setFeedPayload(nextWorkspacePayload.feed);
      setFeedPosts(nextWorkspacePayload.feed.top_level_posts);
      setFeedNextCursor(nextWorkspacePayload.feed.next_cursor);
      setFeedHasMore(nextWorkspacePayload.feed.has_more);
      setThreadPayload(nextWorkspacePayload.thread);
      setRootReplies(nextWorkspacePayload.thread?.replies ?? []);
      setRootRepliesNextCursor(nextWorkspacePayload.thread?.next_cursor ?? null);
      setRootRepliesHasMore(nextWorkspacePayload.thread?.has_more ?? false);
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : 'Unable to load the discussion workspace.';

      setFeedError(message);
      setThreadError(requestedPostId ? message : null);
      setWorkspacePayload(null);
      setFeedPayload(null);
      setFeedPosts([]);
      setFeedNextCursor(null);
      setFeedHasMore(false);
      setThreadPayload(null);
      setRootReplies([]);
      setRootRepliesNextCursor(null);
      setRootRepliesHasMore(false);
    } finally {
      setIsLoadingFeed(false);
      setIsLoadingThread(false);
    }
  }, [
    activeScope.id,
    currentActorPacketId,
    requestedForumId,
    requestedNavigationFocusPacketId,
    requestedNavigationHighlightPacketId,
    requestedNavigationTargetPacketId,
    requestedPostId,
    requestedReplySort,
    requestedReplyTargetId,
    requestedShowHidden,
    requestedSort,
    requestedWorkspaceView,
  ]);

  const handleAddDiscussionSurfaces = useCallback(async () => {
    const applyAddDiscussionSurfaces = async () => {
      setIsAddingDiscussionSurfaces(true);
      setFeedError(null);

      try {
        await runFortressMutation<{
          created_packet_refs: { packet_id: string; revision_id: string }[];
          discussions: NexusDiscussionsPayload;
        }>({
          intent: {
            kind: 'discussion.surfaces.ensure',
            scope_id: activeScope.id,
          },
        });
        await loadWorkspace();
      } catch (error) {
        if (openNexusAuthGateForError(error, applyAddDiscussionSurfaces)) {
          return;
        }

        setFeedError(
          error instanceof Error
            ? error.message
            : 'Unable to add discussion forums.'
        );
      } finally {
        setIsAddingDiscussionSurfaces(false);
      }
    };

    await guardNexusWrite(
      {
        requiresClaimedIdentity: true,
        writeRisk: 'standard',
      },
      applyAddDiscussionSurfaces
    );
  }, [
    activeScope.id,
    guardNexusWrite,
    loadWorkspace,
    openNexusAuthGateForError,
    runFortressMutation,
  ]);

  /**
   * Inputs: a reply node plus paging mode.
   * Output: refreshes one branch of direct child replies.
   */
  const loadReplyChildren = useCallback(
    async (input: {
      parentPostPacketId: string;
      cursor?: string | null;
      append?: boolean;
    }) => {
      const rootThreadPacketId =
        threadPayload?.root_post.packet.packet_id ?? requestedPostId;

      if (!rootThreadPacketId) {
        return;
      }

      const shouldAppend = input.append === true;
      setReplyBranchLoadingStates((currentState) => ({
        ...currentState,
        [input.parentPostPacketId]: true,
      }));

      try {
        const nextReplyPage = await fetchNexusDiscussionReplyChildrenPayload({
          scopeId: activeScope.id,
          threadPostPacketId: rootThreadPacketId,
          parentPostPacketId: input.parentPostPacketId,
          replySort: selectedReplySort ?? 'new',
          showHidden: requestedShowHidden,
          viewerActorPacketId: currentActorPacketId,
          cursor: input.cursor ?? null,
          limit: REPLY_PAGE_LIMIT,
        });

        setReplyBranchStates((currentState) => {
          const currentBranch = currentState[input.parentPostPacketId];

          return {
            ...currentState,
            [input.parentPostPacketId]: {
              replies:
                shouldAppend && currentBranch
                  ? mergePagedPosts(currentBranch.replies, nextReplyPage.replies)
                  : nextReplyPage.replies,
              nextCursor: nextReplyPage.next_cursor,
              hasMore: nextReplyPage.has_more,
            },
          };
        });
      } catch (error) {
        setReplyError(
          error instanceof Error
            ? error.message
            : 'Unable to load more replies.'
        );
      } finally {
        setReplyBranchLoadingStates((currentState) => ({
          ...currentState,
          [input.parentPostPacketId]: false,
        }));
      }
    },
    [
      activeScope.id,
      currentActorPacketId,
      requestedPostId,
      requestedShowHidden,
      selectedReplySort,
      threadPayload?.root_post.packet.packet_id,
    ]
  );

  useEffect(() => {
    setSubmitError(null);
    setReplyError(null);
    setVoteError(null);
    void loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    setReplyError(null);
  }, [requestedReplyTargetId]);

  useEffect(() => {
    setHighlightedPostId(null);
    setReplyBranchStates({});
    setReplyBranchLoadingStates({});
    setReplyExpansionState({});
  }, [activeForumId, requestedPostId, requestedReplySort]);

  useEffect(() => {
    if (!requestedReplyTargetId) {
      return;
    }

    setReplyExpansionState((currentState) => ({
      ...currentState,
      [requestedReplyTargetId]: true,
    }));
  }, [requestedReplyTargetId]);

  useEffect(() => {
    if (
      !isThreadWorkspace ||
      requestedPostId ||
      isLoadingFeed ||
      feedPosts.length === 0 ||
      !selectedForum
    ) {
      return;
    }

    router.replace(
      getDiscussionHref({
        forumId: selectedForum.id,
        sort: selectedFeedSort,
        view: 'thread',
        postId: feedPosts[0]?.packet.packet_id ?? null,
        replySort: requestedReplySort ?? null,
        showHidden: requestedShowHidden,
      })
    );
  }, [
    feedPosts,
    isLoadingFeed,
    isThreadWorkspace,
    requestedPostId,
    requestedReplySort,
    requestedShowHidden,
    router,
    selectedFeedSort,
    selectedForum,
  ]);

  /**
   * Inputs: a root post id and optional reply target.
   * Output: switches the current route into the thread workspace.
   */
  const openThreadWorkspace = useCallback(
    (postId: string, replyTargetId: string | null = null) => {
      router.replace(
        getDiscussionHref({
          forumId: activeForumId,
          sort: selectedFeedSort,
          view: 'thread',
          postId,
          replyTargetId,
          replySort: selectedReplySort,
          showHidden: requestedShowHidden,
        })
      );
    },
    [
      activeForumId,
      requestedShowHidden,
      router,
      selectedFeedSort,
      selectedReplySort,
    ]
  );

  /**
   * Inputs: current discussion route state.
   * Output: clears preview-driven focus/highlight without leaving the current thread/feed.
   */
  const clearDiscussionFocus = useCallback(() => {
    setHighlightedPostId(null);
    router.replace(
      getDiscussionHref({
        forumId: activeForumId,
        sort: selectedFeedSort,
        view: requestedWorkspaceView,
        postId: resolvedThreadPostId,
        replyTargetId: requestedReplyTargetId,
        replySort: selectedReplySort,
        showHidden: requestedShowHidden,
      })
    );
  }, [
    activeForumId,
    requestedReplyTargetId,
    resolvedThreadPostId,
    requestedShowHidden,
    requestedWorkspaceView,
    router,
    selectedFeedSort,
    selectedReplySort,
  ]);

  /**
   * Inputs: one vote target plus a vote value.
   * Output: writes the vote and updates any loaded local projections for that post.
   */
  const handleVote = useCallback(
    async (post: NexusDiscussionPost, value: 'up' | 'down') => {
      await guardNexusWrite(
        {
          writeRisk: 'standard',
        },
        async () => {
          if (!currentIdentity) {
            openNexusAuthGate('sign_in_required');
            return;
        }

        setPendingVotePacketId(post.packet.packet_id);
        setVoteError(null);
        const applyVote = async () => {
          const finalizedMutation = await runFortressMutation<{
            target_packet_id: string;
            value: 'up' | 'down' | null;
            summary: NexusDiscussionPost['vote_summary'];
          }>({
            intent: {
              kind: 'reaction.vote.set',
              scope_id: activeScope.id,
              target_packet_id: post.packet.packet_id,
              value: post.vote_summary.viewer_value === value ? null : value,
            },
          });
          const voteResult = finalizedMutation.result;
          const updateReplySummary = (currentReply: NexusDiscussionReply) =>
            currentReply.packet.packet_id === post.packet.packet_id
              ? {
                  ...currentReply,
                  vote_summary: voteResult.summary,
                }
              : currentReply;
          const { nextRootReplies, nextBranchStates } =
            updateReplyProjectionCollections(
              updateReplySummary,
              rootReplies,
              replyBranchStates
            );

          setFeedPosts((currentPosts) =>
            currentPosts.map((currentPost) =>
              currentPost.packet.packet_id === post.packet.packet_id
                ? {
                    ...currentPost,
                    vote_summary: voteResult.summary,
                  }
                : currentPost
            )
          );
          setThreadPayload((currentPayload) =>
            currentPayload &&
            currentPayload.root_post.packet.packet_id === post.packet.packet_id
              ? {
                  ...currentPayload,
                  root_post: {
                    ...currentPayload.root_post,
                    vote_summary: voteResult.summary,
                  },
                }
              : currentPayload
          );
          setRootReplies(nextRootReplies);
          setReplyBranchStates(nextBranchStates);
        };

        try {
          await applyVote();
          } catch (error) {
            if (openNexusAuthGateForError(error, applyVote)) {
              return;
            }

            setVoteError(
              error instanceof Error ? error.message : 'Unable to update that vote.'
            );
          } finally {
            setPendingVotePacketId(null);
          }
        }
      );
    },
    [
      activeScope.id,
      currentIdentity,
      guardNexusWrite,
      openNexusAuthGate,
      openNexusAuthGateForError,
      replyBranchStates,
      rootReplies,
      runFortressMutation,
    ]
  );

  const openCommunityClaimPrompt = useCallback(() => {
    setSubmitError(null);
    setReplyError(null);
    openNexusAuthGate('community_claim_required');
  }, [openNexusAuthGate]);

  const handleOpenPostWorkspace = useCallback(() => {
    if (communityClaimRequired) {
      openCommunityClaimPrompt();
      return;
    }

    router.replace(
      getDiscussionHref({
        forumId: activeForumId,
        sort: selectedFeedSort,
        view: 'post',
        showHidden: requestedShowHidden,
      })
    );
  }, [
    activeForumId,
    communityClaimRequired,
    openCommunityClaimPrompt,
    requestedShowHidden,
    router,
    selectedFeedSort,
  ]);

  const handleStartReply = useCallback(
    (rootPostId: string, replyTargetId: string) => {
      if (communityClaimRequired) {
        openCommunityClaimPrompt();
        return;
      }

      openThreadWorkspace(rootPostId, replyTargetId);
    },
    [communityClaimRequired, openCommunityClaimPrompt, openThreadWorkspace]
  );

  /**
   * Inputs: none.
   * Output: writes a new top-level post and opens it in the thread workspace.
   */
  const handleCreatePost = useCallback(async () => {
    await guardNexusWrite(
      {
        communityClaimRequired,
        writeRisk: 'high_impact',
      },
      async () => {
        if (!selectedForum || !currentIdentity) {
          openNexusAuthGate('sign_in_required');
          return;
        }

        setIsSubmittingPost(true);
        setSubmitError(null);
        const createPost = async () => {
          const finalizedMutation = await runFortressMutation<{
            viewer: unknown;
            post: NexusDiscussionPost;
          }>({
            intent: {
              kind: 'discussion.thread_post.create',
              scope_id: writeScopeId,
              forum_packet_id: selectedForum.forum_packet_id,
              thread_title: draftTitle,
              post_markdown: draftBody,
              related_packet_ids: [],
            },
            writeRisk: 'high_impact',
          });
          const result = finalizedMutation.result;

          setDraftTitle('');
          setDraftBody('');
          await loadWorkspace();
          router.replace(
            getDiscussionHref({
              forumId: selectedForum.id,
              sort: selectedFeedSort,
              view: 'thread',
              postId: result.post.packet.packet_id,
              replySort: selectedReplySort,
              showHidden: requestedShowHidden,
            })
          );
        };

        try {
          await createPost();
        } catch (error) {
          if (openNexusAuthGateForError(error, createPost)) {
            return;
          }

          setSubmitError(
            error instanceof Error
              ? error.message
              : 'Unable to save the discussion post.'
          );
        } finally {
          setIsSubmittingPost(false);
        }
      }
    );
  }, [
    communityClaimRequired,
    currentIdentity,
    draftBody,
    draftTitle,
    guardNexusWrite,
    loadWorkspace,
    openNexusAuthGate,
    openNexusAuthGateForError,
    requestedShowHidden,
    router,
    selectedFeedSort,
    selectedForum,
    selectedReplySort,
    runFortressMutation,
    writeScopeId,
  ]);

  /**
   * Inputs: none.
   * Output: writes a nested reply and refreshes the visible thread state.
   */
  const handleCreateReply = useCallback(async () => {
    await guardNexusWrite(
      {
        communityClaimRequired,
        writeRisk: 'standard',
      },
      async () => {
        if (!requestedReplyTargetId || !threadPayload || !currentIdentity) {
          openNexusAuthGate('sign_in_required');
          return;
        }

        setIsSubmittingReply(true);
        setReplyError(null);
        const createReply = async () => {
          const parentPost =
            requestedReplyTargetId === threadPayload.root_post.packet.packet_id
              ? threadPayload.root_post
              : findLoadedReplyById(
                  rootReplies,
                  replyBranchStates,
                  requestedReplyTargetId
                );

          if (!parentPost) {
            throw new Error('Unable to resolve the reply target for this thread.');
          }

          const finalizedMutation = await runFortressMutation<{
            viewer: unknown;
            post: NexusDiscussionPost;
          }>({
            intent: {
              kind: 'discussion.reply.create',
              scope_id: writeScopeId,
              parent_post_packet_id: requestedReplyTargetId,
              reply_markdown: replyBody,
            },
          });
          const result = finalizedMutation.result;

          setReplyBody('');
          setHighlightedPostId(result.post.packet.packet_id);
          await loadWorkspace();

          if (
            requestedReplyTargetId &&
            threadPayload?.root_post.packet.packet_id &&
            requestedReplyTargetId !== threadPayload.root_post.packet.packet_id
          ) {
            setReplyExpansionState((currentState) => ({
              ...currentState,
              [requestedReplyTargetId]: true,
            }));
            await loadReplyChildren({
              parentPostPacketId: requestedReplyTargetId,
            });
          }

          router.replace(
            getDiscussionHref({
              forumId: activeForumId,
              sort: selectedFeedSort,
              view: 'thread',
              postId: requestedPostId,
              replySort: selectedReplySort,
              showHidden: requestedShowHidden,
            })
          );
        };

        try {
          await createReply();
        } catch (error) {
          if (openNexusAuthGateForError(error, createReply)) {
            return;
          }

          setReplyError(
            error instanceof Error ? error.message : 'Unable to save the reply.'
          );
        } finally {
          setIsSubmittingReply(false);
        }
      }
    );
  }, [
    activeForumId,
    communityClaimRequired,
    currentIdentity,
    guardNexusWrite,
    loadReplyChildren,
    loadWorkspace,
    openNexusAuthGate,
    openNexusAuthGateForError,
    replyBranchStates,
    replyBody,
    rootReplies,
    requestedPostId,
    requestedReplyTargetId,
    requestedShowHidden,
    router,
    selectedFeedSort,
    selectedReplySort,
    runFortressMutation,
    threadPayload,
    writeScopeId,
  ]);

  const handleLoadMoreFeed = useCallback(() => {
    if (!feedHasMore || isLoadingMoreFeed || !feedNextCursor) {
      return;
    }

    void loadFeed({
      cursor: feedNextCursor,
      append: true,
    });
  }, [feedHasMore, feedNextCursor, isLoadingMoreFeed, loadFeed]);

  const handleLoadMoreRootReplies = useCallback(() => {
    if (
      !threadPayload?.root_post.packet.packet_id ||
      !rootRepliesHasMore ||
      isLoadingMoreRootReplies ||
      !rootRepliesNextCursor
    ) {
      return;
    }

    setIsLoadingMoreRootReplies(true);
    void fetchNexusDiscussionReplyChildrenPayload({
      scopeId: activeScope.id,
      threadPostPacketId: threadPayload.root_post.packet.packet_id,
      parentPostPacketId: threadPayload.root_post.packet.packet_id,
      replySort: selectedReplySort,
      showHidden: requestedShowHidden,
      viewerActorPacketId: currentActorPacketId,
      cursor: rootRepliesNextCursor,
      limit: REPLY_PAGE_LIMIT,
    })
      .then((nextReplyPage) => {
        setRootReplies((currentReplies) =>
          mergePagedPosts(currentReplies, nextReplyPage.replies)
        );
        setRootRepliesNextCursor(nextReplyPage.next_cursor);
        setRootRepliesHasMore(nextReplyPage.has_more);
      })
      .catch((error) => {
        setReplyError(
          error instanceof Error
            ? error.message
            : 'Unable to load more replies.'
        );
      })
      .finally(() => {
        setIsLoadingMoreRootReplies(false);
      });
  }, [
    activeScope.id,
    currentActorPacketId,
    isLoadingMoreRootReplies,
    requestedShowHidden,
    rootRepliesHasMore,
    rootRepliesNextCursor,
    selectedReplySort,
    threadPayload?.root_post.packet.packet_id,
  ]);

  const handleToggleReplyExpansion = useCallback((reply: NexusDiscussionReply) => {
    setReplyExpansionState((currentState) => {
      const currentValue =
        currentState[reply.packet.packet_id] ?? !reply.is_collapsed_by_default;

      return {
        ...currentState,
        [reply.packet.packet_id]: !currentValue,
      };
    });
  }, []);

  const handleEnsureReplyChildren = useCallback(
    (reply: NexusDiscussionReply) => {
      const currentBranchState = replyBranchStates[reply.packet.packet_id];
      const currentHasMore =
        currentBranchState?.hasMore ?? reply.child_page.has_more;
      const currentReplies = currentBranchState?.replies ?? reply.replies;

      if (
        currentReplies.length > 0 ||
        !currentHasMore ||
        replyBranchLoadingStates[reply.packet.packet_id]
      ) {
        return;
      }

      void loadReplyChildren({
        parentPostPacketId: reply.packet.packet_id,
      });
    },
    [loadReplyChildren, replyBranchLoadingStates, replyBranchStates]
  );

  const handleLoadMoreReplyChildren = useCallback(
    (reply: NexusDiscussionReply) => {
      const currentBranchState = replyBranchStates[reply.packet.packet_id];
      const nextCursor =
        currentBranchState?.nextCursor ?? reply.child_page.next_cursor;
      const hasMore = currentBranchState?.hasMore ?? reply.child_page.has_more;

      if (!nextCursor || !hasMore) {
        return;
      }

      void loadReplyChildren({
        parentPostPacketId: reply.packet.packet_id,
        cursor: nextCursor,
        append: true,
      });
    },
    [loadReplyChildren, replyBranchStates]
  );

  const handleFeedScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (shouldAutoLoadMore(event)) {
        handleLoadMoreFeed();
      }
    },
    [handleLoadMoreFeed]
  );

  const handleThreadScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (shouldAutoLoadMore(event)) {
        handleLoadMoreRootReplies();
      }
    },
    [handleLoadMoreRootReplies]
  );

  return (
    <View className="flex-1">
      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className={appearance.pageContainerClass}>
        <View className="mx-auto w-full max-w-[1500px] gap-5">
          <NexusSectionHeader
            eyebrow="Discussions"
            title={`${activeScope.name} Discussions`}
            trailing={
              selectedViewer ? (
                <View className="flex-row flex-wrap items-center gap-2">
                  <NexusBadge
                    label={currentLabel ?? selectedViewer.actor_key ?? 'guest'}
                    tone="mint"
                  />
                </View>
              ) : null
            }
          />

          {feedError ? (
            <NexusCard tone="rose">
              <Text className={appearance.itemBodyClass}>{feedError}</Text>
            </NexusCard>
          ) : null}

          {voteError ? (
            <NexusCard tone="rose">
              <Text className={appearance.itemBodyClass}>{voteError}</Text>
            </NexusCard>
          ) : null}

          {discussionTabTree.length > 0 ? (
            <View className="gap-0">
              <NexusTabStack
                tree={discussionTabTree}
                valuePath={discussionTabPath}
                onChangePath={handleDiscussionTabPathChange}
              />

              <NexusCard
                className={`gap-3 rounded-t-none border-t-0 ${forumShellClass}`}
              >
                    {isFeedWorkspace ? (
                      <View className="gap-4">
                        <ScrollView
                          nestedScrollEnabled
                          showsVerticalScrollIndicator={false}
                          keyboardShouldPersistTaps="handled"
                          className={feedListClass}
                          onScroll={handleFeedScroll}
                          scrollEventThrottle={16}
                        >
                          <View className="gap-3 p-3">
                            {isLoadingFeed && feedPosts.length === 0 ? (
                              <Text className={appearance.itemBodyClass}>
                                Loading discussion feed...
                              </Text>
                            ) : null}

                            {!isLoadingFeed && feedPosts.length === 0 ? (
                              <NexusCard tone="default">
                                <Text className={appearance.itemBodyClass}>
                                  No top-level threads are visible in this forum
                                  yet. Use the post tab to start one.
                                </Text>
                              </NexusCard>
                            ) : null}

                            {feedPosts.map((post) => (
                              <Pressable
                                key={post.packet.packet_id}
                                onPress={() =>
                                  openThreadWorkspace(post.packet.packet_id)
                                }
                              >
                                <NexusCard
                                  className={`gap-3 ${
                                    requestedPostId === post.packet.packet_id
                                      ? 'border-nexus-sky/70 bg-nexus-sky/10'
                                      : post.packet.packet_id === highlightedPostId
                                        ? 'border-nexus-sky/70 bg-nexus-sky/10'
                                        : ''
                                  }`}
                                >
                                  <View className="gap-1">
                                    <Text className={metaRowClass}>
                                      {post.author_label} -{' '}
                                      {formatTimestamp(post.created_at)}
                                    </Text>
                                    <Text className={cardTitleClass}>
                                      {post.title}
                                    </Text>
                                  </View>

                                  <Text className={appearance.itemBodyClass}>
                                    {post.excerpt ?? post.content_markdown ?? ''}
                                  </Text>

                                  <View className="flex-row flex-wrap items-center gap-2">
                                    <DiscussionVotePill
                                      score={post.vote_summary.net_score}
                                      viewerValue={
                                        post.vote_summary.viewer_value
                                      }
                                      canVote={
                                        post.actions['discussion.vote_up']?.enabled ??
                                        canVote
                                      }
                                      disabled={
                                        pendingVotePacketId ===
                                        post.packet.packet_id
                                      }
                                      onVote={(event, value) => {
                                        event.stopPropagation?.();
                                        void handleVote(post, value);
                                      }}
                                    />
                                    <ReplyCountPill
                                      replyLabel={formatReplyLabel(
                                        post.descendant_count
                                      )}
                                    />
                                  </View>
                                </NexusCard>
                              </Pressable>
                            ))}

                            {isLoadingMoreFeed ? (
                              <Text className={appearance.itemMetaClass}>
                                Loading more threads...
                              </Text>
                            ) : null}

                            {feedHasMore &&
                            workspacePayload?.workspace.workspace_actions[
                              'discussion.load_more_feed'
                            ]?.visible !== false ? (
                              <NexusActionButton
                                label="Load more threads"
                                onPress={handleLoadMoreFeed}
                              />
                            ) : null}

                            <NexusActionButton
                              label="New post"
                              onPress={handleOpenPostWorkspace}
                            />
                          </View>
                        </ScrollView>
                      </View>
                    ) : null}

                    {isThreadWorkspace ? (
                      <View className="gap-4">
                        <View className="flex-row flex-wrap items-center gap-2">
                          <NexusActionButton
                            label="Back to feed"
                            onPress={() => {
                              router.replace(
                                getDiscussionHref({
                                  forumId: activeForumId,
                                  sort: selectedFeedSort,
                                  view: 'feed',
                                  showHidden: requestedShowHidden,
                                })
                              );
                            }}
                          />
                          {highlightedPostId || hasDiscussionFocusRoute ? (
                            <NexusActionButton
                              label="Dismiss focus"
                              onPress={clearDiscussionFocus}
                              variant="secondary"
                            />
                          ) : null}
                          <NexusActionButton
                            label="New reply"
                            onPress={() => {
                              if (!threadPayload) {
                                return;
                              }

                              handleStartReply(
                                threadPayload.root_post.packet.packet_id,
                                threadPayload.root_post.packet.packet_id
                              );
                            }}
                            disabled={!threadPayload}
                          />
                        </View>

                        {!requestedPostId && isLoadingFeed ? (
                          <Text className={appearance.itemBodyClass}>
                            Loading the top thread...
                          </Text>
                        ) : null}

                        {!requestedPostId && !isLoadingFeed && feedPosts.length === 0 ? (
                          <NexusCard>
                            <Text className={appearance.itemBodyClass}>
                              No thread is selected yet because this forum does
                              not have any visible top-level threads.
                            </Text>
                            <View className="mt-3 flex-row flex-wrap gap-2">
                              <NexusActionButton
                                label="Go to feed"
                                onPress={() => {
                                  router.replace(
                                    getDiscussionHref({
                                      forumId: activeForumId,
                                      sort: selectedFeedSort,
                                      view: 'feed',
                                      showHidden: requestedShowHidden,
                                    })
                                  );
                                }}
                              />
                              <NexusActionButton
                                label="Open post tab"
                                onPress={() => {
                                  router.replace(
                                    getDiscussionHref({
                                      forumId: activeForumId,
                                      sort: selectedFeedSort,
                                      view: 'post',
                                      showHidden: requestedShowHidden,
                                    })
                                  );
                                }}
                              />
                            </View>
                          </NexusCard>
                        ) : null}

                        {requestedPostId && isLoadingThread && !threadPayload ? (
                          <Text className={appearance.itemBodyClass}>
                            Loading thread...
                          </Text>
                        ) : null}

                        {threadError ? (
                          <NexusCard tone="rose">
                            <Text className={appearance.itemBodyClass}>
                              {threadError}
                            </Text>
                          </NexusCard>
                        ) : null}

                        {requestedPostId && threadPayload ? (
                          <ScrollView
                            nestedScrollEnabled
                            showsVerticalScrollIndicator={false}
                            keyboardShouldPersistTaps="handled"
                            className={threadListClass}
                            onScroll={handleThreadScroll}
                            scrollEventThrottle={16}
                          >
                            <View className="gap-4 p-3">
                              <NexusCard
                                className={`gap-4 border-nexus-sky/70 ${
                                  highlightedPostId ===
                                  threadPayload.root_post.packet.packet_id
                                    ? 'bg-nexus-sky/10'
                                    : 'bg-nexus-strong'
                                }`}
                              >
                                <View className="gap-2">
                                  <View className="flex-row flex-wrap items-center gap-2">
                                    <NexusBadge
                                      label="Original post"
                                      tone="sky"
                                    />
                                    {replyTargetLabel &&
                                    requestedReplyTargetId &&
                                    requestedReplyTargetId !==
                                      threadPayload.root_post.packet.packet_id ? (
                                      <NexusBadge
                                        label={`replying to ${replyTargetLabel}`}
                                        tone="default"
                                      />
                                    ) : null}
                                    {highlightedPostId ===
                                    threadPayload.root_post.packet.packet_id ? (
                                      <NexusBadge
                                        label="focused"
                                        tone="mint"
                                      />
                                    ) : null}
                                  </View>

                                  <Text className={metaRowClass}>
                                    {threadPayload.root_post.author_label} -{' '}
                                    {formatTimestamp(
                                      threadPayload.root_post.created_at
                                    )}
                                  </Text>
                                  <Text className={rootTitleClass}>
                                    {threadPayload.root_post.title}
                                  </Text>
                                </View>

                                <Text className={appearance.sectionBodyClass}>
                                  {threadPayload.root_post.content_markdown ??
                                    threadPayload.root_post.excerpt ??
                                    ''}
                                </Text>

                                <View className="flex-row flex-wrap items-center gap-2">
                                  <DiscussionVotePill
                                    score={
                                      threadPayload.root_post.vote_summary
                                        .net_score
                                    }
                                    viewerValue={
                                      threadPayload.root_post.vote_summary
                                        .viewer_value
                                    }
                                    canVote={
                                      threadPayload.root_post.actions[
                                        'discussion.vote_up'
                                      ]?.enabled ?? canVote
                                    }
                                    disabled={
                                      pendingVotePacketId ===
                                      threadPayload.root_post.packet.packet_id
                                    }
                                    onVote={(event, value) => {
                                      event.stopPropagation?.();
                                      void handleVote(
                                        threadPayload.root_post,
                                        value
                                      );
                                    }}
                                  />
                                  <NexusActionButton
                                    label={
                                      requestedReplyTargetId ===
                                      threadPayload.root_post.packet.packet_id
                                        ? 'Reply target'
                                        : 'Reply to OP'
                                    }
                                    onPress={() =>
                                      handleStartReply(
                                        threadPayload.root_post.packet.packet_id,
                                        threadPayload.root_post.packet.packet_id
                                      )
                                    }
                                  />
                                </View>

                                {requestedReplyTargetId ===
                                threadPayload.root_post.packet.packet_id ? (
                                  <InlineReplyComposer
                                    appearance={appearance}
                                    targetLabel="Replying to OP"
                                    viewerLabel={
                                      currentLabel ?? 'guest'
                                    }
                                    value={replyBody}
                                    error={replyError}
                                    disabled={
                                      !replyBody.trim() ||
                                      isSubmittingReply ||
                                      !(
                                        threadPayload.root_post.actions[
                                          'discussion.reply'
                                        ]?.enabled ?? canReply
                                      )
                                    }
                                    isSubmitting={isSubmittingReply}
                                    onChangeText={setReplyBody}
                                    onCancel={() => {
                                      router.replace(
                                        getDiscussionHref({
                                          forumId: activeForumId,
                                          sort: selectedFeedSort,
                                          view: 'thread',
                                          postId: threadPayload.root_post.packet.packet_id,
                                          replySort: selectedReplySort,
                                          showHidden: requestedShowHidden,
                                        })
                                      );
                                    }}
                                    onSubmit={() => {
                                      void handleCreateReply();
                                    }}
                                  />
                                ) : null}
                              </NexusCard>

                              <View className="gap-2">
                                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                                  {`Replies (${threadPayload.root_post.descendant_count})`}
                                </Text>
                                {rootReplies.length > 0 ? (
                                  <ReplyTree
                                    replies={rootReplies}
                                    appearance={appearance}
                                    highlightedPostId={highlightedPostId}
                                    replyTargetPacketId={requestedReplyTargetId}
                                    canVote={canVote}
                                    canReply={canReply}
                                    viewerLabel={
                                      currentLabel ?? 'guest'
                                    }
                                    replyBody={replyBody}
                                    replyError={replyError}
                                    isSubmittingReply={isSubmittingReply}
                                    pendingVotePacketId={pendingVotePacketId}
                                    branchStates={replyBranchStates}
                                    branchLoadingStates={
                                      replyBranchLoadingStates
                                    }
                                    replyExpansionState={replyExpansionState}
                                    onToggleReplyExpansion={
                                      handleToggleReplyExpansion
                                    }
                                    onEnsureReplyChildren={
                                      handleEnsureReplyChildren
                                    }
                                    onLoadMoreReplyChildren={
                                      handleLoadMoreReplyChildren
                                    }
                                    onReply={(postId) =>
                                      handleStartReply(
                                        threadPayload.root_post.packet.packet_id,
                                        postId
                                      )
                                    }
                                    onVote={(post, value) => {
                                      void handleVote(post, value);
                                    }}
                                    onChangeReplyBody={setReplyBody}
                                    onSubmitReply={() => {
                                      void handleCreateReply();
                                    }}
                                  />
                                ) : (
                                  <NexusCard>
                                    <Text className={appearance.itemBodyClass}>
                                      No replies are visible yet.
                                    </Text>
                                  </NexusCard>
                                )}
                              </View>

                              {isLoadingMoreRootReplies ? (
                                <Text className={appearance.itemMetaClass}>
                                  Loading more replies...
                                </Text>
                              ) : null}

                              <View className="flex-row flex-wrap items-center gap-2">
                                <NexusActionButton
                                  label="New reply"
                                  onPress={() => {
                                    handleStartReply(
                                      threadPayload.root_post.packet.packet_id,
                                      threadPayload.root_post.packet.packet_id
                                    );
                                  }}
                                />
                                {rootRepliesHasMore ? (
                                  <NexusActionButton
                                    label="Load more replies"
                                    onPress={handleLoadMoreRootReplies}
                                  />
                                ) : null}
                              </View>
                            </View>
                          </ScrollView>
                        ) : null}
                      </View>
                    ) : null}

                    {isPostWorkspace ? (
                      <View className="gap-4">
                        <View className="flex-row flex-wrap items-center justify-between gap-3">
                          <View className="flex-row flex-wrap items-center gap-2">
                            <NexusBadge
                              label={`posting as ${currentLabel}`}
                              tone="sky"
                            />
                          </View>

                          <NexusActionButton
                            label="Back to feed"
                            onPress={() => {
                              router.replace(
                                getDiscussionHref({
                                  forumId: activeForumId,
                                  sort: selectedFeedSort,
                                  view: 'feed',
                                  showHidden: requestedShowHidden,
                                })
                              );
                            }}
                          />
                        </View>

                        {topLevelPostingLocked ? (
                          <NexusCard tone="gold">
                            <Text className={appearance.itemBodyClass}>
                              Top-level posting is not open to this actor in
                              the current forum. Visitor lobbies accept any
                              signed actor, while the other forums require this
                              scope to be part of your claimed home-locality branch.
                            </Text>
                          </NexusCard>
                        ) : null}

                        {submitError ? (
                          <NexusCard tone="rose">
                            <Text className={appearance.itemBodyClass}>
                              {submitError}
                            </Text>
                          </NexusCard>
                        ) : null}

                        <NexusCard className="gap-4">
                          <TextInput
                            className={`rounded-[22px] border px-4 py-3 ${appearance.textInputClass}`}
                            onChangeText={setDraftTitle}
                            placeholder="Thread title"
                            placeholderTextColor={
                              appearance.textInputPlaceholderColor
                            }
                            value={draftTitle}
                          />
                          <TextInput
                            className={`min-h-[180px] rounded-[24px] border px-4 py-4 ${appearance.textInputClass}`}
                            multiline
                            onChangeText={setDraftBody}
                            placeholder="Write your top-level thread."
                            placeholderTextColor={
                              appearance.textInputPlaceholderColor
                            }
                            textAlignVertical="top"
                            value={draftBody}
                          />
                          <NexusActionButton
                            label={
                              isSubmittingPost ? 'Posting...' : 'Post thread'
                            }
                            onPress={() => {
                              void handleCreatePost();
                            }}
                            disabled={
                              isSubmittingPost ||
                              (Boolean(topLevelPostingLocked) &&
                                !communityClaimRequired) ||
                              !draftTitle.trim() ||
                              !draftBody.trim()
                            }
                            variant="primary"
                          />
                        </NexusCard>
                      </View>
                    ) : null}
              </NexusCard>
            </View>
          ) : isLoadingFeed ? (
            <NexusCard>
              <Text className={appearance.itemBodyClass}>
                Loading discussion forums...
              </Text>
            </NexusCard>
          ) : (
            <NexusCard className="gap-4">
              <Text className={appearance.itemBodyClass}>
                No discussion forums are available for this scope yet.
              </Text>
              {canAddDiscussionSurfaces ? (
                <View className="flex-row flex-wrap gap-3">
                  <NexusActionButton
                    label={
                      isAddingDiscussionSurfaces
                        ? 'Adding OWA bundle...'
                        : 'Add OWA discussion bundle'
                    }
                    disabled={isAddingDiscussionSurfaces}
                    onPress={() => void handleAddDiscussionSurfaces()}
                  />
                </View>
              ) : null}
            </NexusCard>
          )}
        </View>
        </View>
      </ScrollView>

      {authGateModal}
    </View>
  );
}
