/**
 * File: public-feature-card.tsx
 * Description: Renders a reusable informational card for public page grids.
 */
import { Text, View } from 'react-native';

type PublicFeatureCardProps = {
  eyebrow: string;
  title: string;
  body: string;
  eyebrowClassName: string;
};

/**
 * Inputs: card eyebrow, title, body copy, and eyebrow tone class.
 * Output: a consistent content card used in docs/support feature grids.
 */
export default function PublicFeatureCard({
  eyebrow,
  title,
  body,
  eyebrowClassName,
}: PublicFeatureCardProps) {
  return (
    <View className="min-w-[260px] flex-1 rounded-[1.75rem] border border-public-line/70 bg-public-panel/55 p-6">
      <Text className={["text-xs font-bold uppercase tracking-[0.28em]", eyebrowClassName].join(' ')}>
        {eyebrow}
      </Text>
      <Text className="mt-3 text-2xl font-bold text-public-text">{title}</Text>
      <Text className="mt-3 text-base leading-7 text-public-muted">{body}</Text>
    </View>
  );
}
