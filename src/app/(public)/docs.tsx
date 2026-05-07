/**
 * File: docs.tsx
 * Description: Composes the public docs directory and readable document page.
 */
import { StyleSheet } from 'react-native';

import { PublicDocsDirectory } from '@app/components/public/public-docs-directory';
import { PublicDocsHero } from '@app/components/public/public-docs-hero';
import { PublicDocsResourceGrid } from '@app/components/public/public-docs-resource-grid';
import { PublicDocumentReader } from '@app/components/public/public-document-reader';
import PublicPageShell from '@app/components/public/public-page-shell';
import { docsPageContent } from '@app/public/docs-content';
import { PUBLIC_READABLE_DOCUMENTS } from '@app/public/generated/public-docs.generated';

export default function DocsScreen() {
  const featuredDocument = PUBLIC_READABLE_DOCUMENTS[docsPageContent.featuredDocumentSlug];

  return (
    <PublicPageShell
      constrainWidth={false}
      contentContainerClassName=""
      contentContainerStyle={styles.scrollContent}
      enablePositionAnimation
      showsVerticalScrollIndicator={false}
    >
      <PublicDocsHero hero={docsPageContent.hero} />
      <PublicDocsDirectory documents={docsPageContent.directory} />
      <PublicDocumentReader document={featuredDocument} />
      <PublicDocsResourceGrid resources={docsPageContent.resources} />
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
