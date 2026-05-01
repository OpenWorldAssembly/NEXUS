/**
 * File: public-feature-card.tsx
 * Description: Renders a reusable informational card for public page grids.
 */
import { Text } from 'react-native';

import type { PublicAnimationPresetName } from '@app/components/public/animation/public-animation-presets';
import PublicAnimatedSurface from './public-animated-surface';
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
  animationEnabled = false,
  animationPreset = 'none',
}: PublicFeatureCardProps) {
  return (
    <PublicAnimatedSurface
      animationEnabled={animationEnabled}
      animationPreset={animationPreset}
      layoutClassName="min-w-[260px] flex-1"
      baseClassName={[PUBLIC_SURFACE_CLASSES.standardCardBaseClassName, 'p-6'].join(' ')}
      className="h-full"
    >
      <Text className={["text-xs font-bold uppercase tracking-[0.28em]", eyebrowClassName].join(' ')}>
        {eyebrow}
      </Text>
      <Text className="mt-3 text-2xl font-bold text-public-text">{title}</Text>
      <Text className="mt-3 text-base leading-7 text-public-muted">{body}</Text>
    </PublicAnimatedSurface>
  );
}
