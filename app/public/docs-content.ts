/**
 * File: docs-content.ts
 * Description: Defines the public docs directory and document-page metadata.
 */
import type {
  PublicDocsPageContent,
  PublicDocumentDirectoryItem,
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
      {
        label: 'Download PDF',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS.charter.pdf },
        variant: 'outline',
      },
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
      {
        label: 'Download PDF',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS['nexus-readme'].pdf },
        variant: 'outline',
      },
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
      {
        label: 'Download PDF',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS['implementation-guide'].pdf },
        variant: 'outline',
      },
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
      {
        label: 'Download PDF',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS.specifications.pdf },
        variant: 'outline',
      },
    ],
  },
  {
    slug: 'roadmap',
    title: 'Roadmap',
    summary: 'Near-term priorities, known gaps, future work, and next development milestones.',
    status: 'draft',
    typeLabel: 'Planning document',
    readableDocumentSlug: 'roadmap',
    actions: [
      {
        label: 'Download .md',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS.roadmap.markdown },
        variant: 'outline',
      },
      {
        label: 'Download PDF',
        target: { kind: 'download', href: PUBLIC_DOC_DOWNLOADS.roadmap.pdf },
        variant: 'outline',
      },
    ],
  },
];

export const docsPageContent: PublicDocsPageContent = {
  hero: {
    eyebrow: 'Public Documents',
    title: 'Core documents.',
    summary: [],
    actions: [
      { label: 'Support OWA', href: '/support', variant: 'outline' },
      { label: 'Explore Nexus Demo', href: '/nexus/dashboard', variant: 'outline' },
    ],
  },
  directory: PUBLIC_DOCS_DIRECTORY,
  featuredDocumentSlug: 'charter',
  resources: [],
};

export const DEFAULT_PUBLIC_DOCUMENT_SLUG = docsPageContent.featuredDocumentSlug;
