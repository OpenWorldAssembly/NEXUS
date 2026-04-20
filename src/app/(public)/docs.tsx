/**
 * File: (public)/docs.tsx
 * Description: Public charter page rendered with the live Open World Assembly charter.
 */
import { View } from 'react-native';
import Animated from 'react-native-reanimated';
import { PublicDocsClosing } from '@app/components/public/public-docs-closing';
import { PublicDocsHero } from '@app/components/public/public-docs-hero';
import { PublicDocsPrinciplePair } from '@app/components/public/public-docs-principle-pair';
import { CHARTER_CLOSING, CHARTER_HERO, CHARTER_SECTIONS } from '@app/public/docs-content';

/**
 * Inputs: none.
 * Output: public charter page with a hero, principle sections, and closing declaration.
 */
const AnimatedScrollView = Animated.ScrollView;

export default function DocsScreen() {
  return (
    <AnimatedScrollView
      className="flex-1 bg-[#040b1c]"
      contentContainerClassName="px-6 pb-24 pt-10 md:px-10 md:pt-12">
      <View className="mx-auto w-full max-w-[1280px] gap-7 md:gap-8">
        <PublicDocsHero hero={CHARTER_HERO} />

        {CHARTER_SECTIONS.map((section) => (
          <PublicDocsPrinciplePair key={section.id} section={section} />
        ))}

        <PublicDocsClosing closing={CHARTER_CLOSING} />
      </View>
    </AnimatedScrollView>
  );
}
