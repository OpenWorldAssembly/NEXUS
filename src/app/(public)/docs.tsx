/**
 * File: docs.tsx
 * Description: Public docs route with a directory shelf and readable document panel.
 */
import { useMemo, useState } from 'react';
import { StyleSheet } from 'react-native';

import PublicDocumentReader from '@app/components/public/public-document-reader';
import PublicDocsDirectory from '@app/components/public/public-docs-directory';
import PublicDocsHero from '@app/components/public/public-docs-hero';
import PublicDocsResourceGrid from '@app/components/public/public-docs-resource-grid';
import PublicPageShell from '@app/components/public/public-page-shell';
import { DEFAULT_PUBLIC_DOCUMENT_SLUG, docsPageContent } from '@app/public/docs-content';
import { PUBLIC_READABLE_DOCUMENTS } from '@app/public/generated/public-docs.generated';

/**
 * Inputs: none.
 * Output: the public docs page with a selectable directory and generated readable document panel.
 */
export default function PublicDocsPage() {
  const [selectedDocumentSlug, setSelectedDocumentSlug] = useState(DEFAULT_PUBLIC_DOCUMENT_SLUG);

  const selectedDocument = useMemo(
    () =>
      PUBLIC_READABLE_DOCUMENTS[selectedDocumentSlug] ??
      PUBLIC_READABLE_DOCUMENTS[DEFAULT_PUBLIC_DOCUMENT_SLUG],
    [selectedDocumentSlug],
  );

  return (
    <PublicPageShell
      constrainWidth={false}
      contentContainerClassName=""
      contentContainerStyle={styles.scrollContent}
      enablePositionAnimation
      showsVerticalScrollIndicator={false}
    >
      <PublicDocsHero hero={docsPageContent.hero} />
      <PublicDocsDirectory
        documents={docsPageContent.directory}
        selectedDocumentSlug={selectedDocument.slug}
        onSelectDocument={setSelectedDocumentSlug}
      />
      <PublicDocumentReader document={selectedDocument} />
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
