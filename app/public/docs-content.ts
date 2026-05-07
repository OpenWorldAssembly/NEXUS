/**
 * File: docs-content.ts
 * Description: Defines the public docs directory and document-page metadata.
 */
import type {
  PublicDocsPageContent,
  PublicDocumentDirectoryItem,
  PublicDocumentResource,
} from '@app/public/content-types';

export const PUBLIC_DOCS_DIRECTORY: PublicDocumentDirectoryItem[] = [
  {
    slug: 'charter',
    title: 'OWA Charter',
    summary: 'Founding principles for Open World Assembly and peaceful decentralized coordination.',
    status: 'available',
    typeLabel: 'Founding document',
    readableDocumentSlug: 'charter',
    actions: [
      { label: 'Read Below', href: '/docs', variant: 'outline' },
      { label: 'PDF Soon', variant: 'outline', disabled: true },
    ],
  },
  {
    slug: 'nexus-readme',
    title: 'Nexus README',
    summary: 'A practical overview of the Nexus prototype, current posture, and system architecture.',
    status: 'draft',
    typeLabel: 'System overview',
    actions: [{ label: 'Download Soon', variant: 'outline', disabled: true }],
  },
  {
    slug: 'implementation-guide',
    title: 'Implementation Guide',
    summary: 'Working notes on project structure, conventions, key decisions, and implementation seams.',
    status: 'draft',
    typeLabel: 'Technical guide',
    actions: [{ label: 'Download Soon', variant: 'outline', disabled: true }],
  },
  {
    slug: 'specifications',
    title: 'Specifications',
    summary: 'Current intended behavior for public surfaces, Nexus workflows, packets, and system contracts.',
    status: 'draft',
    typeLabel: 'Reference spec',
    actions: [{ label: 'Download Soon', variant: 'outline', disabled: true }],
  },
  {
    slug: 'roadmap',
    title: 'Roadmap',
    summary: 'Near-term priorities, known gaps, deferred work, and next development milestones.',
    status: 'draft',
    typeLabel: 'Planning document',
    actions: [{ label: 'Download Soon', variant: 'outline', disabled: true }],
  },
];

const PUBLIC_DOC_RESOURCES: PublicDocumentResource[] = [
  {
    slug: 'charter-pdf',
    title: 'Charter PDF',
    summary: 'Printable public-release PDF for the OWA Charter. Generated artifact pipeline pending.',
    disabled: true,
  },
  {
    slug: 'compiled-markdown',
    title: 'Compiled Markdown',
    summary: 'Markdown downloads will be generated from public source chapters in the next docs pipeline pass.',
    disabled: true,
  },
];

export const docsPageContent: PublicDocsPageContent = {
  hero: {
    eyebrow: 'Public Documents',
    title: 'Read the core documents.',
    summary: [
      'Open World Assembly is being documented in public: founding principles, Nexus architecture, implementation notes, specifications, and roadmap work.',
      'The document system is being prepared for generated Markdown, readable web pages, and downloadable PDFs from the same source material.',
    ],
    noteTitle: 'Current status',
    noteBody:
      'The Charter is readable on this page now. Additional downloads and document readers will be wired as the public docs pipeline comes online.',
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
