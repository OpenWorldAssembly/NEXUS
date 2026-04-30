/**
 * File: public-page-hero.tsx
 * Description: Renders a reusable hero panel for public-site destination pages.
 */
import { Text, View } from 'react-native';

import PublicSurface from './public-surface';

type PublicPageHeroProps = {
  eyebrow: string;
  title: string;
  body: string;
  calloutEyebrow: string;
  calloutBody: string;
  eyebrowClassName: string;
  calloutEyebrowClassName: string;
  glowPrimaryClassName: string;
  glowSecondaryClassName: string;
};

/**
 * Inputs: text content and lightweight styling hooks for accent color and background glow treatment.
 * Output: a consistent hero panel used by public informational routes.
 */
export default function PublicPageHero({
  eyebrow,
  title,
  body,
  calloutEyebrow,
  calloutBody,
  eyebrowClassName,
  calloutEyebrowClassName,
  glowPrimaryClassName,
  glowSecondaryClassName,
}: PublicPageHeroProps) {
  return (
    <PublicSurface
      baseClassName="overflow-hidden rounded-[2rem] border border-public-line/70 bg-public-shell/70 px-6 py-10 shadow-public md:px-10"
      background={
        <>
          <View className={["absolute -right-10 top-0 h-44 w-44 rounded-full blur-3xl", glowPrimaryClassName].join(' ')} />
          <View className={["absolute left-8 top-16 h-40 w-40 rounded-full blur-3xl", glowSecondaryClassName].join(' ')} />
        </>
      }
    >
      <Text className={["text-sm font-bold uppercase tracking-[0.35em]", eyebrowClassName].join(' ')}>
        {eyebrow}
      </Text>
      <Text className="mt-4 max-w-4xl text-4xl font-black leading-tight text-public-text md:text-6xl">
        {title}
      </Text>
      <Text className="mt-5 max-w-3xl text-lg leading-8 text-public-muted">{body}</Text>

      <View className="mt-8 rounded-[1.75rem] border border-public-line/70 bg-public-panel/60 p-6">
        <Text className={["text-xs font-bold uppercase tracking-[0.28em]", calloutEyebrowClassName].join(' ')}>
          {calloutEyebrow}
        </Text>
        <Text className="mt-3 text-base leading-7 text-public-muted md:text-lg">{calloutBody}</Text>
      </View>
    </PublicSurface>
  );
}
