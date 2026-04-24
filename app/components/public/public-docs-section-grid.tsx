import { Platform, View } from "react-native";

import type { CharterPrincipleCard } from "@/app/public/content-types";
import { PublicDocsSectionCard } from "@/app/components/public/public-docs-section-card";

type PublicDocsSectionGridProps = {
  sections: CharterPrincipleCard[];
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

export function PublicDocsSectionGrid({ sections }: PublicDocsSectionGridProps) {
  return (
    <View className="w-full flex-row flex-wrap items-stretch gap-7" style={WEB_GRID_STYLE as never}>
      {sections.map((section) => (
        <PublicDocsSectionCard key={section.principle} section={section} />
      ))}
    </View>
  );
}

export default PublicDocsSectionGrid;
