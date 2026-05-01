/**
 * File: public-docs-section-card.tsx
 * Description: Renders a public document principle card.
 */
import { Text, View } from "react-native";

import type { PublicAnimationPresetName } from "@app/components/public/animation/public-animation-presets";
import type { CharterPrincipleCard } from "@app/public/content-types";

import PublicCardFrame from "./public-card-frame";
import { PUBLIC_SURFACE_CLASSES } from "./public-surface";

type PublicDocsSectionCardProps = {
  section: CharterPrincipleCard;
  animationEnabled?: boolean;
  animationPreset?: PublicAnimationPresetName;
};

export function PublicDocsSectionCard({
  section,
  animationEnabled,
  animationPreset,
}: PublicDocsSectionCardProps) {
  const isRightAnchored = section.anchor === "right";

  const titleWrapClassName = isRightAnchored ? "items-end" : "items-start";
  const titleClassName = isRightAnchored ? "text-right" : "text-left";
  const detailWrapClassName = isRightAnchored ? "items-start" : "items-end";
  const detailClassName = isRightAnchored ? "text-left" : "text-right";
  const eyebrowClassName = isRightAnchored ? "text-right" : "text-left";
  const hairlineClassName = isRightAnchored ? "self-end" : "self-start";

  return (
    <PublicCardFrame
      animationEnabled={animationEnabled}
      animationPreset={animationPreset}
      className="h-full px-7 py-7"
      contentClassName="flex-1"
      layoutClassName="min-w-[280px] flex-1 self-stretch"
      variant="decorated"
    >
      <View className="flex-1 justify-between gap-10">
        <View className={titleWrapClassName}>
          <View
            className={[
              "mb-5 w-full max-w-[92%] border-t",
              PUBLIC_SURFACE_CLASSES.border.ruleClassName,
              hairlineClassName,
            ].join(" ")}
          />
          <Text
            className={[
              "mb-3 font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]",
              PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
              eyebrowClassName,
            ].join(" ")}
          >
            Principle {section.principle}
          </Text>
          <Text
            className={[
              "max-w-[92%] font-[Inter_700Bold] text-[30px] leading-[34px]",
              PUBLIC_SURFACE_CLASSES.text.headingClassName,
              titleClassName,
            ].join(" ")}
          >
            {section.title}
          </Text>
        </View>

        <View className={detailWrapClassName}>
          <Text
            className={[
              "max-w-[92%] font-[Inter_500Medium] text-[16px] leading-[24px]",
              PUBLIC_SURFACE_CLASSES.text.bodyWarmClassName,
              detailClassName,
            ].join(" ")}
          >
            {section.body}
          </Text>
          <View
            className={[
              "mt-5 w-full max-w-[92%] border-t",
              PUBLIC_SURFACE_CLASSES.border.ruleClassName,
              hairlineClassName,
            ].join(" ")}
          />
        </View>
      </View>
    </PublicCardFrame>
  );
}

export default PublicDocsSectionCard;
