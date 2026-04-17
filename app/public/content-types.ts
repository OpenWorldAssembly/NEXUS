/**
 * File: content-types.ts
 * Description: Shared public-site content models for structured copy and highlight sections.
 */
import type { PublicHref } from './public-routes';

export type AboutHighlightTone = 'accent' | 'sand' | 'cyan' | 'muted';

export type PublicHeroSlide = {
  eyebrow: string;
  title: string;
  body: string;
  kicker: string;
  detail: string;
  backgroundImageUri: string;
};

export type PublicPrinciple = {
  title: string;
  body: string;
};

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
