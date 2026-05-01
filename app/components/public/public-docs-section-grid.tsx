/**
 * File: public-docs-section-grid.tsx
 * Description: Renders the adaptive public document section grid.
 */
import { useCallback, useState } from "react";
import { Platform, type LayoutChangeEvent, View } from "react-native";

import type { PublicAnimationPresetName } from "@app/components/public/animation/public-animation-presets";
import {
  PublicLayoutOffsetProvider,
  usePublicLayoutOffset,
} from "@app/components/public/animation/public-scroll-context";
import { PublicDocsSectionCard } from "@app/components/public/public-docs-section-card";
import type { CharterPrincipleCard } from "@app/public/content-types";

type PublicDocsSectionGridProps = {
  sections: CharterPrincipleCard[];
  animationEnabled?: boolean;
  animationPreset?: PublicAnimationPresetName;
};

const WEB_GRID_STYLE =
  Platform.OS === "web"
    ? ({
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
        gap: 28,
        alignItems: "stretch",
      } as const)
    : undefined;

export function PublicDocsSectionGrid({
  sections,
  animationEnabled,
  animationPreset,
}: PublicDocsSectionGridProps) {
  const parentOffsetY = usePublicLayoutOffset();
  const [layoutOffsetY, setLayoutOffsetY] = useState(parentOffsetY);

  const handleLayout = useCallback(
    (event: LayoutChangeEvent) => {
      setLayoutOffsetY(parentOffsetY + event.nativeEvent.layout.y);
    },
    [parentOffsetY],
  );

  return (
    <PublicLayoutOffsetProvider offsetY={layoutOffsetY}>
      <View
        className="w-full flex-row flex-wrap items-stretch gap-7"
        onLayout={handleLayout}
        style={WEB_GRID_STYLE as never}
      >
        {sections.map((section) => (
          <PublicDocsSectionCard
            key={section.principle}
            animationEnabled={animationEnabled}
            animationPreset={animationPreset}
            section={section}
          />
        ))}
      </View>
    </PublicLayoutOffsetProvider>
  );
}

export default PublicDocsSectionGrid;
