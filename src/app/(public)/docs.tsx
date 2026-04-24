import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { PublicDocsHero } from '@/app/components/public/public-docs-hero';
import { PublicDocsSectionGrid } from '@/app/components/public/public-docs-section-grid';
import { PublicPageActions } from '@/app/components/public/public-page-actions';
import { PublicPanelShell } from '@/app/components/public/public-panel-shell';
import { DEFAULT_PUBLIC_DOCUMENT } from '@/app/public/docs-content';

export default function DocsScreen() {
  const document = DEFAULT_PUBLIC_DOCUMENT;

  return (
    <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
      <PublicDocsHero hero={document.hero} />
      <PublicDocsSectionGrid sections={document.sections} />

      <PublicPanelShell className="px-6 py-7 sm:px-7 sm:py-8">
        <View className="gap-4">
          <Text className="font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px] text-[#89afe0]">
            {document.closing.title}
          </Text>
          {document.closing.body.map((paragraph) => (
            <Text
              key={paragraph}
              className="font-[Inter_400Regular] text-[18px] leading-[30px] text-[#d8e7f4]"
            >
              {paragraph}
            </Text>
          ))}
        </View>
      </PublicPanelShell>

      {!!document.resources?.length && (
        <PublicPanelShell className="px-6 py-7 sm:px-7 sm:py-8">
          <View className="gap-5 lg:flex-row lg:items-end lg:justify-between">
            <View className="gap-2">
              <Text className="font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px] text-[#89afe0]">
                Document Library
              </Text>
              <Text className="font-[Inter_700Bold] text-[28px] leading-[34px] text-[#b8d7ff]">
                Downloads and alternate formats
              </Text>
              <Text className="max-w-[760px] font-[Inter_400Regular] text-[16px] leading-[26px] text-[#d8e7f4]">
                Placeholder for hosted PDFs, print-friendly exports, and future document routes.
              </Text>
            </View>
            <PublicPageActions
              actions={document.resources.map((resource) => ({
                label: resource.title,
                href: resource.href,
                variant: 'outline',
                disabled: resource.disabled,
              }))}
              className="lg:justify-end"
            />
          </View>
        </PublicPanelShell>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 96,
    gap: 24,
  },
});
