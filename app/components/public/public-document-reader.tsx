/**
 * File: public-document-reader.tsx
 * Description: Renders generated public Markdown documents as readable web content with an internal outline.
 */
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';

import type { PublicReadableDocument, PublicReadableDocumentSection } from '@app/public/content-types';
import PublicCardFrame from './public-card-frame';
import { PUBLIC_SURFACE_CLASSES } from './public-surface';

function mergeClassNames(...classNames: Array<string | undefined | false>) {
  return classNames.filter(Boolean).join(' ');
}

function getSectionLevel(section: PublicReadableDocumentSection) {
  return section.level ?? 2;
}

function getReadableSections(document: PublicReadableDocument) {
  return document.sections.filter((section) => {
    const hasBody = section.body.length > 0;
    const isDuplicateTitle = section.title.trim().toLowerCase() === document.title.trim().toLowerCase();
    return hasBody || !isDuplicateTitle;
  });
}

function renderParagraph(paragraph: string, index: number) {
  if (paragraph.startsWith('#### ')) {
    return (
      <Text
        key={`${paragraph}-${index}`}
        className="mt-4 text-sm font-extrabold uppercase tracking-[0.14em] text-public-sand"
      >
        {paragraph.replace(/^####\s+/, '')}
      </Text>
    );
  }

  if (paragraph.startsWith('### ')) {
    return (
      <Text
        key={`${paragraph}-${index}`}
        className="mt-5 text-base font-extrabold uppercase tracking-[0.14em] text-public-sand"
      >
        {paragraph.replace(/^###\s+/, '')}
      </Text>
    );
  }

  if (paragraph.startsWith('• ')) {
    return (
      <Text key={`${paragraph}-${index}`} className="text-base leading-7 text-public-body">
        {paragraph}
      </Text>
    );
  }

  if (paragraph.startsWith('> ')) {
    return (
      <Text
        key={`${paragraph}-${index}`}
        className="border-l border-public-surfaceRule pl-4 text-base leading-7 text-public-bodyWarm"
      >
        {paragraph.replace(/^>\s+/, '')}
      </Text>
    );
  }

  return (
    <Text key={`${paragraph}-${index}`} className="text-base leading-7 text-public-body">
      {paragraph}
    </Text>
  );
}

type PublicDocumentOutlineItem = {
  section: PublicReadableDocumentSection;
  children: PublicDocumentOutlineItem[];
};

function buildOutlineTree(sections: PublicReadableDocumentSection[]) {
  const roots: PublicDocumentOutlineItem[] = [];
  const stack: PublicDocumentOutlineItem[] = [];

  for (const section of sections) {
    const item: PublicDocumentOutlineItem = { section, children: [] };
    const level = getSectionLevel(section);

    while (stack.length && getSectionLevel(stack[stack.length - 1].section) >= level) {
      stack.pop();
    }

    const parent = stack[stack.length - 1];
    if (parent) {
      parent.children.push(item);
    } else {
      roots.push(item);
    }

    stack.push(item);
  }

  return roots;
}

type PublicDocumentOutlineLinkProps = {
  item: PublicDocumentOutlineItem;
  depth: number;
  marker: string;
  onSelectSection?: (sectionId: string) => void;
};

function PublicDocumentOutlineLink({ item, depth, marker, onSelectSection }: PublicDocumentOutlineLinkProps) {
  const level = getSectionLevel(item.section);
  const isRoot = depth === 0;
  const label = item.section.eyebrow ? `${item.section.eyebrow}.` : marker;

  return (
    <Pressable
      accessibilityRole="link"
      onPress={() => onSelectSection?.(item.section.id)}
      className={mergeClassNames(
        'rounded-xl px-2.5 py-1.5',
        isRoot && 'bg-public-surfaceBase/45',
        !isRoot && 'py-1',
        level === 4 && 'ml-2 bg-public-surfaceBase/20',
      )}
    >
      <View className="flex-row items-start gap-2">
        <Text
          className={mergeClassNames(
            'min-w-[2.1rem] text-[10px] font-extrabold uppercase tracking-[0.16em] text-public-signal',
            !isRoot && 'min-w-[2.5rem] text-[9px] tracking-[0.12em] text-public-mutedBlue',
          )}
        >
          {label}
        </Text>
        <Text
          className={mergeClassNames(
            'flex-1 text-xs font-extrabold leading-5 text-public-heading',
            !isRoot && 'text-[11px] leading-4 text-public-bodyWarm',
            level === 4 && 'text-public-mutedBlue',
          )}
        >
          {item.section.title}
        </Text>
      </View>
    </Pressable>
  );
}

type PublicDocumentOutlineGroupProps = {
  item: PublicDocumentOutlineItem;
  index: number;
  onSelectSection?: (sectionId: string) => void;
};

function PublicDocumentOutlineGroup({ item, index, onSelectSection }: PublicDocumentOutlineGroupProps) {
  const marker = String(index + 1).padStart(2, '0');

  return (
    <View className="w-full gap-1 rounded-2xl bg-public-surfaceBase/25 p-2">
      <PublicDocumentOutlineLink
        item={item}
        depth={0}
        marker={marker}
        onSelectSection={onSelectSection}
      />

      {item.children.length ? (
        <View className="gap-1 pl-2">
          {item.children.map((child, childIndex) => (
            <View key={child.section.id} className="gap-1">
              <PublicDocumentOutlineLink
                item={child}
                depth={1}
                marker={`${index + 1}.${childIndex + 1}`}
                onSelectSection={onSelectSection}
              />
              {child.children.length ? (
                <View className="gap-1 pl-3">
                  {child.children.map((grandchild, grandchildIndex) => (
                    <PublicDocumentOutlineLink
                      key={grandchild.section.id}
                      item={grandchild}
                      depth={2}
                      marker={`${index + 1}.${childIndex + 1}.${grandchildIndex + 1}`}
                      onSelectSection={onSelectSection}
                    />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

type PublicDocumentOutlineProps = {
  sections: PublicReadableDocumentSection[];
  onSelectSection?: (sectionId: string) => void;
};

function PublicDocumentOutline({ sections, onSelectSection }: PublicDocumentOutlineProps) {
  const outlineItems = buildOutlineTree(sections);

  if (outlineItems.length <= 1) {
    return null;
  }

  return (
    <View className="gap-3 rounded-[24px] bg-public-surfaceBase/35 p-4 md:p-5">
      <View className="gap-1">
        <Text className="text-xs font-extrabold uppercase tracking-[0.28em] text-public-signal">
          Document Outline
        </Text>
        <Text className="text-sm leading-6 text-public-mutedBlue">
          Jump through chapters and subsections without hunting through the whole document.
        </Text>
      </View>

      <View className="gap-2">
        {outlineItems.map((item, index) => (
          <PublicDocumentOutlineGroup
            key={item.section.id}
            item={item}
            index={index}
            onSelectSection={onSelectSection}
          />
        ))}
      </View>
    </View>
  );
}

type PublicDocumentSectionProps = {
  section: PublicReadableDocumentSection;
  onLayout?: (event: LayoutChangeEvent) => void;
};

function PublicDocumentSection({ section, onLayout }: PublicDocumentSectionProps) {
  const level = getSectionLevel(section);
  const isSubsection = level > 2;

  return (
    <View
      onLayout={onLayout}
      className={mergeClassNames(
        'gap-5 border-t border-public-surfaceRule pt-7',
        isSubsection && 'ml-0 gap-4 border-public-surfaceRule/65 pt-5 md:ml-5',
        level === 4 && 'md:ml-10',
      )}
    >
      <View className={mergeClassNames('gap-3', isSubsection && 'gap-2')}>
        {section.eyebrow ? (
          <Text className={PUBLIC_SURFACE_CLASSES.text.eyebrowClassName + ' text-xs font-extrabold uppercase tracking-[0.28em]'}>
            {section.eyebrow}
          </Text>
        ) : null}
        <Text
          className={mergeClassNames(
            PUBLIC_SURFACE_CLASSES.text.headingClassName,
            'font-bold leading-tight',
            level === 2 && 'text-2xl md:text-3xl',
            level === 3 && 'text-xl md:text-2xl',
            level === 4 && 'text-lg md:text-xl',
          )}
        >
          {section.title}
        </Text>
      </View>

      {section.body.length ? (
        <View className={mergeClassNames('gap-4', isSubsection && 'gap-3')}>
          {section.body.map((paragraph, index) => renderParagraph(paragraph, index))}
        </View>
      ) : null}
    </View>
  );
}

type PublicDocumentReaderProps = {
  document: PublicReadableDocument;
  onSectionsLayout?: (offsetY: number) => void;
  onSectionLayout?: (sectionId: string, offsetY: number) => void;
  onSelectSection?: (sectionId: string) => void;
};

/**
 * Inputs: a generated public document object and optional internal-scroll callbacks.
 * Output: a readable document panel with an outline and section anchors inside one continuous card.
 */
export default function PublicDocumentReader({
  document,
  onSectionsLayout,
  onSectionLayout,
  onSelectSection,
}: PublicDocumentReaderProps) {
  const readableSections = getReadableSections(document);

  return (
    <View className="mx-auto w-full max-w-5xl">
      <PublicCardFrame
        variant="decorated"
        className="w-full"
        contentClassName="gap-7 p-6 md:p-10"
        backgroundMotif="global"
        backgroundImageOpacity={0.3}
      >
        <View className="gap-3">
          {document.version ? (
            <Text className="text-xs font-extrabold uppercase tracking-[0.28em] text-public-signal">
              {document.version}
            </Text>
          ) : null}
          <Text className="text-3xl font-bold leading-tight text-public-heading md:text-5xl">
            {document.title}
          </Text>
          {document.subtitle ? (
            <Text className="max-w-3xl text-lg leading-8 text-public-bodyWarm">
              {document.subtitle}
            </Text>
          ) : null}
          {document.updatedLabel ? (
            <Text className="text-xs font-bold uppercase tracking-[0.16em] text-public-mutedBlue">
              {document.updatedLabel}
            </Text>
          ) : null}
        </View>

        {document.intro?.length ? (
          <View className="gap-4 border-t border-public-surfaceRule pt-5">
            {document.intro.map((paragraph, index) => renderParagraph(paragraph, index))}
          </View>
        ) : null}

        <PublicDocumentOutline sections={readableSections} onSelectSection={onSelectSection} />

        <View
          className="gap-7"
          onLayout={(event) => onSectionsLayout?.(event.nativeEvent.layout.y)}
        >
          {readableSections.map((section) => (
            <PublicDocumentSection
              key={section.id}
              section={section}
              onLayout={(event) => onSectionLayout?.(section.id, event.nativeEvent.layout.y)}
            />
          ))}
        </View>
      </PublicCardFrame>
    </View>
  );
}
