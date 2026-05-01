/**
 * File: docs.tsx
 * Description: Composes the public document page for the OWA charter.
 */
import { StyleSheet } from 'react-native';

import { PublicDocsClosingPanel } from '@app/components/public/public-docs-closing-panel';
import { PublicDocsHero } from '@app/components/public/public-docs-hero';
import { PublicDocsResourceGrid } from '@app/components/public/public-docs-resource-grid';
import { PublicDocsSectionGrid } from '@app/components/public/public-docs-section-grid';
import PublicPageShell from '@app/components/public/public-page-shell';
import { DEFAULT_PUBLIC_DOCUMENT } from '@app/public/docs-content';

export default function DocsScreen() {
  const document = DEFAULT_PUBLIC_DOCUMENT;

  return (
    <PublicPageShell
      constrainWidth={false}
      contentContainerClassName=""
      contentContainerStyle={styles.scrollContent}
      enablePositionAnimation
      showsVerticalScrollIndicator={false}
    >
      <PublicDocsHero hero={document.hero} />
      <PublicDocsSectionGrid sections={document.sections} />
      <PublicDocsClosingPanel closing={document.closing} />
      <PublicDocsResourceGrid resources={document.resources} />
    </PublicPageShell>
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
