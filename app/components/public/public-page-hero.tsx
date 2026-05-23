/**
 * File: public-page-hero.tsx
 * Description: Renders a reusable hero panel for public-site destination pages.
 */
import { Text } from 'react-native';

import PublicCardFrame from './public-card-frame';
import { PublicPanelShell } from './public-panel-shell';
import { PUBLIC_SURFACE_CLASSES } from './public-surface';

type PublicPageHeroProps = {
  eyebrow: string;
  title: string;
  body: string;
  calloutEyebrow: string;
  calloutBody: string;
  eyebrowClassName: string;
  calloutEyebrowClassName: string;
};

/**
 * Inputs: text content and lightweight styling hooks for accent color.
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
}: PublicPageHeroProps) {
  return (
    <PublicPanelShell className="px-6 py-10 definition-public md:px-10">
      <Text className={["text-sm font-bold uppercase tracking-[0.35em]", eyebrowClassName].join(' ')}>
        {eyebrow}
      </Text>
      <Text
        className={[
          "mt-4 max-w-4xl text-4xl font-black leading-tight md:text-6xl",
          PUBLIC_SURFACE_CLASSES.text.headingClassName,
        ].join(' ')}
      >
        {title}
      </Text>
      <Text className={["mt-5 max-w-3xl text-lg leading-8", PUBLIC_SURFACE_CLASSES.text.mutedClassName].join(' ')}>
        {body}
      </Text>

      <PublicCardFrame animationEnabled={false} variant="default" className="mt-8 p-6">
        <Text className={["text-xs font-bold uppercase tracking-[0.28em]", calloutEyebrowClassName].join(' ')}>
          {calloutEyebrow}
        </Text>
        <Text className={["mt-3 text-base leading-7 md:text-lg", PUBLIC_SURFACE_CLASSES.text.mutedClassName].join(' ')}>
          {calloutBody}
        </Text>
      </PublicCardFrame>
    </PublicPanelShell>
  );
}
