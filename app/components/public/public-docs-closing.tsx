/**
 * File: app/components/public/public-docs-closing.tsx
 * Description: Closing section for the public charter page.
 */
import { Link } from 'expo-router';
import { Image } from 'expo-image';
import { Text, View } from 'react-native';

import type { CharterClosing, CharterCta } from '@app/public/docs-content';

type PublicDocsClosingProps = {
  closing: CharterClosing;
};

function ClosingButton({ cta }: { cta: CharterCta }) {
  const isHighlight = cta.variant === 'highlight';

  return (
    <Link
      href={cta.href}
      className={[
        'inline-flex rounded-full border px-5 py-3 font-public-display text-[12px] uppercase tracking-[0.24em]',
        isHighlight
          ? 'border-[#a5f05c] bg-[#a5f05c] text-[#061222]'
          : 'border-public-line/65 bg-public-panel/70 text-[#f5f8ff]',
      ].join(' ')}>
      {cta.label}
    </Link>
  );
}

/**
 * Inputs: closing charter text and navigation calls to action.
 * Output: final charter section styled to match the rest of the page.
 */
export function PublicDocsClosing({ closing }: PublicDocsClosingProps) {
  return (
    <View className="relative overflow-hidden rounded-[28px] border border-public-line/45 bg-public-panel/65 px-7 py-8 md:px-10 md:py-12">
      <Image
        source={{ uri: closing.backgroundImageUri }}
        contentFit="cover"
        transition={150}
        className="absolute inset-0 opacity-72"
      />
      <View className="absolute inset-0 bg-[#041225]/82" />

      <View className="relative items-start gap-6 md:gap-8">
        <Text className="font-public-display text-[16px] uppercase tracking-[0.32em] text-[#d4f79a] md:text-[18px]">
          {closing.title}
        </Text>

        <View className="max-w-[920px] gap-4">
          {closing.lines.map((line) => (
            <Text
              key={line}
              className="text-[20px] leading-[1.35] text-[#f5f8ff] md:text-[28px]">
              {line}
            </Text>
          ))}
        </View>

        <View className="flex flex-row flex-wrap gap-3 pt-2">
          {closing.ctas.map((cta) => (
            <ClosingButton key={cta.label} cta={cta} />
          ))}
        </View>
      </View>
    </View>
  );
}
