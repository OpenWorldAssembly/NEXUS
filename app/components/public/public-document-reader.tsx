/**
 * File: public-document-reader.tsx
 * Description: Renders a readable public document panel without splitting the text into a card grid.
 */
import { Text, View } from 'react-native';

import PublicCardFrame from '@app/components/public/public-card-frame';
import { PUBLIC_SURFACE_CLASSES } from '@app/components/public/public-surface';
import type { PublicReadableDocument } from '@app/public/content-types';

type PublicDocumentReaderProps = {
  document: PublicReadableDocument;
};

type PublicDocumentParagraphProps = {
  paragraph: string;
};

function PublicDocumentParagraph({ paragraph }: PublicDocumentParagraphProps) {
  if (paragraph.startsWith('### ')) {
    return (
      <Text
        className={[
          'pt-3 font-[Inter_700Bold] text-[18px] leading-[26px]',
          PUBLIC_SURFACE_CLASSES.text.headingClassName,
        ].join(' ')}
      >
        {paragraph.slice(4)}
      </Text>
    );
  }

  if (paragraph.startsWith('• ')) {
    return (
      <Text
        className={[
          'pl-3 font-[Inter_400Regular] text-[16px] leading-[28px]',
          PUBLIC_SURFACE_CLASSES.text.bodyClassName,
        ].join(' ')}
      >
        {paragraph}
      </Text>
    );
  }

  if (paragraph.startsWith('> ')) {
    return (
      <View className="border-l border-public-surfaceRule pl-4">
        <Text
          className={[
            'font-[Inter_500Medium] text-[17px] leading-[30px]',
            PUBLIC_SURFACE_CLASSES.text.bodyWarmClassName,
          ].join(' ')}
        >
          {paragraph.slice(2)}
        </Text>
      </View>
    );
  }

  return (
    <Text
      className={[
        'font-[Inter_400Regular] text-[17px] leading-[30px]',
        PUBLIC_SURFACE_CLASSES.text.bodyClassName,
      ].join(' ')}
    >
      {paragraph}
    </Text>
  );
}

export function PublicDocumentReader({ document }: PublicDocumentReaderProps) {
  return (
    <PublicCardFrame
      className="px-6 py-8 sm:px-8 sm:py-10 lg:px-12 lg:py-12"
      contentClassName="items-center"
      enableDecorativeAccents={false}
      variant="panel"
    >
      <View className="w-full max-w-[860px] gap-10">
        <View className="gap-4">
          <View className="gap-2">
            {!!document.version && (
              <Text
                className={[
                  'font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]',
                  PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
                ].join(' ')}
              >
                {document.version}
              </Text>
            )}
            <Text
              className={[
                'font-[Inter_800ExtraBold] text-[34px] leading-[40px] sm:text-[42px] sm:leading-[50px]',
                PUBLIC_SURFACE_CLASSES.text.headingClassName,
              ].join(' ')}
            >
              {document.title}
            </Text>
            {!!document.subtitle && (
              <Text
                className={[
                  'font-[Inter_500Medium] text-[18px] leading-[28px]',
                  PUBLIC_SURFACE_CLASSES.text.bodyWarmClassName,
                ].join(' ')}
              >
                {document.subtitle}
              </Text>
            )}
            {!!document.updatedLabel && (
              <Text
                className={[
                  'font-[Inter_400Regular] text-[13px] leading-[22px]',
                  PUBLIC_SURFACE_CLASSES.text.mutedClassName,
                ].join(' ')}
              >
                {document.updatedLabel}
              </Text>
            )}
          </View>

          {!!document.intro?.length && (
            <View className="gap-4 border-t border-public-surfaceRule pt-7">
              {document.intro.map((paragraph, paragraphIndex) => (
                <PublicDocumentParagraph
                  key={`intro-${paragraphIndex}-${paragraph.slice(0, 24)}`}
                  paragraph={paragraph}
                />
              ))}
            </View>
          )}
        </View>

        <View className="gap-8">
          {document.sections.map((section) => (
            <View key={section.id} className="gap-3 border-t border-public-surfaceRule pt-7">
              {!!section.eyebrow && (
                <Text
                  className={[
                    'font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]',
                    PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
                  ].join(' ')}
                >
                  {section.eyebrow}
                </Text>
              )}
              <Text
                className={[
                  'font-[Inter_700Bold] text-[25px] leading-[32px]',
                  PUBLIC_SURFACE_CLASSES.text.headingClassName,
                ].join(' ')}
              >
                {section.title}
              </Text>
              <View className="gap-3">
                {section.body.map((paragraph, paragraphIndex) => (
                  <PublicDocumentParagraph
                    key={`${section.id}-${paragraphIndex}-${paragraph.slice(0, 24)}`}
                    paragraph={paragraph}
                  />
                ))}
              </View>
            </View>
          ))}
        </View>

        {!!document.closing && (
          <View className="gap-4 border-t border-public-surfaceRule pt-8">
            <Text
              className={[
                'font-[Orbitron_700Bold] text-[10px] uppercase tracking-[3px]',
                PUBLIC_SURFACE_CLASSES.text.eyebrowClassName,
              ].join(' ')}
            >
              {document.closing.title}
            </Text>
            {document.closing.body.map((paragraph, paragraphIndex) => (
              <Text
                key={`closing-${paragraphIndex}-${paragraph.slice(0, 24)}`}
                className={[
                  'font-[Inter_400Regular] text-[18px] leading-[32px]',
                  PUBLIC_SURFACE_CLASSES.text.bodyWarmClassName,
                ].join(' ')}
              >
                {paragraph}
              </Text>
            ))}
          </View>
        )}
      </View>
    </PublicCardFrame>
  );
}

export default PublicDocumentReader;
