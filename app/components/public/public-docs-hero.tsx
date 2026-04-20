/**
 * File: app/components/public/public-docs-hero.tsx
 * Description: Hero section for the public charter page.
 */
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { CharterHero } from '@app/public/docs-content';

type PublicDocsHeroProps = {
  hero: CharterHero;
};

/**
 * Inputs: charter hero content.
 * Output: a wide introductory panel that matches the public-site visual system.
 */
export function PublicDocsHero({ hero }: PublicDocsHeroProps) {
  return (
    <View className="relative overflow-hidden rounded-[28px] border border-public-line/60 bg-public-panel/75 px-7 py-8 md:px-10 md:py-10">
      <Image
        source={{ uri: hero.backgroundImageUri }}
        contentFit="cover"
        transition={150}
        className="absolute inset-0 opacity-70"
      />
      <View className="absolute inset-0 bg-[#041225]/78" />

      <View className="relative flex flex-col gap-8 md:flex-row md:items-start md:justify-between">
        <View className="max-w-[540px] gap-4">
          <Text className="font-public-display text-[14px] uppercase tracking-[0.34em] text-[#d4f79a] md:text-[15px]">
            {hero.subtitle}
          </Text>
          <Text className="font-public-display text-[34px] uppercase leading-[0.94] tracking-[-0.03em] text-[#f5f8ff] md:text-[60px]">
            {hero.title}
          </Text>
        </View>

        <View className="max-w-[460px] gap-4 md:pt-2">
          <Text className="text-[18px] leading-[1.35] text-[#8dc2ff] md:text-[22px]">
            {hero.intro}
          </Text>
          <Text className="text-[15px] leading-7 text-[#d8e5ff]/88 md:text-[17px]">
            {hero.declaration}
          </Text>
        </View>
      </View>
    </View>
  );
}
