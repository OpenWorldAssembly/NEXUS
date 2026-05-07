/**
 * File: content-types.ts
 * Description: Defines shared public content model types.
 */
import type { PublicHref } from '@app/public/public-routes';

export type PublicLinkTarget =
  | { kind: 'route'; href: PublicHref }
  | { kind: 'external'; url: string }
  | { kind: 'download'; href: `/downloads/${string}` };

export type PublicActionVariant = 'primary' | 'secondary' | 'solid' | 'outline';

export type PublicPageAction = {
  label: string;
  target?: PublicLinkTarget;
  /** Compatibility route used by existing public content. Prefer target for new links. */
  href?: PublicHref;
  variant?: PublicActionVariant;
  disabled?: boolean;
  externalLabel?: string;
};

export type PublicPageActionItem = PublicPageAction;

export type AboutHighlight = {
  title: string;
  body: string;
  href?: PublicHref;
  cta?: string;
  color?: 'sand' | 'cyan' | 'accent';
};

export type AboutSection = {
  id: string;
  eyebrow: string;
  headline: string;
  summary: string;
  highlights: AboutHighlight[];
  backgroundImageUri: string;
};

export type PublicDocumentHero = {
  eyebrow: string;
  title: string;
  summary: string[];
  noteTitle?: string;
  noteBody?: string;
  actions: PublicPageAction[];
};

export type PublicReadableDocumentSectionLevel = 2 | 3 | 4;

export type PublicReadableDocumentSection = {
  id: string;
  level?: PublicReadableDocumentSectionLevel;
  eyebrow?: string;
  title: string;
  body: string[];
};

export type PublicReadableDocument = {
  slug: string;
  title: string;
  subtitle?: string;
  version?: string;
  updatedLabel?: string;
  intro?: string[];
  sections: PublicReadableDocumentSection[];
  closing?: {
    title: string;
    body: string[];
  };
};

export type PublicDocumentDirectoryItem = {
  slug: string;
  title: string;
  summary: string;
  status: 'available' | 'draft' | 'planned';
  typeLabel: string;
  readableDocumentSlug?: string;
  actions?: PublicPageAction[];
};

export type PublicDocumentResource = {
  slug: string;
  title: string;
  summary: string;
  target?: PublicLinkTarget;
  /** Compatibility route used by existing public content. Prefer target for new resources. */
  href?: PublicHref;
  disabled?: boolean;
};

export type PublicDocsPageContent = {
  hero: PublicDocumentHero;
  directory: PublicDocumentDirectoryItem[];
  featuredDocumentSlug: string;
  resources?: PublicDocumentResource[];
};
