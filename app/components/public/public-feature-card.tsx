/**
 * File: public-feature-card.tsx
 * Description: Renders a reusable informational card for public page grids.
 */
import { Text } from 'react-native';

import type { PublicAnimationPresetName } from '@app/components/public/animation/public-animation-presets';
import PublicCardFrame from './public-card-frame';
import { PUBLIC_SURFACE_CLASSES } from './public-surface';

type PublicFeatureCardProps = {
  eyebrow: string;
  title: string;
  body: string;
  eyebrowClassName: string;
  animationEnabled?: boolean;
  animationPreset?: PublicAnimationPresetName;
};

/**
 * Inputs: card eyebrow, title, body copy, eyebrow tone class, and optional animation settings.
 * Output: a consistent content card used in docs/support feature grids.
 */
export default function PublicFeatureCard({
  eyebrow,
  title,
  body,
  eyebrowClassName,
  animationEnabled,
  animationPreset,
}: PublicFeatureCardProps) {
  return (
    <PublicCardFrame
      animationEnabled={animationEnabled}
      animationPreset={animationPreset}
      className="h-full p-6"
      layoutClassName="min-w-[260px] flex-1"
      variant="default"
    >
      <Text className={["text-xs font-bold uppercase tracking-[0.28em]", eyebrowClassName].join(' ')}>
        {eyebrow}
      </Text>
      <Text className={["mt-3 text-2xl font-bold", PUBLIC_SURFACE_CLASSES.text.headingClassName].join(' ')}>
        {title}
      </Text>
      <Text className={["mt-3 text-base leading-7", PUBLIC_SURFACE_CLASSES.text.mutedClassName].join(' ')}>
        {body}
      </Text>
    </PublicCardFrame>
  );
}
