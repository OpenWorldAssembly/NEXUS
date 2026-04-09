/**
 * File: discussions.tsx
 * Description: Renders the guest discussions surface with route-backed forum tabs and the shared visitor-lobby composer.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Href } from 'expo-router';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  Platform,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  useNexusAppearance,
  NexusSectionHeader,
} from '@/components/nexus/nexus-ui';
import { getOrCreateAnonymousSession } from '@/lib/nexus/anonymous-session';
import type { NexusDiscussionsPayload } from '@/lib/nexus/nexus-api-types';
import { fetchNexusDiscussionsPayload } from '@/lib/nexus/nexus-query-api';
import {
  createVisitorLobbyPost,
  fetchVisitorLobbyFeed,
} from '@/lib/nexus/visitor-lobby-api';
import {
  createVisitorLobbyThreadPacketId,
  getVisitorLobbyPostAuthorLabel,
  type VisitorLobbyScopeFeed,
} from '@/lib/nexus/visitor-lobby';

const SHARED_LOBBY_WEB_ONLY_MESSAGE =
  'Shared visitor-lobby persistence is currently available in local web runs only.';
const VISITOR_LOBBY_FORUM_ID = 'visitor-lobby';

type DiscussionForum = {
  id: string;
  title: string;
  description: string;
  cadence: string;
  publicPosting: boolean;
  linkedPacketLabel: string;
  threadPacketId: string;
};

/**
 * Inputs: a forum query parameter value.
 * Output: a normalized forum id string when present.
 */
function normalizeForumQueryValue(
  forumQueryValue: string | string[] | undefined,
): string | null {
  if (typeof forumQueryValue === 'string' && forumQueryValue.trim().length > 0) {
    return forumQueryValue;
  }

  if (Array.isArray(forumQueryValue) && forumQueryValue[0]?.trim().length) {
    return forumQueryValue[0];
  }

  return null;
}

/**
 * Inputs: a forum id.
 * Output: the discussions URL that preserves the active forum tab in the route.
 */
function getDiscussionForumHref(forumId: string): Href {
  return `/nexus/discussions?forum=${encodeURIComponent(forumId)}` as Href;
}

/**
 * Inputs: an ISO timestamp string.
 * Output: a compact local date label for discussion post cards.
 */
function formatPostedAt(isoTimestamp: string): string {
  return new Date(isoTimestamp).toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

/**
 * Inputs: a raw API error message and the action that failed.
 * Output: a user-facing message that keeps temporary backend gaps readable in the UI.
 */
function getFriendlyLobbyErrorMessage(
  message: string,
  action: 'load' | 'post',
): string {
  const normalizedMessage = message.trim().toLowerCase();

  if (
    normalizedMessage === 'not found' ||
    normalizedMessage.includes('failed to fetch') ||
    normalizedMessage.includes('network')
  ) {
    return action === 'load'
      ? 'The visitor lobby is not reachable right now. Refresh or retry in a moment while the local service finishes coming online.'
      : 'The visitor lobby could not save that post right now. Try again in a moment.';
  }

  return message;
}

/**
 * Inputs: none.
 * Output: the discussions nexus surface for the active scope, including the shared visitor-lobby flow.
 */
export default function NexusDiscussionsPage() {
  const router = useRouter();
  const localParams = useLocalSearchParams<{ forum?: string | string[] }>();
  const { activeScope, themeMode } = useNexusShell();
  const appearance = useNexusAppearance();
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [discussionsPayload, setDiscussionsPayload] =
    useState<NexusDiscussionsPayload | null>(null);
  const [isLoadingDiscussions, setIsLoadingDiscussions] = useState(true);
  const [discussionsError, setDiscussionsError] = useState<string | null>(null);
  const [lobbyFeed, setLobbyFeed] = useState<VisitorLobbyScopeFeed | null>(null);
  const [isLoadingLobby, setIsLoadingLobby] = useState(Platform.OS === 'web');
  const [lobbyLoadError, setLobbyLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const isSharedLobbyAvailable = Platform.OS === 'web';
  const anonymousSession = getOrCreateAnonymousSession();
  const requestedForumId = normalizeForumQueryValue(localParams.forum);
  const visibleForums = useMemo(
    () => {
      const payloadForums: DiscussionForum[] = (discussionsPayload?.forums ?? []).map(
        (forum) => ({
          id: forum.id,
          title: forum.title,
          description: forum.description,
          cadence: forum.cadence,
          publicPosting: forum.public_posting,
          linkedPacketLabel: forum.linked_packet_label,
          threadPacketId: forum.thread_packet_id,
        }),
      );

      if (payloadForums.length > 0) {
        return payloadForums;
      }

      return [
        {
          id: VISITOR_LOBBY_FORUM_ID,
          title: 'Visitor Lobby',
          description:
            'Public channel for introductions, locality questions, and newcomer orientation.',
          cadence: 'Open',
          publicPosting: true,
          linkedPacketLabel: 'Visitor lobby thread packet',
          threadPacketId: createVisitorLobbyThreadPacketId(activeScope.id),
        },
      ];
    },
    [activeScope.id, discussionsPayload],
  );
  const hasVisitorLobby = visibleForums.some(
    (forum) => forum.id === VISITOR_LOBBY_FORUM_ID,
  );
  const defaultForumId =
    visibleForums.find((forum) => forum.publicPosting)?.id ??
    visibleForums[0]?.id ??
    VISITOR_LOBBY_FORUM_ID;
  const selectedForum =
    visibleForums.find((forum) => forum.id === requestedForumId) ??
    visibleForums.find((forum) => forum.id === defaultForumId) ??
    null;
  const isVisitorLobbySelected = selectedForum?.id === VISITOR_LOBBY_FORUM_ID;
  const panelClass =
    themeMode === 'dark'
      ? 'border-nexus-line/70 bg-nexus-panel'
      : 'border-slate-300 bg-white';
  const raisedTabClass =
    themeMode === 'dark'
      ? 'rounded-t-[22px] rounded-b-none border-nexus-sky bg-nexus-panel pb-4'
      : 'rounded-t-[22px] rounded-b-none border-sky-400 bg-white pb-4';
  const idleTabClass =
    themeMode === 'dark'
      ? 'rounded-[20px] border-nexus-line/70 bg-white/5'
      : 'rounded-[20px] border-slate-300 bg-slate-100';
  const insetCardClass =
    themeMode === 'dark' ? 'bg-white/5' : 'border-slate-300 bg-slate-100';

  /**
   * Inputs: a scope id string.
   * Output: refreshes the saved visitor-lobby thread and posts for that scope.
   */
  const loadVisitorLobby = useCallback(
    async (scopeId: string) => {
      if (!isSharedLobbyAvailable || !hasVisitorLobby) {
        setIsLoadingLobby(false);
        setLobbyLoadError(null);
        setLobbyFeed(null);
        return;
      }

      setIsLoadingLobby(true);
      setLobbyLoadError(null);

      try {
        const nextLobbyFeed = await fetchVisitorLobbyFeed(scopeId);

        setLobbyFeed(nextLobbyFeed);
      } catch (error) {
        setLobbyLoadError(
          getFriendlyLobbyErrorMessage(
            error instanceof Error
              ? error.message
              : 'Unable to load the visitor lobby.',
            'load',
          ),
        );
        setLobbyFeed(null);
      } finally {
        setIsLoadingLobby(false);
      }
    },
    [hasVisitorLobby, isSharedLobbyAvailable],
  );

  /**
   * Inputs: a scope id string.
   * Output: refreshes packet-backed discussions metadata for that scope.
   */
  const loadDiscussions = useCallback(async (scopeId: string) => {
    setIsLoadingDiscussions(true);
    setDiscussionsError(null);

    try {
      const nextDiscussionsPayload = await fetchNexusDiscussionsPayload(scopeId);

      setDiscussionsPayload(nextDiscussionsPayload);
    } catch (error) {
      setDiscussionsError(
        error instanceof Error
          ? error.message
          : 'Unable to load packet-backed discussions.',
      );
      setDiscussionsPayload(null);
    } finally {
      setIsLoadingDiscussions(false);
    }
  }, []);

  useEffect(() => {
    setSubmitError(null);
    void loadDiscussions(activeScope.id);

    if (!hasVisitorLobby) {
      setIsLoadingLobby(false);
      setLobbyLoadError(null);
      setLobbyFeed(null);
      return;
    }

    void loadVisitorLobby(activeScope.id);
  }, [activeScope.id, hasVisitorLobby, loadDiscussions, loadVisitorLobby]);

  /**
   * Inputs: none.
   * Output: saves the current visitor-lobby post through the local packet-store-backed API.
   */
  const handleGuestPost = async () => {
    if (!isSharedLobbyAvailable) {
      setSubmitError(SHARED_LOBBY_WEB_ONLY_MESSAGE);
      return;
    }

    if (!draftBody.trim()) {
      setSubmitError('Write a little context before posting to the visitor lobby.');
      return;
    }

    setIsPosting(true);
    setSubmitError(null);

    try {
      const savedPost = await createVisitorLobbyPost({
        scopeId: activeScope.id,
        session: anonymousSession,
        title: draftTitle,
        body: draftBody,
      });

      setLobbyFeed((currentFeed) =>
        currentFeed
          ? {
              ...currentFeed,
              posts: [savedPost, ...currentFeed.posts],
            }
          : currentFeed,
      );
      setDraftTitle('');
      setDraftBody('');
    } catch (error) {
      setSubmitError(
        getFriendlyLobbyErrorMessage(
          error instanceof Error
            ? error.message
            : 'Unable to save the visitor lobby post.',
          'post',
        ),
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className={appearance.pageContainerClass}>
        <NexusSectionHeader
          eyebrow="Discussions"
          title={`${activeScope.name} discussions`}
          description={`Browse the public discussion spaces attached to ${activeScope.name}. The visitor lobby is open to guests now, while the other forums stay visible so the packet-native structure is legible as more of the system comes online.`}
        />

        {isLoadingDiscussions ? (
          <NexusCard>
            <Text className={appearance.itemBodyClass}>
              Loading packet-backed discussion forums...
            </Text>
          </NexusCard>
        ) : null}

        {discussionsError ? (
          <NexusCard>
            <Text className="text-sm leading-6 text-nexus-rose">
              {discussionsError}
            </Text>
          </NexusCard>
        ) : null}

        <View className="gap-0">
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="flex-grow-0"
          >
            <View className="flex-row items-end gap-2 pr-4">
              {visibleForums.map((forum) => {
                const isSelected = forum.id === selectedForum?.id;

                return (
                  <Pressable
                    key={forum.id}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: isSelected }}
                    className={`min-w-[148px] border px-4 py-3 ${
                      isSelected ? raisedTabClass : idleTabClass
                    }`}
                    onPress={() =>
                      router.replace(getDiscussionForumHref(forum.id))
                    }
                  >
                    <View className="gap-1">
                      <Text className={appearance.itemTitleClass}>
                        {forum.title}
                      </Text>
                      <Text className={appearance.itemMetaClass}>
                        {forum.publicPosting ? 'Guest posting open' : 'Read only'}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </View>
          </ScrollView>

          {selectedForum ? (
            <View className={`-mt-px rounded-[28px] border p-5 shadow-nexus ${panelClass}`}>
              <View className="gap-4">
                <View className="gap-3">
                  <View className="flex-row flex-wrap items-start justify-between gap-3">
                    <View className="min-w-0 flex-1 gap-2">
                      <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                        {selectedForum.title}
                      </Text>
                      <Text className={appearance.surfaceTitleClass}>
                        {selectedForum.id === VISITOR_LOBBY_FORUM_ID
                          ? activeScope.publicLobbyLabel
                          : selectedForum.title}
                      </Text>
                      <Text className={appearance.sectionBodyClass}>
                        {selectedForum.description}
                      </Text>
                    </View>

                    <NexusBadge
                      label={selectedForum.publicPosting ? 'Guest posting open' : 'Read only'}
                      tone={selectedForum.publicPosting ? 'mint' : 'default'}
                      className="self-start"
                    />
                  </View>

                  <View className="flex-row flex-wrap gap-2">
                    <NexusBadge label={activeScope.shortLabel} tone="sky" />
                    <NexusBadge label={selectedForum.cadence} tone="default" />
                    {isVisitorLobbySelected ? (
                      <NexusBadge label={anonymousSession.short_label} tone="mint" />
                    ) : null}
                  </View>

                  <Text className={appearance.itemMetaClass}>
                    {selectedForum.linkedPacketLabel}
                  </Text>
                </View>
              </View>
            </View>
          ) : null}
        </View>

        {isVisitorLobbySelected ? (
          <View className="gap-4">
            <NexusCard className="gap-4">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Visitor lobby posting
                </Text>
                <Text className={appearance.sectionBodyClass}>
                  Ask locality questions, introduce yourself, or open a lightweight
                  public thread before deeper trust and identity layers arrive.
                </Text>
              </View>

              <View className="gap-3">
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
                  placeholder="Introduce yourself, ask how to find your locality, or post a public question for this scope."
                  placeholderTextColor={appearance.textInputPlaceholderColor}
                  textAlignVertical="top"
                  value={draftBody}
                />

                {submitError ? (
                  <Text className="text-sm leading-6 text-nexus-rose">
                    {submitError}
                  </Text>
                ) : null}

                {!isSharedLobbyAvailable ? (
                  <Text className={appearance.itemBodyClass}>
                    {SHARED_LOBBY_WEB_ONLY_MESSAGE}
                  </Text>
                ) : null}

                <View className="flex-row flex-wrap gap-3">
                  <NexusActionButton
                    disabled={!draftBody.trim() || isPosting || !isSharedLobbyAvailable}
                    label={isPosting ? 'Posting...' : 'Post to visitor lobby'}
                    onPress={handleGuestPost}
                    variant="primary"
                  />
                </View>
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <View className="flex-row flex-wrap items-center justify-between gap-3">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                  Saved visitor posts
                </Text>
                {lobbyFeed ? (
                  <NexusBadge
                    label={lobbyFeed.thread.body.title}
                    tone="default"
                    className="max-w-full rounded-[18px] self-start"
                    textClassName="leading-4"
                  />
                ) : null}
              </View>

              {!isSharedLobbyAvailable ? (
                <Text className={appearance.itemBodyClass}>
                  Shared visitor-lobby persistence is enabled for local web
                  development first. Native and static-only surfaces stay read only
                  in this slice.
                </Text>
              ) : isLoadingLobby ? (
                <Text className={appearance.itemBodyClass}>
                  Loading saved visitor-lobby posts...
                </Text>
              ) : lobbyLoadError ? (
                <View className="gap-3">
                  <Text className="text-sm leading-6 text-nexus-rose">
                    {lobbyLoadError}
                  </Text>
                  <View className="flex-row flex-wrap gap-3">
                    <NexusActionButton
                      label="Retry"
                      onPress={() => void loadVisitorLobby(activeScope.id)}
                    />
                  </View>
                </View>
              ) : lobbyFeed && lobbyFeed.posts.length > 0 ? (
                <View className="gap-3">
                  {lobbyFeed.posts.map((post) => (
                    <NexusCard
                      key={post.header.packet_id}
                      className={`gap-3 p-4 ${insetCardClass}`}
                    >
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="min-w-0 flex-1 gap-1">
                          <Text className={appearance.itemTitleClass}>
                            {post.body.title}
                          </Text>
                          <Text className={appearance.itemMetaClass}>
                            {formatPostedAt(post.header.created_at)}
                          </Text>
                        </View>
                        <NexusBadge
                          label={getVisitorLobbyPostAuthorLabel(post)}
                          tone="mint"
                          className="max-w-[180px] rounded-[18px] self-start"
                          textClassName="leading-4"
                        />
                      </View>
                      <Text className={appearance.itemBodyClass}>
                        {post.body.content_markdown}
                      </Text>
                    </NexusCard>
                  ))}
                </View>
              ) : (
                <Text className={appearance.itemBodyClass}>
                  No saved visitor-lobby posts yet. The first public post in this
                  scope will seed the shared thread for everyone using this local
                  dev server.
                </Text>
              )}
            </NexusCard>
          </View>
        ) : selectedForum ? (
          <NexusCard className="gap-4">
            <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
              Forum status
            </Text>
            <Text className={appearance.sectionBodyClass}>
              This forum stays readable while the visitor lobby path stabilizes.
              Posting, packet linking, and saved thread views can land here later
              without changing the overall page layout.
            </Text>
          </NexusCard>
        ) : null}
      </View>
    </ScrollView>
  );
}
