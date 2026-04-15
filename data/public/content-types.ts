/**
 * File: content-types.ts
 * Description: Shared public-site content models for structured copy and highlight sections.
 */
import type { PublicHref } from './public-routes';

export type AboutHighlightTone = 'accent' | 'sand' | 'cyan' | 'muted';

export type AboutHighlight = {
  title: string;
  body: string;
  cta?: string;
  href?: PublicHref;
  color?: AboutHighlightTone;
};

export type AboutSection = {
  id: string;
  eyebrow: string;
  headline: string;
  summary: string;
  backgroundImageUri: string;
  highlights: AboutHighlight[];
};

export type AboutPageContent = {
  pageTitle: string;
  pageSubtitle: string;
  railTitle: string;
  railSubtitle: string;
  sections: AboutSection[];
};

export type CharterResource = {
  status: string;
  title: string;
  body: string;
};
