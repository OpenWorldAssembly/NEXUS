/**
 * File: docs.tsx
 * Description: Public docs route with a directory shelf and readable document panel.
 */
import { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, View, type LayoutChangeEvent } from 'react-native';

import PublicDocumentReader from '@app/components/public/public-document-reader';
import PublicDocsDirectory from '@app/components/public/public-docs-directory';
import PublicDocsHero from '@app/components/public/public-docs-hero';
import PublicDocsResourceGrid from '@app/components/public/public-docs-resource-grid';
import PublicPageShell from '@app/components/public/public-page-shell';
import { PUBLIC_READABLE_DOCUMENTS } from '@app/public/generated/public-docs.generated';
import { DEFAULT_PUBLIC_DOCUMENT_SLUG, docsPageContent } from '@app/public/docs-content';

const DOCUMENT_SCROLL_OFFSET = 20;
type PublicReadableDocumentSlug = keyof typeof PUBLIC_READABLE_DOCUMENTS;
const FALLBACK_PUBLIC_DOCUMENT_SLUG =
  DEFAULT_PUBLIC_DOCUMENT_SLUG as PublicReadableDocumentSlug;

function isPublicReadableDocumentSlug(
  slug: string
): slug is PublicReadableDocumentSlug {
  return slug in PUBLIC_READABLE_DOCUMENTS;
}

export default function PublicDocsPage() {
  const scrollViewRef = useRef<ScrollView | null>(null);
  const sectionOffsetsRef = useRef<Record<string, number>>({});
  const [selectedDocumentSlug, setSelectedDocumentSlug] =
    useState<PublicReadableDocumentSlug>(FALLBACK_PUBLIC_DOCUMENT_SLUG);
  const [readerOffsetY, setReaderOffsetY] = useState(0);
  const [sectionsOffsetY, setSectionsOffsetY] = useState(0);

  const selectedDocument = useMemo(
    () =>
      PUBLIC_READABLE_DOCUMENTS[selectedDocumentSlug] ??
      PUBLIC_READABLE_DOCUMENTS[FALLBACK_PUBLIC_DOCUMENT_SLUG],
    [selectedDocumentSlug],
  );

  const scrollToContentOffset = useCallback((offsetY: number) => {
    const scrollAction = () => {
      scrollViewRef.current?.scrollTo({
        y: Math.max(offsetY - DOCUMENT_SCROLL_OFFSET, 0),
        animated: true,
      });
    };

    if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(scrollAction);
      return;
    }

    setTimeout(scrollAction, 0);
  }, []);

  const handleSelectDocument = useCallback(
    (documentSlug: string) => {
      sectionOffsetsRef.current = {};
      setSelectedDocumentSlug(
        isPublicReadableDocumentSlug(documentSlug)
          ? documentSlug
          : FALLBACK_PUBLIC_DOCUMENT_SLUG
      );
      scrollToContentOffset(readerOffsetY);
    },
    [readerOffsetY, scrollToContentOffset],
  );

  const handleReaderLayout = useCallback((event: LayoutChangeEvent) => {
    setReaderOffsetY(event.nativeEvent.layout.y);
  }, []);

  const handleSectionsLayout = useCallback((offsetY: number) => {
    setSectionsOffsetY(offsetY);
  }, []);

  const handleSectionLayout = useCallback((sectionId: string, offsetY: number) => {
    sectionOffsetsRef.current[sectionId] = offsetY;
  }, []);

  const handleSelectSection = useCallback(
    (sectionId: string) => {
      const sectionOffset = sectionOffsetsRef.current[sectionId] ?? 0;
      scrollToContentOffset(readerOffsetY + sectionsOffsetY + sectionOffset);
    },
    [readerOffsetY, scrollToContentOffset, sectionsOffsetY],
  );

  return (
    <View className="min-h-screen flex-1">
      <PublicPageShell
        contentContainerClassName="gap-6 px-5 pb-40 pt-8 lg:px-8 lg:pb-52"
        constrainWidth={false}
        enablePositionAnimation
        scrollViewRef={scrollViewRef}
      >
        <PublicDocsHero hero={docsPageContent.hero} />
        <PublicDocsDirectory
          documents={docsPageContent.directory}
          selectedDocumentSlug={selectedDocument.slug}
          onSelectDocument={handleSelectDocument}
        />
        <View onLayout={handleReaderLayout}>
          <PublicDocumentReader
            document={selectedDocument}
            onSectionsLayout={handleSectionsLayout}
            onSectionLayout={handleSectionLayout}
            onSelectSection={handleSelectSection}
          />
        </View>
        <PublicDocsResourceGrid resources={docsPageContent.resources} />
      </PublicPageShell>
    </View>
  );
}
