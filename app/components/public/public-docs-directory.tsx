/**
 * File: public-docs-directory.tsx
 * Description: Renders the public document directory on the Docs page.
 */
import { Platform, Pressable, Text, View } from 'react-native';

import PublicCardFrame from '@app/components/public/public-card-frame';
import { PublicPageActions } from '@app/components/public/public-page-actions';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';
import type { PublicDocumentDirectoryItem } from '@app/public/content-types';

type PublicDocsDirectoryProps = {
  documents: PublicDocumentDirectoryItem[];
  selectedDocumentSlug?: string;
  onSelectDocument?: (documentSlug: string) => void;
};

const WEB_GRID_STYLE =
  Platform.OS === 'web'
    ? ({
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 18,
        alignItems: 'stretch',
      } as const)
    : undefined;

const STATUS_LABELS: Record<PublicDocumentDirectoryItem['status'], string> = {
  available: 'Available',
  draft: 'Draft',
  planned: 'Planned',
};

function getReadButtonLabel({
  document,
  selectedDocumentSlug,
}: {
  document: PublicDocumentDirectoryItem;
  selectedDocumentSlug?: string;
}) {
  if (!document.readableDocumentSlug) {
    return 'Reader Soon';
  }

  return selectedDocumentSlug === document.readableDocumentSlug ? 'Reading Below' : 'Read Below';
}

export function PublicDocsDirectory({
  documents,
  selectedDocumentSlug,
  onSelectDocument,
}: PublicDocsDirectoryProps) {
  return (
    <View className="gap-5">
      <View className="gap-2 px-2 sm:px-3">
        <Text
          className={[
            'font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]',
            PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
          ].join(' ')}
        >
          Directory
        </Text>
        <Text
          className={[
            'font-[Inter_700Bold] text-[30px] leading-[36px]',
            PUBLIC_SURFACE_CLASSES.text.headingClassName,
          ].join(' ')}
        >
          Public document shelf
        </Text>
        <Text
          className={[
            'max-w-[820px] font-[Inter_400Regular] text-[16px] leading-[26px]',
            PUBLIC_SURFACE_CLASSES.text.bodyClassName,
          ].join(' ')}
        >
          These documents describe the public principles, technical direction, and near-term
          development path for Open World Assembly and Nexus.
        </Text>
      </View>

      <View className="w-full flex-row flex-wrap gap-[18px]" style={WEB_GRID_STYLE as never}>
        {documents.map((document) => {
          const canRead = !!document.readableDocumentSlug && !!onSelectDocument;
          const isSelected = selectedDocumentSlug === document.readableDocumentSlug;
          const readButtonRootClassName = isSelected
            ? PUBLIC_SURFACE_CLASSES.action.solidRootClassName
            : PUBLIC_SURFACE_CLASSES.action.outlineRootClassName;
          const readButtonTextClassName = isSelected
            ? PUBLIC_SURFACE_CLASSES.action.solidTextClassName
            : PUBLIC_SURFACE_CLASSES.action.outlineTextClassName;

          return (
            <PublicCardFrame
              key={document.slug}
              className="h-full min-w-[280px] flex-1 px-6 py-6"
              contentClassName="flex-1"
              layoutClassName="min-w-[280px] flex-1 self-stretch"
              variant="default"
            >
              <View className="flex-1 justify-between gap-8">
                <View className="gap-4">
                  <View className="flex-row flex-wrap gap-2">
                    <View className="rounded-full border border-public-surfaceRule bg-public-surfaceBase/70 px-3 py-1">
                      <Text
                        className={[
                          'font-[Orbitron_700Bold] text-[9px] uppercase tracking-[2px]',
                          PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
                        ].join(' ')}
                      >
                        {document.typeLabel}
                      </Text>
                    </View>
                    <View className="rounded-full border border-public-surfaceRule bg-public-surfaceBase/50 px-3 py-1">
                      <Text
                        className={[
                          'font-[Inter_700Bold] text-[10px] uppercase tracking-[1.8px]',
                          PUBLIC_SURFACE_CLASSES.text.mutedClassName,
                        ].join(' ')}
                      >
                        {STATUS_LABELS[document.status]}
                      </Text>
                    </View>
                  </View>

                  <Text
                    className={[
                      'font-[Inter_700Bold] text-[24px] leading-[30px]',
                      PUBLIC_SURFACE_CLASSES.text.headingClassName,
                    ].join(' ')}
                  >
                    {document.title}
                  </Text>
                  <Text
                    className={[
                      'font-[Inter_400Regular] text-[15px] leading-[25px]',
                      PUBLIC_SURFACE_CLASSES.text.bodyClassName,
                    ].join(' ')}
                  >
                    {document.summary}
                  </Text>
                </View>

                <View className="flex-row flex-wrap gap-3">
                  <Pressable
                    className={readButtonRootClassName}
                    disabled={!canRead}
                    onPress={() => {
                      if (document.readableDocumentSlug) {
                        onSelectDocument?.(document.readableDocumentSlug);
                      }
                    }}
                  >
                    <Text
                      className={`${readButtonTextClassName} ${canRead ? '' : 'opacity-50'}`.trim()}
                    >
                      {getReadButtonLabel({ document, selectedDocumentSlug })}
                    </Text>
                  </Pressable>

                  {!!document.actions?.length && (
                    <PublicPageActions actions={document.actions} className="mt-0" />
                  )}
                </View>
              </View>
            </PublicCardFrame>
          );
        })}
      </View>
    </View>
  );
}

export default PublicDocsDirectory;
