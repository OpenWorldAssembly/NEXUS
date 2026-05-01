/**
 * File: public-docs-resource-grid.tsx
 * Description: Renders public document resource actions and download placeholders.
 */
import { Text, View } from "react-native";

import { PublicPageActions } from "@app/components/public/public-page-actions";
import { PublicPanelShell } from "@app/components/public/public-panel-shell";
import { PUBLIC_SURFACE_CLASSES } from "@app/components/public/public-surface";
import type { PublicDocumentEntry } from "@app/public/content-types";

type PublicDocsResourceGridProps = {
  resources: PublicDocumentEntry["resources"];
};

export function PublicDocsResourceGrid({ resources }: PublicDocsResourceGridProps) {
  if (!resources?.length) {
    return null;
  }

  return (
    <PublicPanelShell className="px-6 py-7 sm:px-7 sm:py-8">
      <View className="gap-5 lg:flex-row lg:items-end lg:justify-between">
        <View className="gap-2">
          <Text
            className={[
              "font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]",
              PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
            ].join(" ")}
          >
            Document Library
          </Text>
          <Text
            className={[
              "font-[Inter_700Bold] text-[28px] leading-[34px]",
              PUBLIC_SURFACE_CLASSES.text.headingClassName,
            ].join(" ")}
          >
            Downloads and alternate formats
          </Text>
          <Text
            className={[
              "max-w-[760px] font-[Inter_400Regular] text-[16px] leading-[26px]",
              PUBLIC_SURFACE_CLASSES.text.bodyClassName,
            ].join(" ")}
          >
            Placeholder for hosted PDFs, print-friendly exports, and future document routes.
          </Text>
        </View>
        <PublicPageActions
          actions={resources.map((resource) => ({
            label: resource.title,
            href: resource.href,
            variant: "outline",
            disabled: resource.disabled,
          }))}
          className="lg:justify-end"
        />
      </View>
    </PublicPanelShell>
  );
}

export default PublicDocsResourceGrid;
