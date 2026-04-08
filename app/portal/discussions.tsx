/**
 * File: discussions.tsx
 * Description: Renders the guest discussions surface with a public visitor lobby composer and forum previews.
 */
import { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';

import { usePortalShell } from '@/components/portal/portal-shell-context';
import {
  PortalActionButton,
  PortalBadge,
  PortalCard,
  PortalSectionHeader,
} from '@/components/portal/portal-ui';
import {
  portalDiscussionForums,
  portalThreadPreviews,
} from '@/data/portal/mock-portal-data';
import { matchesScope } from '@/lib/portal/portal-shell';

type GuestLobbyPost = {
  id: string;
  title: string;
  body: string;
};

/**
 * Inputs: none.
 * Output: the discussions portal surface for the active scope, including the visitor lobby composer.
 */
export default function PortalDiscussionsPage() {
  const { activeScope } = usePortalShell();
  const [draftTitle, setDraftTitle] = useState('');
  const [draftBody, setDraftBody] = useState('');
  const [guestPosts, setGuestPosts] = useState<GuestLobbyPost[]>([]);
  const visibleForums = portalDiscussionForums.filter((forum) =>
    matchesScope(forum.scopeIds, activeScope.id),
  );
  const visibleThreads = portalThreadPreviews.filter((thread) =>
    matchesScope(thread.scopeIds, activeScope.id),
  );

  /**
   * Inputs: none.
   * Output: appends a local-only visitor lobby post preview for the current guest session.
   */
  const handleGuestPost = () => {
    if (!draftTitle.trim() && !draftBody.trim()) {
      return;
    }

    setGuestPosts((currentPosts) => [
      {
        id: `guest-${Date.now()}`,
        title: draftTitle.trim() || 'Anonymous visitor note',
        body: draftBody.trim(),
      },
      ...currentPosts,
    ]);
    setDraftTitle('');
    setDraftBody('');
  };

  return (
    <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
      <View className="gap-6 px-4 py-6 lg:px-8 lg:py-8">
        <PortalSectionHeader
          eyebrow="Discussions"
          title={`${activeScope.shortLabel} forum surface`}
          description="This layer is Reddit-inspired in feel, but packet-native underneath. Guests can only speak inside visitor lobby spaces in this first slice."
          trailing={
            <View className="flex-row flex-wrap gap-3">
              <PortalBadge label="Sorts: hot, new, top" tone="sky" />
              <PortalBadge label="Packet-linked threads" tone="gold" />
            </View>
          }
        />

        <View className="gap-4 xl:flex-row">
          <View className="flex-1 gap-4">
            <PortalCard className="gap-4" tone="mint">
              <View className="gap-2">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-mint">
                  Visitor lobby
                </Text>
                <Text className="text-2xl font-bold text-portal-text">
                  {activeScope.publicLobbyLabel}
                </Text>
                <Text className="text-sm leading-7 text-portal-muted">
                  Public guests can ask locality questions, introduce themselves,
                  and start lightweight coordination threads here. Deeper rooms stay
                  read-only until trust and identity layers arrive.
                </Text>
              </View>

              <View className="gap-3">
                <TextInput
                  className="rounded-[24px] border border-portal-line bg-white/5 px-4 py-3 text-base text-portal-text"
                  onChangeText={setDraftTitle}
                  placeholder="Thread title"
                  placeholderTextColor="#8fa7ba"
                  value={draftTitle}
                />
                <TextInput
                  className="min-h-[140px] rounded-[24px] border border-portal-line bg-white/5 px-4 py-4 text-base text-portal-text"
                  multiline
                  onChangeText={setDraftBody}
                  placeholder="Introduce yourself, ask how to find your locality, or propose a public question for the assembly."
                  placeholderTextColor="#8fa7ba"
                  textAlignVertical="top"
                  value={draftBody}
                />
                <View className="flex-row flex-wrap gap-3">
                  <PortalActionButton
                    label="Post to visitor lobby"
                    onPress={handleGuestPost}
                    variant="primary"
                  />
                  <PortalActionButton label="Convert to proposal later" disabled />
                </View>
              </View>
            </PortalCard>

            {guestPosts.length > 0 ? (
              <PortalCard className="gap-4">
                <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                  Session drafts
                </Text>
                <View className="gap-3">
                  {guestPosts.map((post) => (
                    <PortalCard key={post.id} className="gap-2 bg-white/5 p-4">
                      <View className="flex-row items-center justify-between gap-3">
                        <Text className="text-base font-semibold text-portal-text">
                          {post.title}
                        </Text>
                        <PortalBadge label="Anonymous guest" tone="mint" />
                      </View>
                      <Text className="text-sm leading-6 text-portal-muted">
                        {post.body || 'No body text yet.'}
                      </Text>
                    </PortalCard>
                  ))}
                </View>
              </PortalCard>
            ) : null}
          </View>

          <View className="flex-1 gap-4">
            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Public forum spaces
              </Text>
              <View className="gap-3">
                {visibleForums.map((forum) => (
                  <PortalCard
                    key={forum.id}
                    className="gap-2 bg-white/5 p-4"
                    tone={forum.publicPosting ? 'mint' : 'default'}
                  >
                    <View className="flex-row flex-wrap items-center gap-2">
                      <Text className="text-base font-semibold text-portal-text">
                        {forum.title}
                      </Text>
                      <PortalBadge
                        label={forum.publicPosting ? 'Guest posting open' : 'Read only'}
                        tone={forum.publicPosting ? 'mint' : 'default'}
                      />
                    </View>
                    <Text className="text-sm leading-6 text-portal-muted">
                      {forum.description}
                    </Text>
                    <Text className="text-xs uppercase tracking-[2px] text-portal-muted">
                      {forum.cadence} · {forum.linkedPacketLabel}
                    </Text>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>

            <PortalCard className="gap-4">
              <Text className="text-xs font-semibold uppercase tracking-[3px] text-portal-sky">
                Active threads
              </Text>
              <View className="gap-3">
                {visibleThreads.map((thread) => (
                  <PortalCard
                    key={thread.id}
                    className="gap-2 bg-white/5 p-4"
                    tone={thread.tone}
                  >
                    <View className="flex-row items-start justify-between gap-3">
                      <View className="flex-1 gap-1">
                        <Text className="text-base font-semibold text-portal-text">
                          {thread.title}
                        </Text>
                        <Text className="text-sm text-portal-muted">
                          {thread.author}
                        </Text>
                      </View>
                      <PortalBadge label={thread.activity} tone={thread.tone} />
                    </View>
                    <Text className="text-sm leading-6 text-portal-muted">
                      {thread.preview}
                    </Text>
                  </PortalCard>
                ))}
              </View>
            </PortalCard>
          </View>
        </View>
      </View>
    </ScrollView>
  );
}
