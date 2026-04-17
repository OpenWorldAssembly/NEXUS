/**
 * File: docs-content.ts
 * Description: Stores the copy for the public docs and charter route.
 */
import type { PublicPageAction } from '@app/components/public/public-page-actions';
import type { CharterResource } from './content-types';

export type DocsPageContent = {
  eyebrow: string;
  title: string;
  body: string;
  calloutEyebrow: string;
  calloutBody: string;
  resources: CharterResource[];
  actions: PublicPageAction[];
};

export const charterResources: CharterResource[] = [
  {
    status: 'Current public route',
    title: 'Charter destination page',
    body:
      'This page now serves as the dedicated home for the public charter. It is no longer just a placeholder route, but the actual destination where the charter and its supporting materials will live as they are written.',
  },
  {
    status: 'Source material',
    title: 'Long-form canon and implementation guidance',
    body:
      'The broader body of work still lives in longer internal documents. Those materials inform the charter, but the charter itself should remain concise, legible, and public-facing.',
  },
  {
    status: 'Next drafting step',
    title: 'Condense principles into a short public statement',
    body:
      'The next major step is turning the deeper framework into a brief, trustworthy charter that explains OWA without requiring readers to absorb the entire system architecture first.',
  },
];

export const docsPageContent: DocsPageContent = {
  eyebrow: 'Charter',
  title: 'The public charter belongs here.',
  body:
    'This route now serves as the charter destination for the public site. The charter itself still needs to be written, so this page currently frames the purpose of that document and points to the materials informing it.',
  calloutEyebrow: 'What the charter should do',
  calloutBody:
    'Present the shortest trustworthy statement of OWA principles, legitimacy, structure, and commitments so a new visitor can understand what the system stands for before diving into longer canon and implementation material.',
  resources: charterResources,
  actions: [
    { href: '/about', label: 'Learn More', variant: 'primary' },
    { href: '/nexus/dashboard', label: 'Browse the Nexus', variant: 'secondary' },
  ],
};
