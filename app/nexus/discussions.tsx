/**
 * File: discussions.tsx
 * Description: Renders the packet-backed Nexus discussions surface with threaded replies, universal packet voting, and guest point gating.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';

import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
  useNexusAppearance,
} from '@/components/nexus/nexus-ui';
import { getOrCreateAnonymousSession } from '@/lib/nexus/anonymous-session';
import type {
  NexusDiscussionPost,
  NexusDiscussionThreadPayload,
  NexusDiscussionsPayload,
} from '@/lib/nexus/nexus-api-types';
import {
  createNexusDiscussionPost,
  createNexusDiscussionReply,
  fetchNexusDiscussionThreadPayload,
  fetchNexusDiscussionsPayload,
  setNexusPacketVote,
} from '@/lib/nexus/nexus-query-api';

const DISCUSSION_WORKSPACE_VIEWS = ['feed', 'thread', 'post'] as const;
const FEED_SORT_OPTIONS = [
  'hot',
  'new',
  'top',
  'controversial',
  'active',
  'old',
  'most_downvoted',
] as const;
const REPLY_SORT_OPTIONS = ['top', 'new', 'controversial', 'old'] as const;

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
  onSubmit: () => void;
};

type ReplyTreeProps = {
  replies: NexusDiscussionThreadPayload['replies'];
  appearance: ReturnType<typeof useNexusAppearance>;
  selectedPostId: string | null;
  highlightedPostId: string | null;
  replyTargetPacketId: string | null;
  canVote: boolean;
  canReply: boolean;
  viewerLabel: string;
  replyBody: string;
  replyError: string | null;
  isSubmittingReply: boolean;
  onOpen: (postId: string) => void;
  onReply: (postId: string) => void;
  onVote: (post: NexusDiscussionPost, value: -1 | 1) => void;
  onChangeReplyBody: (nextValue: string) => void;
  onSubmitReply: () => void;
  pendingVotePacketId: string | null;
};

type ConnectedTabRailProps = {
  tabs: {
    id: string;
    title: string;
    detail: string;
  }[];
  activeId: string | null;
  compact?: boolean;
  onSelect: (tabId: string) => void;
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

function InlineReplyComposer({
  appearance,
  targetLabel,
  viewerLabel,
  value,
  error,
  disabled,
  isSubmitting,
  onChangeText,
  onSubmit,
}: InlineReplyComposerProps) {
  return (
    <NexusCard className="gap-4 border-nexus-sky/60 p-4">
      <View className="gap-2">
        <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
          Reply composer
        </Text>
        <Text className={appearance.sectionBodyClass}>
          Replying to: {targetLabel}
        </Text>
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

      <NexusActionButton
        label={isSubmitting ? 'Replying...' : 'Post reply'}
        onPress={onSubmit}
        disabled={disabled}
        variant="primary"
      />
    </NexusCard>
  );
}

function ConnectedTabRail({
  tabs,
  activeId,
  compact = false,
  onSelect,
}: ConnectedTabRailProps) {
  const { themeMode } = useNexusShell();
  const appearance = useNexusAppearance();
  const inactiveTabClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-white/5'
      : 'border-slate-300 bg-slate-100';
  const activeTabClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 border-b-nexus-panel bg-nexus-panel'
      : 'border-slate-300 border-b-white bg-white';

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      className="flex-grow-0"
    >
      <View className="flex-row items-end gap-2">
        {tabs.map((tab) => {
          const isActive = tab.id === activeId;

          return (
            <Pressable
              key={tab.id}
              className={`min-w-[150px] border px-4 ${
                compact
                  ? 'rounded-t-[18px] py-2.5'
                  : 'rounded-t-[20px] py-3'
              } ${isActive ? `${activeTabClass} -mb-px` : inactiveTabClass}`}
              onPress={() => onSelect(tab.id)}
            >
              <Text className={appearance.itemTitleClass}>{tab.title}</Text>
              <Text className={appearance.itemMetaClass}>{tab.detail}</Text>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function ReplyTree({
  replies,
  appearance,
  selectedPostId,
  highlightedPostId,
  replyTargetPacketId,
  canVote,
  canReply,
  viewerLabel,
  replyBody,
  replyError,
  isSubmittingReply,
  onOpen,
  onReply,
  onVote,
  onChangeReplyBody,
  onSubmitReply,
  pendingVotePacketId,
}: ReplyTreeProps) {
  return (
    <View className="gap-3">
      {replies.map((reply) => {
        const isSelected = reply.packet.packet_id === selectedPostId;
        const isHighlighted = reply.packet.packet_id === highlightedPostId;
        const isReplyTarget = reply.packet.packet_id === replyTargetPacketId;

        return (
          <View
            key={reply.packet.packet_id}
            className="gap-3 border-l border-nexus-line/40 pl-4"
          >
            <NexusCard
              className={`gap-3 p-4 ${
                isSelected || isReplyTarget || isHighlighted
                  ? 'border-nexus-sky/70 bg-nexus-panel'
                  : ''
              }`}
            >
              <View className="flex-row items-start justify-between gap-3">
                <View className="min-w-0 flex-1 gap-1">
                  <Text className={appearance.itemTitleClass}>{reply.title}</Text>
                  <Text className={appearance.itemMetaClass}>
                    {reply.author_label} - {formatTimestamp(reply.created_at)}
                  </Text>
                </View>
                <View className="flex-row flex-wrap gap-2">
                  <NexusBadge
                    label={`${reply.vote_summary.net_score} score`}
                    tone={
                      reply.vote_summary.net_score < 0
                        ? 'rose'
                        : reply.vote_summary.net_score > 0
                          ? 'mint'
                          : 'default'
                    }
                  />
                  {isSelected ? <NexusBadge label="thread focus" tone="sky" /> : null}
                  {isHighlighted ? (
                    <NexusBadge label="just posted" tone="mint" />
                  ) : null}
                  {isReplyTarget ? <NexusBadge label="reply target" tone="mint" /> : null}
                  {reply.vote_summary.deprioritized ? (
                    <NexusBadge label="deprioritized" tone="gold" />
                  ) : null}
                  {reply.is_hidden ? <NexusBadge label="hidden" tone="rose" /> : null}
                </View>
              </View>

              <Text className={appearance.itemBodyClass}>
                {reply.content_markdown}
              </Text>

              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label={reply.vote_summary.viewer_value === 1 ? '+1 set' : '+1'}
                  onPress={() => onVote(reply, 1)}
                  disabled={!canVote || pendingVotePacketId === reply.packet.packet_id}
                />
                <NexusActionButton
                  label={reply.vote_summary.viewer_value === -1 ? '-1 set' : '-1'}
                  onPress={() => onVote(reply, -1)}
                  disabled={!canVote || pendingVotePacketId === reply.packet.packet_id}
                />
                <NexusActionButton
                  label={isSelected ? 'Selected' : 'Open'}
                  onPress={() => onOpen(reply.packet.packet_id)}
                />
                <NexusActionButton
                  label={isReplyTarget ? 'Reply target' : 'Reply here'}
                  onPress={() => onReply(reply.packet.packet_id)}
                />
              </View>

              {isReplyTarget ? (
                <InlineReplyComposer
                  appearance={appearance}
                  targetLabel={reply.title}
                  viewerLabel={viewerLabel}
                  value={replyBody}
                  error={replyError}
                  disabled={!replyBody.trim() || isSubmittingReply || !canReply}
                  isSubmitting={isSubmittingReply}
                  onChangeText={onChangeReplyBody}
                  onSubmit={onSubmitReply}
                />
              ) : null}
            </NexusCard>

            {reply.replies.length > 0 ? (
              <ReplyTree
                replies={reply.replies}
                appearance={appearance}
                selectedPostId={selectedPostId}
                highlightedPostId={highlightedPostId}
                replyTargetPacketId={replyTargetPacketId}
                onOpen={onOpen}
                onReply={onReply}
                onVote={onVote}
                onChangeReplyBody={onChangeReplyBody}
                onSubmitReply={onSubmitReply}
                pendingVotePacketId={pendingVotePacketId}
                canVote={canVote}
                canReply={canReply}
                viewerLabel={viewerLabel}
                replyBody={replyBody}
                replyError={replyError}
                isSubmittingReply={isSubmittingReply}
              />
            ) : null}
          </View>
        );
      })}
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
    showHidden?: string | string[];
  }>();
  const { activeScope, themeMode } = useNexusShell();
  const appearance = useNexusAppearance();
  const anonymousSession = getOrCreateAnonymousSession();
  const requestedForumId = normalizeQueryValue(localParams.forum);
  const requestedWorkspaceView = normalizeWorkspaceView(
    localParams.view,
    Boolean(normalizeQueryValue(localParams.post))
  );
  const requestedPostId = normalizeQueryValue(localParams.post);
  const requestedReplyTargetId = normalizeQueryValue(localParams.replyTo);
  const requestedSort = normalizeQueryValue(localParams.sort);
  const requestedReplySort = normalizeQueryValue(localParams.replySort);
  const requestedShowHidden = normalizeBooleanQueryValue(localParams.showHidden);
  const [feedPayload, setFeedPayload] = useState<NexusDiscussionsPayload | null>(null);
  const [threadPayload, setThreadPayload] =
    useState<NexusDiscussionThreadPayload | null>(null);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [isLoadingThread, setIsLoadingThread] = useState(false);
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
  const [highlightedPostId, setHighlightedPostId] = useState<string | null>(null);
  const [pendingVotePacketId, setPendingVotePacketId] = useState<string | null>(null);

  const loadFeed = useCallback(async () => {
    setIsLoadingFeed(true);
    setFeedError(null);

    try {
      const nextFeedPayload = await fetchNexusDiscussionsPayload({
        scopeId: activeScope.id,
        forumId: requestedForumId,
        sort: requestedSort,
        showHidden: requestedShowHidden,
        viewerSessionId: anonymousSession.session_id,
      });

      setFeedPayload(nextFeedPayload);
    } catch (error) {
      setFeedError(
        error instanceof Error
          ? error.message
          : 'Unable to load the discussion feed.'
      );
      setFeedPayload(null);
    } finally {
      setIsLoadingFeed(false);
    }
  }, [
    activeScope.id,
    anonymousSession.session_id,
    requestedForumId,
    requestedShowHidden,
    requestedSort,
  ]);

  const loadThread = useCallback(async () => {
    if (!requestedPostId) {
      setThreadPayload(null);
      setThreadError(null);
      setIsLoadingThread(false);
      return;
    }

    setIsLoadingThread(true);
    setThreadError(null);

    try {
      const nextThreadPayload = await fetchNexusDiscussionThreadPayload({
        scopeId: activeScope.id,
        postPacketId: requestedPostId,
        replySort: requestedReplySort,
        showHidden: requestedShowHidden,
        viewerSessionId: anonymousSession.session_id,
      });

      setThreadPayload(nextThreadPayload);
    } catch (error) {
      setThreadError(
        error instanceof Error
          ? error.message
          : 'Unable to load the discussion thread.'
      );
      setThreadPayload(null);
    } finally {
      setIsLoadingThread(false);
    }
  }, [
    activeScope.id,
    anonymousSession.session_id,
    requestedPostId,
    requestedReplySort,
    requestedShowHidden,
  ]);

  useEffect(() => {
    setSubmitError(null);
    setReplyError(null);
    setVoteError(null);
    void loadFeed();
  }, [loadFeed]);

  useEffect(() => {
    void loadThread();
  }, [loadThread]);

  useEffect(() => {
    setReplyBody('');
    setReplyError(null);
  }, [requestedReplyTargetId]);

  const selectedForum =
    feedPayload?.forums.find((forum) => forum.id === feedPayload.selected_forum_id) ??
    null;
  const selectedFeedSort = (feedPayload?.selected_sort ?? 'new') as FeedSort;
  const selectedReplySort = (threadPayload?.selected_reply_sort ?? 'top') as ReplySort;
  const selectedViewer = threadPayload?.viewer ?? feedPayload?.viewer ?? null;
  const activeForumId = feedPayload?.selected_forum_id ?? requestedForumId;
  const topLevelPostingLocked =
    selectedViewer && !selectedViewer.can_create_top_level;
  const isFeedWorkspace = requestedWorkspaceView === 'feed';
  const isThreadWorkspace = requestedWorkspaceView === 'thread';
  const isPostWorkspace = requestedWorkspaceView === 'post';
  const forumTabs = (feedPayload?.forums ?? []).map((forum) => ({
    id: forum.id,
    title: forum.title,
    detail: forum.public_posting ? 'Guest replies open' : 'Read only',
  }));
  const workspaceTabs = [
    {
      id: 'feed',
      title: 'Feed',
      detail: `${feedPayload?.top_level_posts.length ?? 0} visible threads`,
    },
    {
      id: 'thread',
      title: 'Thread',
      detail: requestedPostId ? 'selected thread' : 'no thread selected',
    },
    {
      id: 'post',
      title: 'Post',
      detail: 'start a top-level thread',
    },
  ] satisfies ConnectedTabRailProps['tabs'];
  const forumShellClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-nexus-panel'
      : 'border-slate-300 bg-white';
  const workspacePanelClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-nexus-canvas/70'
      : 'border-slate-300 bg-slate-50';
  const replyTargetLabel = useMemo(() => {
    if (!threadPayload || !requestedReplyTargetId) {
      return null;
    }

    if (threadPayload.root_post.packet.packet_id === requestedReplyTargetId) {
      return threadPayload.root_post.title;
    }

    const stack = [...threadPayload.replies];

    while (stack.length > 0) {
      const nextReply = stack.shift();

      if (!nextReply) {
        break;
      }

      if (nextReply.packet.packet_id === requestedReplyTargetId) {
        return nextReply.title;
      }

      stack.push(...nextReply.replies);
    }

    return null;
  }, [requestedReplyTargetId, threadPayload]);

  useEffect(() => {
    setHighlightedPostId(null);
  }, [requestedPostId, activeForumId]);
  const refreshCurrentView = useCallback(async () => {
    await loadFeed();
    await loadThread();
  }, [loadFeed, loadThread]);

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

  const handleVote = useCallback(
    async (post: NexusDiscussionPost, value: -1 | 1) => {
      setPendingVotePacketId(post.packet.packet_id);
      setVoteError(null);

      try {
        await setNexusPacketVote({
          packetId: post.packet.packet_id,
          scopeId: activeScope.id,
          sessionId: anonymousSession.session_id,
          shortLabel: anonymousSession.short_label,
          value: post.vote_summary.viewer_value === value ? 0 : value,
        });
        await refreshCurrentView();
      } catch (error) {
        setVoteError(
          error instanceof Error ? error.message : 'Unable to update that vote.'
        );
      } finally {
        setPendingVotePacketId(null);
      }
    },
    [
      activeScope.id,
      anonymousSession.session_id,
      anonymousSession.short_label,
      refreshCurrentView,
    ]
  );

  const handleCreatePost = useCallback(async () => {
    if (!selectedForum) {
      return;
    }

    setIsSubmittingPost(true);
    setSubmitError(null);

    try {
      const result = await createNexusDiscussionPost({
        scopeId: activeScope.id,
        threadPacketId: selectedForum.thread_packet_id,
        sessionId: anonymousSession.session_id,
        shortLabel: anonymousSession.short_label,
        title: draftTitle,
        body: draftBody,
      });

      setDraftTitle('');
      setDraftBody('');
      await refreshCurrentView();
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
    } catch (error) {
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'Unable to save the discussion post.'
      );
    } finally {
      setIsSubmittingPost(false);
    }
  }, [
    activeScope.id,
    anonymousSession.session_id,
    anonymousSession.short_label,
    draftBody,
    draftTitle,
    refreshCurrentView,
    requestedShowHidden,
    router,
    selectedFeedSort,
    selectedForum,
    selectedReplySort,
  ]);

  const handleCreateReply = useCallback(async () => {
    if (!requestedReplyTargetId) {
      return;
    }

    setIsSubmittingReply(true);
    setReplyError(null);

    try {
      const result = await createNexusDiscussionReply({
        scopeId: activeScope.id,
        postPacketId: requestedReplyTargetId,
        sessionId: anonymousSession.session_id,
        shortLabel: anonymousSession.short_label,
        body: replyBody,
      });

      setReplyBody('');
      setHighlightedPostId(result.post.packet.packet_id);
      await refreshCurrentView();
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
    } catch (error) {
      setReplyError(
        error instanceof Error ? error.message : 'Unable to save the reply.'
      );
    } finally {
      setIsSubmittingReply(false);
    }
  }, [
    activeScope.id,
    anonymousSession.session_id,
    anonymousSession.short_label,
    activeForumId,
    refreshCurrentView,
    replyBody,
    requestedPostId,
    requestedReplyTargetId,
    requestedShowHidden,
    router,
    selectedFeedSort,
    selectedReplySort,
  ]);

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <View className="w-full gap-5">
          <NexusSectionHeader
            eyebrow="Discussions"
            title={`${activeScope.name} Discussions`}
            trailing={
              selectedViewer ? (
                <View className="flex-row flex-wrap gap-2">
                  <NexusBadge label={anonymousSession.short_label} tone="mint" />
                  <NexusBadge
                    label={`${selectedViewer.available_points} points`}
                    tone="sky"
                  />
                  <NexusBadge label={`${forumTabs.length} forums`} tone="default" />
                </View>
              ) : null
            }
          />

          {feedError ? (
            <NexusCard>
              <Text className="text-sm leading-6 text-nexus-rose">{feedError}</Text>
            </NexusCard>
          ) : null}

          {selectedForum ? (
            <View className="gap-0">
              <ConnectedTabRail
                tabs={forumTabs}
                activeId={feedPayload?.selected_forum_id ?? null}
                onSelect={(forumId) => {
                  const nextForum =
                    feedPayload?.forums.find((forum) => forum.id === forumId) ?? null;

                  router.replace(
                    getDiscussionHref({
                      forumId,
                      sort: nextForum?.default_sort ?? selectedFeedSort,
                      view: 'feed',
                      showHidden: requestedShowHidden,
                    })
                  );
                }}
              />

              <View
                className={`-mt-px gap-5 rounded-[28px] border px-4 py-5 lg:px-6 lg:py-6 ${forumShellClass}`}
              >
                <View className="gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <Text className={appearance.surfaceTitleClass}>
                    {selectedForum.title}
                  </Text>

                  <View className="flex-row flex-wrap gap-2">
                    <NexusBadge
                      label={
                        selectedForum.public_posting ? 'guest path visible' : 'member lane'
                      }
                      tone={selectedForum.public_posting ? 'mint' : 'default'}
                    />
                    <NexusBadge
                      label={`${selectedForum.top_level_post_cost} points to post`}
                      tone="gold"
                    />
                    {requestedShowHidden ? (
                      <NexusBadge label="showing moderated" tone="rose" />
                    ) : null}
                  </View>
                </View>

                <View className="gap-0">
                  <ConnectedTabRail
                    tabs={workspaceTabs}
                    activeId={requestedWorkspaceView}
                    compact
                    onSelect={(viewId) =>
                      router.replace(
                        getDiscussionHref({
                          forumId: selectedForum.id,
                          sort: selectedFeedSort,
                          view: viewId as DiscussionWorkspaceView,
                          postId: viewId === 'thread' ? requestedPostId : null,
                          replyTargetId:
                            viewId === 'thread' ? requestedReplyTargetId : null,
                          replySort: selectedReplySort,
                          showHidden: requestedShowHidden,
                        })
                      )
                    }
                  />

                  <View
                    className={`-mt-px gap-4 rounded-[24px] border px-3 py-4 lg:px-4 ${workspacePanelClass}`}
                  >
                    {voteError ? (
                      <Text className="text-sm leading-6 text-nexus-rose">
                        {voteError}
                      </Text>
                    ) : null}

        {selectedForum && isPostWorkspace ? (
          <View className="gap-4">
            <View className="gap-3 lg:flex-row lg:items-center lg:justify-between">
              <View className="gap-2">
                <Text className={appearance.itemTitleClass}>New post</Text>
                <Text className={appearance.itemMetaClass}>
                  Posting into {selectedForum.title}
                </Text>
              </View>

              <View className="flex-row flex-wrap gap-2">
                <NexusBadge label={`posting as ${anonymousSession.short_label}`} tone="sky" />
                <NexusBadge label={`${selectedForum.top_level_post_cost} points`} tone="gold" />
              </View>
            </View>

            {topLevelPostingLocked ? (
              <Text className={appearance.itemBodyClass}>
                Top-level posting costs {selectedForum.top_level_post_cost} points here.
                Anonymous guests temporarily start with{' '}
                {selectedViewer?.available_points ?? 0} points for testing.
              </Text>
            ) : null}

            <TextInput
              className={`rounded-[24px] border px-4 py-3 ${appearance.textInputClass}`}
              onChangeText={setDraftTitle}
              placeholder="Thread title"
              placeholderTextColor={appearance.textInputPlaceholderColor}
              value={draftTitle}
            />
            <TextInput
              className={`min-h-[140px] rounded-[24px] border px-4 py-4 ${appearance.textInputClass}`}
              multiline
              onChangeText={setDraftBody}
              placeholder="Write a new top-level post."
              placeholderTextColor={appearance.textInputPlaceholderColor}
              textAlignVertical="top"
              value={draftBody}
            />
            {submitError ? (
              <Text className="text-sm leading-6 text-nexus-rose">{submitError}</Text>
            ) : null}
            <NexusActionButton
              label={isSubmittingPost ? 'Posting...' : 'Create top-level post'}
              onPress={handleCreatePost}
              disabled={
                !draftBody.trim() ||
                isSubmittingPost ||
                !selectedViewer?.can_create_top_level
              }
              variant="primary"
            />
          </View>
        ) : null}

        {isFeedWorkspace ? (
          <View className="gap-4">
            <View className="gap-3 lg:flex-row lg:items-start lg:justify-between">
              <View className="flex-row flex-wrap gap-2">
                {FEED_SORT_OPTIONS.map((sortOption) => (
                  <NexusActionButton
                    key={sortOption}
                    label={
                      sortOption === selectedFeedSort
                        ? `${sortOption} selected`
                        : sortOption
                    }
                    onPress={() =>
                      router.replace(
                        getDiscussionHref({
                          forumId: selectedForum?.id ?? activeForumId,
                          sort: sortOption,
                          view: 'feed',
                          showHidden: requestedShowHidden,
                        })
                      )
                    }
                  />
                ))}
                <NexusActionButton
                  label={requestedShowHidden ? 'Hide moderated' : 'Show moderated'}
                  onPress={() =>
                    router.replace(
                      getDiscussionHref({
                        forumId: selectedForum?.id ?? activeForumId,
                        sort: selectedFeedSort,
                        view: 'feed',
                        showHidden: !requestedShowHidden,
                      })
                    )
                  }
                />
              </View>

              <NexusActionButton
                label="New post"
                onPress={() =>
                  router.replace(
                    getDiscussionHref({
                      forumId: selectedForum?.id ?? activeForumId,
                      sort: selectedFeedSort,
                      view: 'post',
                      showHidden: requestedShowHidden,
                    })
                  )
                }
                variant="primary"
              />
            </View>

            {isLoadingFeed ? (
              <Text className={appearance.itemBodyClass}>Loading discussion feed...</Text>
            ) : feedPayload && feedPayload.top_level_posts.length > 0 ? (
              <View className="gap-3">
                {feedPayload.top_level_posts.map((post) => {
                  const isCurrentThread =
                    threadPayload?.root_post.packet.packet_id === post.packet.packet_id;

                  return (
                    <Pressable
                      key={post.packet.packet_id}
                      accessibilityRole="button"
                      className="rounded-[28px]"
                      onPress={() => openThreadWorkspace(post.packet.packet_id)}
                    >
                      <NexusCard
                        className={`gap-4 p-4 ${
                          isCurrentThread ? 'border-nexus-sky/70 bg-nexus-panel' : ''
                        }`}
                      >
                        <View className="gap-3 lg:flex-row lg:items-start lg:justify-between">
                          <View className="min-w-0 flex-1 gap-2">
                            <Text className={appearance.itemTitleClass}>{post.title}</Text>
                            <Text className={appearance.itemMetaClass}>
                              {post.author_label} - {formatTimestamp(post.created_at)}
                            </Text>
                            <Text className={appearance.itemBodyClass}>
                              {post.excerpt ?? post.content_markdown}
                            </Text>
                          </View>

                          <View className="flex-row flex-wrap gap-2 lg:max-w-[260px] lg:justify-end">
                            <NexusBadge
                              label={`${post.vote_summary.net_score} score`}
                              tone={
                                post.vote_summary.net_score < 0
                                  ? 'rose'
                                  : post.vote_summary.net_score > 0
                                    ? 'mint'
                                    : 'default'
                              }
                            />
                            <NexusBadge
                              label={`${post.descendant_count} replies`}
                              tone="default"
                            />
                            {isCurrentThread ? (
                              <NexusBadge label="thread loaded" tone="sky" />
                            ) : null}
                            {post.vote_summary.deprioritized ? (
                              <NexusBadge label="deprioritized" tone="gold" />
                            ) : null}
                          </View>
                        </View>

                        <View className="flex-row flex-wrap gap-3">
                          <NexusActionButton
                            label={post.vote_summary.viewer_value === 1 ? '+1 set' : '+1'}
                            onPress={() => handleVote(post, 1)}
                            disabled={
                              !selectedViewer?.can_vote ||
                              pendingVotePacketId === post.packet.packet_id
                            }
                          />
                          <NexusActionButton
                            label={post.vote_summary.viewer_value === -1 ? '-1 set' : '-1'}
                            onPress={() => handleVote(post, -1)}
                            disabled={
                              !selectedViewer?.can_vote ||
                              pendingVotePacketId === post.packet.packet_id
                            }
                          />
                        </View>
                      </NexusCard>
                    </Pressable>
                  );
                })}

                <View className="pt-2">
                  <NexusActionButton
                    label="New post"
                    onPress={() =>
                      router.replace(
                        getDiscussionHref({
                          forumId: selectedForum?.id ?? activeForumId,
                          sort: selectedFeedSort,
                          view: 'post',
                          showHidden: requestedShowHidden,
                        })
                      )
                    }
                    variant="primary"
                  />
                </View>
              </View>
            ) : (
              <View className="gap-4">
                <Text className={appearance.itemBodyClass}>
                  No top-level posts are visible in this forum yet. The seeded visitor-lobby starter posts are there to reply to so new guests are never stuck at zero with nowhere to begin.
                </Text>
                <NexusActionButton
                  label="New post"
                  onPress={() =>
                    router.replace(
                      getDiscussionHref({
                        forumId: selectedForum?.id ?? activeForumId,
                        sort: selectedFeedSort,
                        view: 'post',
                        showHidden: requestedShowHidden,
                      })
                    )
                  }
                  variant="primary"
                />
              </View>
            )}
          </View>
        ) : null}

        {isThreadWorkspace ? (
          <View className="gap-4">
            <View className="gap-3 lg:flex-row lg:items-start lg:justify-between">
              <View className="flex-row flex-wrap gap-2">
                {REPLY_SORT_OPTIONS.map((sortOption) => (
                  <NexusActionButton
                    key={sortOption}
                    label={
                      sortOption === selectedReplySort
                        ? `${sortOption} selected`
                        : sortOption
                    }
                    onPress={() =>
                      router.replace(
                        getDiscussionHref({
                          forumId: activeForumId,
                          sort: selectedFeedSort,
                          view: 'thread',
                          postId: requestedPostId,
                          replyTargetId: requestedReplyTargetId,
                          replySort: sortOption,
                          showHidden: requestedShowHidden,
                        })
                      )
                    }
                  />
                ))}
              </View>

              <View className="flex-row flex-wrap gap-3">
                <NexusActionButton
                  label="Open feed"
                  onPress={() =>
                    router.replace(
                      getDiscussionHref({
                        forumId: activeForumId,
                        sort: selectedFeedSort,
                        view: 'feed',
                        showHidden: requestedShowHidden,
                      })
                    )
                  }
                />
                <NexusActionButton
                  label="New post"
                  onPress={() =>
                    router.replace(
                      getDiscussionHref({
                        forumId: activeForumId,
                        sort: selectedFeedSort,
                        view: 'post',
                        showHidden: requestedShowHidden,
                      })
                    )
                  }
                />
              </View>
            </View>

            {!requestedPostId ? (
              <View className="gap-3">
                <Text className={appearance.sectionBodyClass}>
                  No thread is selected yet. Pick one from the thread list above
                  or return to the feed to browse the forum cards.
                </Text>
                <NexusActionButton
                  label="Open feed"
                  onPress={() =>
                    router.replace(
                      getDiscussionHref({
                        forumId: activeForumId,
                        sort: selectedFeedSort,
                        view: 'feed',
                        showHidden: requestedShowHidden,
                      })
                    )
                  }
                />
              </View>
            ) : threadError ? (
              <Text className="text-sm leading-6 text-nexus-rose">{threadError}</Text>
            ) : isLoadingThread ? (
              <Text className={appearance.itemBodyClass}>Loading thread...</Text>
            ) : threadPayload ? (
              <View className="gap-4">
                <NexusCard
                  tone="sky"
                  className={`gap-4 border-nexus-sky/60 p-5 ${
                    requestedPostId === threadPayload.root_post.packet.packet_id ||
                    requestedReplyTargetId === threadPayload.root_post.packet.packet_id
                      ? 'border-nexus-sky/70 bg-nexus-panel'
                      : ''
                  }`}
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="min-w-0 flex-1 gap-2">
                      <View className="flex-row flex-wrap gap-2">
                        <NexusBadge label="Original post" tone="sky" />
                        {requestedReplyTargetId ===
                        threadPayload.root_post.packet.packet_id ? (
                          <NexusBadge label="reply target" tone="mint" />
                        ) : null}
                      </View>
                      <Text className={appearance.itemTitleClass}>
                        {threadPayload.root_post.title}
                      </Text>
                      <Text className={appearance.itemMetaClass}>
                        {threadPayload.root_post.author_label} - {formatTimestamp(threadPayload.root_post.created_at)}
                      </Text>
                    </View>
                    <View className="flex-row flex-wrap gap-2">
                      <NexusBadge
                        label={`${threadPayload.root_post.vote_summary.net_score} score`}
                        tone={
                          threadPayload.root_post.vote_summary.net_score < 0
                            ? 'rose'
                            : threadPayload.root_post.vote_summary.net_score > 0
                              ? 'mint'
                              : 'default'
                        }
                      />
                      <NexusBadge
                        label={`${threadPayload.root_post.descendant_count} replies`}
                        tone="default"
                      />
                      {requestedPostId === threadPayload.root_post.packet.packet_id ? (
                        <NexusBadge label="thread focus" tone="sky" />
                      ) : null}
                    </View>
                  </View>

                  <Text className={appearance.itemBodyClass}>
                    {threadPayload.root_post.content_markdown}
                  </Text>

                  <View className="flex-row flex-wrap gap-3">
                    <NexusActionButton
                      label={threadPayload.root_post.vote_summary.viewer_value === 1 ? '+1 set' : '+1'}
                      onPress={() => handleVote(threadPayload.root_post, 1)}
                      disabled={
                        !threadPayload.viewer.can_vote ||
                        pendingVotePacketId === threadPayload.root_post.packet.packet_id
                      }
                    />
                    <NexusActionButton
                      label={threadPayload.root_post.vote_summary.viewer_value === -1 ? '-1 set' : '-1'}
                      onPress={() => handleVote(threadPayload.root_post, -1)}
                      disabled={
                        !threadPayload.viewer.can_vote ||
                        pendingVotePacketId === threadPayload.root_post.packet.packet_id
                      }
                    />
                    <NexusActionButton
                      label={
                        requestedReplyTargetId === threadPayload.root_post.packet.packet_id
                          ? 'Reply target'
                          : 'Reply here'
                      }
                      onPress={() =>
                        router.replace(
                          getDiscussionHref({
                            forumId: activeForumId,
                            sort: selectedFeedSort,
                            view: 'thread',
                            postId: threadPayload.root_post.packet.packet_id,
                            replyTargetId: threadPayload.root_post.packet.packet_id,
                            replySort: selectedReplySort,
                            showHidden: requestedShowHidden,
                          })
                        )
                      }
                    />
                  </View>

                  {requestedReplyTargetId === threadPayload.root_post.packet.packet_id ? (
                    <InlineReplyComposer
                      appearance={appearance}
                      targetLabel={threadPayload.root_post.title}
                      viewerLabel={anonymousSession.short_label}
                      value={replyBody}
                      error={replyError}
                      disabled={
                        !replyBody.trim() ||
                        isSubmittingReply ||
                        !threadPayload.viewer.can_reply
                      }
                      isSubmitting={isSubmittingReply}
                      onChangeText={setReplyBody}
                      onSubmit={handleCreateReply}
                    />
                  ) : null}
                </NexusCard>

                {threadPayload.replies.length > 0 ? (
                  <View className="gap-3">
                    <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                      Replies
                    </Text>
                    <ReplyTree
                      replies={threadPayload.replies}
                      appearance={appearance}
                      selectedPostId={requestedPostId}
                      highlightedPostId={highlightedPostId}
                      replyTargetPacketId={requestedReplyTargetId}
                      canVote={threadPayload.viewer.can_vote}
                      canReply={threadPayload.viewer.can_reply}
                      viewerLabel={anonymousSession.short_label}
                      replyBody={replyBody}
                      replyError={replyError}
                      isSubmittingReply={isSubmittingReply}
                      onOpen={(postId) =>
                        router.replace(
                          getDiscussionHref({
                            forumId: activeForumId,
                            sort: selectedFeedSort,
                            view: 'thread',
                            postId,
                            replyTargetId: requestedReplyTargetId,
                            replySort: selectedReplySort,
                            showHidden: requestedShowHidden,
                          })
                        )
                      }
                      onReply={(postId) =>
                        router.replace(
                          getDiscussionHref({
                            forumId: activeForumId,
                            sort: selectedFeedSort,
                            view: 'thread',
                            postId,
                            replyTargetId: postId,
                            replySort: selectedReplySort,
                            showHidden: requestedShowHidden,
                          })
                        )
                      }
                      onVote={handleVote}
                      onChangeReplyBody={setReplyBody}
                      onSubmitReply={handleCreateReply}
                      pendingVotePacketId={pendingVotePacketId}
                    />
                  </View>
                ) : (
                  <Text className={appearance.itemBodyClass}>
                    No replies yet. Choose Reply here on the root post to keep the next message attached to the correct place in the tree.
                  </Text>
                )}

                {requestedReplyTargetId && !replyTargetLabel ? (
                  <Text className="text-sm leading-6 text-nexus-rose">
                    The selected reply target is no longer available in this loaded thread.
                  </Text>
                ) : null}
              </View>
            ) : null}
          </View>
        ) : null}
                  </View>
                </View>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </ScrollView>
  );
}
