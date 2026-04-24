import type { PublicHref } from "@/app/public/public-routes";

export type CharterPrincipleCard = {
  principle: string;
  title: string;
  body: string;
  anchor: "left" | "right";
};

export type PublicPageActionItem = {
  label: string;
  href?: PublicHref;
  variant?: "outline" | "solid";
  disabled?: boolean;
};

export type PublicDocumentHero = {
  eyebrow: string;
  title: string;
  summary: string[];
  noteTitle?: string;
  noteBody?: string;
  actions: PublicPageActionItem[];
};

export type PublicDocumentClosing = {
  title: string;
  body: string[];
};

export type PublicDocumentResource = {
  slug: string;
  title: string;
  summary: string;
  href?: PublicHref;
  disabled?: boolean;
};

export type PublicDocumentEntry = {
  slug: string;
  title: string;
  description: string;
  hero: PublicDocumentHero;
  sections: CharterPrincipleCard[];
  closing: PublicDocumentClosing;
  resources?: PublicDocumentResource[];
};
