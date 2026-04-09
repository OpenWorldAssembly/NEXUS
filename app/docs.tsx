/**
 * File: docs.tsx
 * Description: Renders the public charter placeholder page and related source-document context.
 */
import { Link } from 'expo-router';
import { Pressable, ScrollView, Text, View } from 'react-native';

import { charterResources } from '@/data/public/public-site-content';

/**
 * Inputs: none.
 * Output: the public charter destination page with current drafting status and supporting references.
 */
export default function DocsPage() {
  return (
    <ScrollView className="flex-1" contentContainerClassName="pb-16">
      <View className="mx-auto w-full max-w-6xl px-5 py-8">
        <View className="overflow-hidden rounded-[2rem] border border-public-line/70 bg-public-shell/70 px-6 py-10 shadow-public md:px-10">
          <View className="absolute -right-10 top-0 h-44 w-44 rounded-full bg-public-sand/10 blur-3xl" />
          <View className="absolute left-8 top-16 h-40 w-40 rounded-full bg-public-cyan/15 blur-3xl" />

          <Text className="text-sm font-bold uppercase tracking-[0.35em] text-public-sand">
            Charter
          </Text>
          <Text className="mt-4 max-w-4xl text-4xl font-black leading-tight text-public-text md:text-6xl">
            The public charter belongs here.
          </Text>
          <Text className="mt-5 max-w-3xl text-lg leading-8 text-public-muted">
            This route now serves as the charter destination for the public site. The charter itself still needs to be written, so this page currently frames the purpose of that document and points to the materials informing it.
          </Text>

          <View className="mt-8 rounded-[1.75rem] border border-public-line/70 bg-public-panel/60 p-6">
            <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-cyan">
              What the charter should do
            </Text>
            <Text className="mt-3 text-base leading-7 text-public-muted md:text-lg">
              Present the shortest trustworthy statement of OWA principles, legitimacy, structure, and commitments so a new visitor can understand what the system stands for before diving into longer canon and implementation material.
            </Text>
          </View>
        </View>

        <View className="mt-8 flex-row flex-wrap gap-4">
          {charterResources.map((resource) => (
            <View
              key={resource.title}
              className="min-w-[260px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6"
            >
              <Text className="text-xs font-bold uppercase tracking-[0.28em] text-public-cyan">
                {resource.status}
              </Text>
              <Text className="mt-3 text-2xl font-bold text-public-text">
                {resource.title}
              </Text>
              <Text className="mt-3 text-base leading-7 text-public-muted">
                {resource.body}
              </Text>
            </View>
          ))}
        </View>

        <View className="mt-10 flex-row flex-wrap gap-3">
          <Link href="/about" asChild>
            <Pressable className="rounded-full bg-public-accent px-6 py-3">
              <Text className="text-sm font-extrabold uppercase tracking-[0.18em] text-public-canvas">
                Learn More
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
