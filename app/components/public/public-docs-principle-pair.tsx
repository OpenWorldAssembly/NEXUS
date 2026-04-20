/**
 * File: app/components/public/public-docs-principle-pair.tsx
 * Description: Paired principle section for the public charter page.
 */
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { CharterPairSection, CharterPrinciple } from '@app/public/docs-content';

type PublicDocsPrinciplePairProps = {
  section: CharterPairSection;
};

type PrincipleBlockProps = {
  principle: CharterPrinciple;
};

function PrincipleBlock({ principle }: PrincipleBlockProps) {
  return (
    <View className="max-w-[430px] gap-3 md:gap-4">
      <Text className="font-public-display text-[18px] uppercase tracking-[0.28em] text-[#d4f79a] md:text-[20px]">
        {principle.numeral}
      </Text>
      <Text className="font-public-display text-[28px] uppercase leading-[0.98] tracking-[-0.03em] text-[#8dc2ff] md:text-[42px]">
        {principle.title}
      </Text>
      <Text className="text-[15px] leading-7 text-[#e7efff]/90 md:text-[17px]">
        {principle.body}
      </Text>
    </View>
  );
}

/**
 * Inputs: paired charter principles and their shared background artwork.
 * Output: a responsive two-column charter section.
 */
export function PublicDocsPrinciplePair({ section }: PublicDocsPrinciplePairProps) {
  return (
    <View className="relative overflow-hidden rounded-[28px] border border-public-line/45 bg-public-panel/65 px-7 py-8 md:min-h-[420px] md:px-10 md:py-10">
      <Image
        source={{ uri: section.backgroundImageUri }}
        contentFit="cover"
        transition={150}
        className="absolute inset-0 opacity-72"
      />
      <View className="absolute inset-0 bg-[#031121]/80" />

      <View className="relative flex flex-col gap-10 md:flex-row md:items-start md:justify-between md:gap-12">
        <View className="md:flex-1">
          <PrincipleBlock principle={section.left} />
        </View>

        <View className="h-px bg-public-line/35 md:hidden" />
        <View className="hidden self-stretch md:block md:w-px md:bg-public-line/35" />

        <View className="md:flex md:flex-1 md:justify-end">
          <PrincipleBlock principle={section.right} />
        </View>
      </View>
    </View>
  );
}
