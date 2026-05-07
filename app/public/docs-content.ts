/**
 * File: docs-content.ts
 * Description: Defines the public docs directory and document-page metadata.
 */
import type {
  PublicDocsPageContent,
  PublicDocumentDirectoryItem,
  PublicDocumentResource,
} from '@app/public/content-types';
import { PUBLIC_DOC_DOWNLOADS } from '@app/public/generated/public-docs.generated';

export const PUBLIC_DOCS_DIRECTORY: PublicDocumentDirectoryItem[] = [
  {
    slug: 'charter',
    title: 'OWA Charter',
    summary: 'Founding principles for Open World Assembly and peaceful decentralized coordination.',
    status: 'available',
    typeLabel: 'Founding document',
    readableDocumentSlug: 'charter',
    actions: [
      {
        label: 'Download .md',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS.charter.markdown },
        variant: 'outline',
      },
      { label: 'PDF Soon', variant: 'outline', disabled: true },
    ],
  },
  {
    slug: 'nexus-readme',
    title: 'Nexus README',
    summary: 'A practical overview of the Nexus prototype, current posture, and system architecture.',
    status: 'draft',
    typeLabel: 'System overview',
    readableDocumentSlug: 'nexus-readme',
    actions: [
      {
        label: 'Download .md',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS['nexus-readme'].markdown },
        variant: 'outline',
      },
      { label: 'PDF Soon', variant: 'outline', disabled: true },
    ],
  },
  {
    slug: 'implementation-guide',
    title: 'Implementation Guide',
    summary: 'Working notes on project structure, conventions, key decisions, and implementation seams.',
    status: 'draft',
    typeLabel: 'Technical guide',
    readableDocumentSlug: 'implementation-guide',
    actions: [
      {
        label: 'Download .md',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS['implementation-guide'].markdown },
        variant: 'outline',
      },
      { label: 'PDF Soon', variant: 'outline', disabled: true },
    ],
  },
  {
    slug: 'specifications',
    title: 'Specifications',
    summary: 'Current intended behavior for public surfaces, Nexus workflows, packets, and system contracts.',
    status: 'draft',
    typeLabel: 'Reference spec',
    readableDocumentSlug: 'specifications',
    actions: [
      {
        label: 'Download .md',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS.specifications.markdown },
        variant: 'outline',
      },
      { label: 'PDF Soon', variant: 'outline', disabled: true },
    ],
  },
  {
    slug: 'roadmap',
    title: 'Roadmap',
    summary: 'Near-term priorities, known gaps, deferred work, and next development milestones.',
    status: 'draft',
    typeLabel: 'Planning document',
    readableDocumentSlug: 'roadmap',
    actions: [
      {
        label: 'Download .md',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS.roadmap.markdown },
        variant: 'outline',
      },
      { label: 'PDF Soon', variant: 'outline', disabled: true },
    ],
  },
];

const PUBLIC_DOC_RESOURCES: PublicDocumentResource[] = [
  {
    slug: 'compiled-markdown',
    title: 'Compiled Markdown',
    summary: 'The visible docs are generated from source Markdown and can be downloaded per document from the directory above.',
    disabled: true,
  },
  {
    slug: 'pdf-pipeline',
    title: 'PDF Pipeline',
    summary: 'PDF exports are intentionally deferred until the Markdown reader and source pipeline are stable.',
    disabled: true,
  },
];

export const docsPageContent: PublicDocsPageContent = {
  hero: {
    eyebrow: 'Public Documents',
    title: 'Read the core documents.',
    summary: [
      'Open World Assembly is documented in public: founding principles, Nexus architecture, implementation notes, specifications, and roadmap work.',
      'The page now reads generated Markdown directly as clean web documents, with per-document Markdown downloads available from the directory.',
    ],
    noteTitle: 'Current status',
    noteBody:
      'The Charter, Nexus README, Implementation Guide, Specifications, and Roadmap are readable on this page now. PDF generation comes after the Markdown pipeline is settled.',
    actions: [
      { label: 'Read Charter', href: '/docs', variant: 'outline' },
      { label: 'Support OWA', href: '/support', variant: 'outline' },
      { label: 'Explore Nexus Demo', href: '/nexus/dashboard', variant: 'outline' },
    ],
  },
  directory: PUBLIC_DOCS_DIRECTORY,
  featuredDocumentSlug: 'charter',
  resources: PUBLIC_DOC_RESOURCES,
};

export const DEFAULT_PUBLIC_DOCUMENT_SLUG = docsPageContent.featuredDocumentSlug;
