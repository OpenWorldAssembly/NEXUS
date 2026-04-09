/**
 * File: about.tsx
 * Description: Renders the public OWA about page with expandable sections drawn from current canon and implementation themes.
 */
import { Link } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { aboutSections } from '@/data/public/public-site-content';

/**
 * Inputs: none.
 * Output: the public about page with section navigation and expandable detail cards.
 */
export default function AboutPage() {
  const [activeSectionId, setActiveSectionId] = useState(aboutSections[0]?.id ?? '');

  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-16">
      <View className="mx-auto w-full max-w-6xl px-5 py-8">
        <View className="overflow-hidden rounded-[2rem] border border-public-line/70 bg-public-shell/70 px-6 py-10 shadow-public md:px-10">
          <View className="absolute left-8 top-8 h-36 w-36 rounded-full bg-public-accent/10 blur-3xl" />
          <View className="absolute right-8 top-20 h-44 w-44 rounded-full bg-public-cyan/15 blur-3xl" />

          <Text className="text-sm font-bold uppercase tracking-[0.35em] text-public-cyan">
            About OWA
          </Text>
          <Text className="mt-4 max-w-4xl text-4xl font-black leading-tight text-public-text md:text-6xl">
            A system for direct coordination across place, scale, and shared intent.
          </Text>
          <Text className="mt-5 max-w-3xl text-lg leading-8 text-public-muted">
            This page expands on the public framing with concepts drawn from the current canon and implementation materials. Use the section links to open the part you want to explore first.
          </Text>

          <View className="mt-8 flex-row flex-wrap gap-3">
            {aboutSections.map((section) => {
              const isActive = section.id === activeSectionId;

              return (
                <Pressable
                  key={section.id}
                  className={[
                    'rounded-full border px-4 py-2',
                    isActive
                      ? 'border-public-accent bg-public-accent'
                      : 'border-public-line bg-public-panel/60',
                  ].join(' ')}
                  onPress={() => setActiveSectionId(section.id)}
                >
                  <Text
                    className={[
                      'text-sm font-bold uppercase tracking-[0.18em]',
                      isActive ? 'text-public-canvas' : 'text-public-text',
                    ].join(' ')}
                  >
                    {section.title}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <View className="mt-8 gap-4">
          {aboutSections.map((section) => {
            const isActive = section.id === activeSectionId;

            return (
              <View
                key={section.id}
                className={[
                  'overflow-hidden rounded-[1.75rem] border bg-public-panel/55',
                  isActive ? 'border-public-accent/80 shadow-public' : 'border-public-line/70',
                ].join(' ')}
              >
                <Pressable
                  className="gap-3 px-6 py-6 md:px-8"
                  onPress={() =>
                    setActiveSectionId((currentId) =>
                      currentId === section.id ? '' : section.id
                    )
                  }
                >
                  <View className="flex-row items-start justify-between gap-4">
                    <View className="flex-1 gap-2">
                      <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-sand">
                        {section.title}
                      </Text>
                      <Text className="text-2xl font-bold text-public-text md:text-3xl">
                        {section.summary}
                      </Text>
                    </View>

                    <Text className="pt-1 text-sm font-bold uppercase tracking-[0.18em] text-public-cyan">
                      {isActive ? 'Collapse' : 'Expand'}
                    </Text>
                  </View>

                  {isActive ? (
                    <View className="gap-3 pt-3">
                      {section.points.map((point) => (
                        <View
                          key={point}
                          className="rounded-[1.25rem] border border-public-line/70 bg-public-shell/70 p-4"
                        >
                          <Text className="text-base leading-7 text-public-muted">
                            {point}
                          </Text>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </Pressable>
              </View>
            );
          })}
        </View>

        <View className="mt-10 flex-row flex-wrap gap-4">
          <View className="min-w-[280px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6">
            <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-cyan">
              Next reading
            </Text>
            <Text className="mt-3 text-2xl font-bold text-public-text">
              Move from overview to commitment
            </Text>
            <Text className="mt-3 text-base leading-7 text-public-muted">
              The charter route is where the concise public statement belongs. For now it acts as the dedicated destination for that future document and its supporting references.
            </Text>
          </View>

          <View className="min-w-[280px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6">
            <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-cyan">
              Participation
            </Text>
            <Text className="mt-3 text-2xl font-bold text-public-text">
              The portal stays separate
            </Text>
            <Text className="mt-3 text-base leading-7 text-public-muted">
              The public site explains the system. The portal is still its own interface for browsing the Nexus and future participation flows.
            </Text>
          </View>
        </View>

        <View className="mt-8 flex-row flex-wrap gap-3">
          <Link href="/docs" asChild>
            <Pressable className="rounded-full bg-public-accent px-6 py-3">
              <Text className="text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas">
                Read the Charter
              </Text>
            </Pressable>
          </Link>

          <Link href="/portal" asChild>
            <Pressable className="rounded-full border border-public-line bg-public-panel/70 px-6 py-3">
              <Text className="text-sm font-bold uppercase tracking-[0.18em] text-public-text">
                Browse the Nexus
              </Text>
            </Pressable>
          </Link>
        </View>
      </View>
    </ScrollView>
  );
}
