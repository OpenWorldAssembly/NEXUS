/**
 * File: discussions.tsx
 * Description: Renders the guest discussions surface with a shared visitor-lobby composer and read-only forum previews.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  Platform,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';

import { getOrCreateAnonymousSession } from '@/lib/nexus/anonymous-session';
import {
  createVisitorLobbyPost,
  fetchVisitorLobbyFeed,
} from '@/lib/nexus/visitor-lobby-api';
import {
  getVisitorLobbyPostAuthorLabel,
  type VisitorLobbyScopeFeed,
} from '@/lib/nexus/visitor-lobby';
import { useNexusShell } from '@/components/nexus/nexus-shell-context';
import {
  NexusActionButton,
  NexusBadge,
  NexusCard,
  NexusSectionHeader,
} from '@/components/nexus/nexus-ui';
import {
  nexusDiscussionForums,
  nexusThreadPreviews,
} from '@/data/nexus/mock-nexus-data';
import { matchesScope } from '@/lib/nexus/nexus-shell';

const SHARED_LOBBY_WEB_ONLY_MESSAGE =
  'Shared visitor-lobby persistence is currently available in local web runs only.';

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
 * Inputs: none.
 * Output: the discussions nexus surface for the active scope, including the shared visitor lobby flow.
 */
export default function NexusDiscussionsPage() {
  const { activeScope } = useNexusShell();
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [lobbyFeed, setLobbyFeed] = useState<VisitorLobbyScopeFeed | null>(null);
  const [isLoadingLobby, setIsLoadingLobby] = useState(Platform.OS === 'web');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [isPosting, setIsPosting] = useState(false);
  const isSharedLobbyAvailable = Platform.OS === 'web';
  const anonymousSession = getOrCreateAnonymousSession();
  const visibleForums = nexusDiscussionForums.filter((forum) =>
    matchesScope(forum.scopeIds, activeScope.id),
  );
  const visibleThreads = nexusThreadPreviews
    .filter((thread) => matchesScope(thread.scopeIds, activeScope.id))
    .slice(0, 3);

  /**
   * Inputs: a scope id string.
   * Output: refreshes the saved visitor-lobby thread and posts for that scope.
   */
  const loadVisitorLobby = useCallback(
    async (scopeId: string) => {
      if (!isSharedLobbyAvailable) {
        setIsLoadingLobby(false);
        setLoadError(null);
        setLobbyFeed(null);
        return;
      }

      setIsLoadingLobby(true);
      setLoadError(null);

      try {
        const nextLobbyFeed = await fetchVisitorLobbyFeed(scopeId);

        setLobbyFeed(nextLobbyFeed);
      } catch (error) {
        setLoadError(
          error instanceof Error
            ? error.message
            : 'Unable to load the visitor lobby.',
        );
        setLobbyFeed(null);
      } finally {
        setIsLoadingLobby(false);
      }
    },
    [isSharedLobbyAvailable],
  );

  useEffect(() => {
    setSubmitError(null);
    void loadVisitorLobby(activeScope.id);
  }, [activeScope.id, loadVisitorLobby]);

  /**
   * Inputs: none.
   * Output: saves the current visitor-lobby post through the shared bundle-backed API.
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
        error instanceof Error
          ? error.message
          : 'Unable to save the visitor lobby post.',
      );
    } finally {
      setIsPosting(false);
    }
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <NexusSectionHeader
          eyebrow="Discussions"
          title={`${activeScope.shortLabel} forum surface`}
          description="This layer is Reddit-inspired in feel, but packet-native underneath. The visitor lobby is now the first durable public posting surface in the Nexus MVP."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <NexusBadge label="Visitor lobby live" tone="mint" />
              <NexusBadge label="Packet-shaped bundle" tone="gold" />
            </View>
          }
        />

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <NexusCard className="gap-4" tone="mint">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-mint">
                  Visitor lobby
                </Text>
                <Text className="text-2xl font-bold text-nexus-text">
                  {activeScope.publicLobbyLabel}
                </Text>
                <Text className="text-sm leading-7 text-nexus-muted">
                  Public guests can ask locality questions, introduce themselves,
                  and start lightweight coordination threads here. Deeper rooms stay
                  read-only until trust and identity layers arrive.
                </Text>
                <View className="flex-row flex-wrap gap-2">
                  <NexusBadge label={anonymousSession.short_label} tone="sky" />
                  <NexusBadge
                    label={
                      isSharedLobbyAvailable ? 'Shared dev bundle' : 'Web dev only'
                    }
                    tone={isSharedLobbyAvailable ? 'mint' : 'default'}
                  />
                </View>
              </View>

              <View className="gap-3">
                <TextInput
                  className="rounded-[24px] border border-nexus-line bg-white/5 px-4 py-3 text-base text-nexus-text"
                  onChangeText={setDraftTitle}
                  placeholder="Thread title"
                  placeholderTextColor="#8fa7ba"
                  value={draftTitle}
                />
                <TextInput
                  className="min-h-[140px] rounded-[24px] border border-nexus-line bg-white/5 px-4 py-4 text-base text-nexus-text"
                  multiline
                  onChangeText={setDraftBody}
                  placeholder="Introduce yourself, ask how to find your locality, or propose a public question for the assembly."
                  placeholderTextColor="#8fa7ba"
                  textAlignVertical="top"
                  value={draftBody}
                />

                {submitError ? (
                  <Text className="text-sm leading-6 text-nexus-rose">
                    {submitError}
                  </Text>
                ) : null}

                {!isSharedLobbyAvailable ? (
                  <Text className="text-sm leading-6 text-nexus-muted">
                    {SHARED_LOBBY_WEB_ONLY_MESSAGE}
                  </Text>
                ) : null}

                <View className="flex-row flex-wrap gap-3">
                  <NexusActionButton
                    disabled={!draftBody.trim() || isPosting || !isSharedLobbyAvailable}
                    label={isPosting ? 'Posting…' : 'Post to visitor lobby'}
                    onPress={handleGuestPost}
                    variant="primary"
                  />
                  <NexusActionButton label="Convert to proposal later" disabled />
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
                    className="max-w-full rounded-[18px]"
                    textClassName="leading-4"
                  />
                ) : null}
              </View>

              {!isSharedLobbyAvailable ? (
                <Text className="text-sm leading-6 text-nexus-muted">
                  Shared visitor-lobby persistence is enabled for web development
                  runs first. Native and static-only surfaces stay read-only in this
                  slice.
                </Text>
              ) : isLoadingLobby ? (
                <Text className="text-sm leading-6 text-nexus-muted">
                  Loading saved visitor-lobby posts…
                </Text>
              ) : loadError ? (
                <View className="gap-3">
                  <Text className="text-sm leading-6 text-nexus-rose">
                    {loadError}
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
                    <NexusCard key={post.header.packet_id} className="gap-3 bg-white/5 p-4">
                      <View className="flex-row items-start justify-between gap-3">
                        <View className="flex-1 gap-1">
                          <Text className="text-base font-semibold text-nexus-text">
                            {post.body.title}
                          </Text>
                          <Text className="text-xs uppercase tracking-[2px] text-nexus-muted">
                            {formatPostedAt(post.header.created_at)}
                          </Text>
                        </View>
                        <NexusBadge
                          label={getVisitorLobbyPostAuthorLabel(post)}
                          tone="mint"
                          className="max-w-[180px] rounded-[18px]"
                          textClassName="leading-4"
                        />
                      </View>
                      <Text className="text-sm leading-6 text-nexus-muted">
                        {post.body.content_markdown}
                      </Text>
                    </NexusCard>
                  ))}
                </View>
              ) : (
                <Text className="text-sm leading-6 text-nexus-muted">
                  No saved visitor-lobby posts yet. The first post in this scope
                  will seed the visible public thread for everyone using this local
                  dev server.
                </Text>
              )}
            </NexusCard>
          </View>

          <View className="flex-1 gap-4">
            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Public forum spaces
              </Text>
              <View className="gap-3">
                {visibleForums.map((forum) => (
                  <NexusCard
                    key={forum.id}
                    className="gap-2 bg-white/5 p-4"
                    tone={forum.publicPosting ? 'mint' : 'default'}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-base font-semibold text-nexus-text">
                        {forum.title}
                      </Text>
                      <NexusBadge
                        label={forum.publicPosting ? 'Guest posting open' : 'Read only'}
                        tone={forum.publicPosting ? 'mint' : 'default'}
                      />
                    </View>
                    <Text className="text-sm leading-6 text-nexus-muted">
                      {forum.description}
                    </Text>
                    <Text className="text-xs uppercase tracking-[2px] text-nexus-muted">
                      {forum.cadence} · {forum.linkedPacketLabel}
                    </Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>

            <NexusCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-nexus-sky">
                Read-only thread previews
              </Text>
              <View className="gap-3">
                {visibleThreads.map((thread) => (
                  <NexusCard
                    key={thread.id}
                    className="gap-2 bg-white/5 p-4"
                    tone={thread.tone}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <Text className="text-base font-semibold text-nexus-text">
                          {thread.title}
                        </Text>
                        <Text className="text-sm text-nexus-muted">
                          {thread.author}
                        </Text>
                      </View>
                      <NexusBadge label={thread.activity} tone={thread.tone} />
                    </View>
                    <Text className="text-sm leading-6 text-nexus-muted">
                      {thread.preview}
                    </Text>
                  </NexusCard>
                ))}
              </View>
            </NexusCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
