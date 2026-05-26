/**
 * File: discussions.tsx
 * Description: Renders the packet-backed Nexus discussions surface with chunked forum feeds, collapsible reply trees, and universal packet voting.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import type {
  NativeScrollEvent,
  NativeSyntheticEvent,
} from 'react-native';
import { ScrollView, Text, View } from 'react-native';

import {
  DiscussionFeedPostCard,
  DiscussionPostComposer,
  DiscussionReplyTree,
  DiscussionRootPostCard,
  formatDiscussionTimestamp,
  type DiscussionVoteValue,
  type ReplyBranchStateMap,
  type ReplyExpansionState,
  type ReplyLoadingStateMap,
} from '@app/components/nexus/features/discussions';
import { useNexusShell } from '@app/components/nexus/nexus-shell-context';
import { useNexusPreviewTargetParams } from '@app/components/nexus/preview';
import { NexusTabStack, type NexusTabNode } from '@app/components/nexus/ui/tabs/nexus-tabs';
import { useNexusAuthGate } from '@app/components/nexus/nexus-auth-gate';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusLoadingBoundary,
  NexusSectionHeader,
  useNexusLoading,
  useNexusAppearance,
} from '@app/components/nexus/ui';
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
  const { runWithLoading } = useNexusLoading();
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
      ? `Replying to ${targetReply.author_label} - ${formatDiscussionTimestamp(
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
        const nextFeedPayload = await runWithLoading(
          'discussions:feed',
          () =>
            fetchNexusDiscussionsPayload({
              scopeId: activeScope.id,
              forumId: requestedForumId,
              sort: requestedSort ?? 'new',
              showHidden: requestedShowHidden,
              viewerActorPacketId: currentActorPacketId,
              cursor: input?.cursor ?? null,
              limit: FEED_PAGE_LIMIT,
            }),
          { label: 'Loading discussion feed...' }
        );

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
      runWithLoading,
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
        const nextReplyPage = await runWithLoading(
          `discussions:reply-branch:${input.parentPostPacketId}`,
          () =>
            fetchNexusDiscussionReplyChildrenPayload({
              scopeId: activeScope.id,
              threadPostPacketId: rootThreadPacketId,
              parentPostPacketId: input.parentPostPacketId,
              replySort: selectedReplySort ?? 'new',
              showHidden: requestedShowHidden,
              viewerActorPacketId: currentActorPacketId,
              cursor: input.cursor ?? null,
              limit: REPLY_PAGE_LIMIT,
            }),
          { label: 'Loading replies...' }
        );

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
      runWithLoading,
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
    async (post: NexusDiscussionPost, value: DiscussionVoteValue) => {
      await runWithLoading(
        `discussions:vote:${post.packet.packet_id}`,
        () =>
          guardNexusWrite(
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
          ),
        { label: 'Updating vote...' }
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
      runWithLoading,
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

  const handleLoadMoreFeed = useCallback(async () => {
    if (!feedHasMore || isLoadingMoreFeed || !feedNextCursor) {
      return;
    }

    await loadFeed({
      cursor: feedNextCursor,
      append: true,
    });
  }, [feedHasMore, feedNextCursor, isLoadingMoreFeed, loadFeed]);

  const handleLoadMoreRootReplies = useCallback(async () => {
    if (
      !threadPayload?.root_post.packet.packet_id ||
      !rootRepliesHasMore ||
      isLoadingMoreRootReplies ||
      !rootRepliesNextCursor
    ) {
      return;
    }

    setIsLoadingMoreRootReplies(true);
    try {
      const nextReplyPage = await runWithLoading(
        'discussions:root-replies',
        () =>
          fetchNexusDiscussionReplyChildrenPayload({
            scopeId: activeScope.id,
            threadPostPacketId: threadPayload.root_post.packet.packet_id,
            parentPostPacketId: threadPayload.root_post.packet.packet_id,
            replySort: selectedReplySort,
            showHidden: requestedShowHidden,
            viewerActorPacketId: currentActorPacketId,
            cursor: rootRepliesNextCursor,
            limit: REPLY_PAGE_LIMIT,
          }),
        { label: 'Loading replies...' }
      );

      setRootReplies((currentReplies) =>
        mergePagedPosts(currentReplies, nextReplyPage.replies)
      );
      setRootRepliesNextCursor(nextReplyPage.next_cursor);
      setRootRepliesHasMore(nextReplyPage.has_more);
    } catch (error) {
      setReplyError(
        error instanceof Error
          ? error.message
          : 'Unable to load more replies.'
      );
    } finally {
      setIsLoadingMoreRootReplies(false);
    }
  }, [
    activeScope.id,
    currentActorPacketId,
    isLoadingMoreRootReplies,
    requestedShowHidden,
    rootRepliesHasMore,
    rootRepliesNextCursor,
    runWithLoading,
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
        void handleLoadMoreFeed();
      }
    },
    [handleLoadMoreFeed]
  );

  const handleThreadScroll = useCallback(
    (event: NativeSyntheticEvent<NativeScrollEvent>) => {
      if (shouldAutoLoadMore(event)) {
        void handleLoadMoreRootReplies();
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
                        <NexusLoadingBoundary scope="discussions:feed">
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
                              <DiscussionFeedPostCard
                                key={post.packet.packet_id}
                                post={post}
                                appearance={appearance}
                                cardTitleClass={cardTitleClass}
                                metaRowClass={metaRowClass}
                                highlightedPostId={highlightedPostId}
                                requestedPostId={requestedPostId}
                                pendingVotePacketId={pendingVotePacketId}
                                voteLoadingScope={`discussions:vote:${post.packet.packet_id}`}
                                canVote={canVote}
                                onOpen={openThreadWorkspace}
                                onVote={(nextPost, value) => {
                                  void handleVote(nextPost, value);
                                }}
                              />
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
                                loadingScope="discussions:feed"
                              />
                            ) : null}

                            <NexusActionButton
                              label="New post"
                              onPress={handleOpenPostWorkspace}
                            />
                            </View>
                          </ScrollView>
                        </NexusLoadingBoundary>
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
                              <DiscussionRootPostCard
                                rootPost={threadPayload.root_post}
                                appearance={appearance}
                                metaRowClass={metaRowClass}
                                rootTitleClass={rootTitleClass}
                                highlightedPostId={highlightedPostId}
                                replyTargetLabel={replyTargetLabel}
                                replyTargetPacketId={requestedReplyTargetId}
                                viewerLabel={currentLabel ?? 'guest'}
                                replyBody={replyBody}
                                replyError={replyError}
                                isSubmittingReply={isSubmittingReply}
                                pendingVotePacketId={pendingVotePacketId}
                                voteLoadingScope={`discussions:vote:${threadPayload.root_post.packet.packet_id}`}
                                replyComposerLoadingScope={`discussions:reply-composer:${threadPayload.root_post.packet.packet_id}`}
                                canVote={canVote}
                                canReply={canReply}
                                onVote={(post, value) => {
                                  void handleVote(post, value);
                                }}
                                onReplyToRoot={() =>
                                  handleStartReply(
                                    threadPayload.root_post.packet.packet_id,
                                    threadPayload.root_post.packet.packet_id
                                  )
                                }
                                onChangeReplyBody={setReplyBody}
                                onCancelReply={() => {
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
                                onSubmitReply={handleCreateReply}
                              />

                              <NexusLoadingBoundary scope="discussions:root-replies">
                                <View className="gap-2">
                                  <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                                    {`Replies (${threadPayload.root_post.descendant_count})`}
                                  </Text>
                                  {rootReplies.length > 0 ? (
                                    <DiscussionReplyTree
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
                                      getReplyBranchLoadingScope={(reply) =>
                                        `discussions:reply-branch:${reply.packet.packet_id}`
                                      }
                                      getReplyComposerLoadingScope={(reply) =>
                                        `discussions:reply-composer:${reply.packet.packet_id}`
                                      }
                                      getVoteLoadingScope={(post) =>
                                        `discussions:vote:${post.packet.packet_id}`
                                      }
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
                                      onSubmitReply={handleCreateReply}
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
                                      loadingScope="discussions:root-replies"
                                    />
                                  ) : null}
                                </View>
                              </NexusLoadingBoundary>
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

                        <DiscussionPostComposer
                          title={draftTitle}
                          body={draftBody}
                          isSubmitting={isSubmittingPost}
                          loadingScope="discussions:post-composer"
                          onChangeTitle={setDraftTitle}
                          onChangeBody={setDraftBody}
                          onSubmit={handleCreatePost}
                          disabled={
                            isSubmittingPost ||
                            (Boolean(topLevelPostingLocked) &&
                              !communityClaimRequired) ||
                            !draftTitle.trim() ||
                            !draftBody.trim()
                          }
                        />
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
