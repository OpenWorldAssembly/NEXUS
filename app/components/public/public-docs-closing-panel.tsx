/**
 * File: public-docs-closing-panel.tsx
 * Description: Renders the closing panel for public document pages.
 */
import { Text, View } from "react-native";

import { PublicPanelShell } from "@app/components/public/public-panel-shell";
import { PUBLIC_SURFACE_CLASSES } from "@app/components/public/public-surface";
import type { PublicDocumentEntry } from "@app/public/content-types";

type PublicDocsClosingPanelProps = {
  closing: PublicDocumentEntry["closing"];
};

export function PublicDocsClosingPanel({ closing }: PublicDocsClosingPanelProps) {
  return (
    <PublicPanelShell className="px-6 py-7 sm:px-7 sm:py-8">
      <View className="gap-4">
        <Text
          className={[
            "font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]",
            PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
          ].join(" ")}
        >
          {closing.title}
        </Text>
        {closing.body.map((paragraph) => (
          <Text
            key={paragraph}
            className={[
              "font-[Inter_400Regular] text-[18px] leading-[30px]",
              PUBLIC_SURFACE_CLASSES.text.bodyClassName,
            ].join(" ")}
          >
            {paragraph}
          </Text>
        ))}
      </View>
    </PublicPanelShell>
  );
}

export default PublicDocsClosingPanel;
