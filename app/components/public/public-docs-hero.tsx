/**
 * File: public-docs-hero.tsx
 * Description: Renders the hero panel for public document pages.
 */
import { Text, View } from "react-native";

import type { PublicDocumentHero } from "@app/public/content-types";
import { PublicPageActions } from "@app/components/public/public-page-actions";
import { PublicPanelShell } from "@app/components/public/public-panel-shell";
import { PUBLIC_SURFACE_CLASSES } from "@app/components/public/public-surface";

type PublicDocsHeroProps = {
  hero: PublicDocumentHero;
};

export function PublicDocsHero({ hero }: PublicDocsHeroProps) {
  return (
    <PublicPanelShell className="px-6 py-7 sm:px-7 sm:py-8 lg:px-8 lg:py-9">
      <View className="w-full flex-col gap-8 lg:flex-row lg:items-start lg:justify-between lg:gap-10">
        <View className="min-w-0 flex-1 gap-4 lg:max-w-[56%]">
          <Text
            className={[
              "font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]",
              PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
            ].join(" ")}
          >
            {hero.eyebrow}
          </Text>
          <Text
            className={[
              "font-[Inter_700Bold] text-[38px] leading-[44px] sm:text-[44px] sm:leading-[50px]",
              PUBLIC_SURFACE_CLASSES.text.headingClassName,
            ].join(" ")}
          >
            {hero.title}
          </Text>
          {hero.summary.length ? (
            <View className="gap-3">
              {hero.summary.map((paragraph) => (
                <Text
                  key={paragraph}
                  className={[
                    "max-w-[760px] font-[Inter_400Regular] text-[18px] leading-[30px]",
                    PUBLIC_SURFACE_CLASSES.text.bodyClassName,
                  ].join(" ")}
                >
                  {paragraph}
                </Text>
              ))}
            </View>
          ) : null}
        </View>

        <View className="w-full gap-5 lg:max-w-[420px] lg:items-end">
          {!!hero.noteTitle && (
            <View className="w-full gap-2 lg:max-w-[400px]">
              <Text
                className={[
                  "font-[Inter_600SemiBold] text-[20px] leading-[28px] lg:text-right",
                  PUBLIC_SURFACE_CLASSES.text.bodyWarmClassName,
                ].join(" ")}
              >
                {hero.noteTitle}
              </Text>
              {!!hero.noteBody && (
                <Text
                  className={[
                    "font-[Inter_400Regular] text-[15px] leading-[24px] lg:text-right",
                    PUBLIC_SURFACE_CLASSES.text.mutedClassName,
                  ].join(" ")}
                >
                  {hero.noteBody}
                </Text>
              )}
            </View>
          )}

          <PublicPageActions actions={hero.actions} className="mt-0 lg:justify-end" />
        </View>
      </View>
    </PublicPanelShell>
  );
}

export default PublicDocsHero;
