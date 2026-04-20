/**
 * File: app/public/docs-content.ts
 * Description: Structured content for the public charter page.
 */
import type { Href } from 'expo-router';

import { buildAboutBackgroundImageUri } from './public-graphics';

export type CharterCta = {
  label: string;
  href: Href;
  variant?: 'default' | 'highlight';
};

export type CharterPrinciple = {
  numeral: string;
  title: string;
  body: string;
};

export type CharterPairSection = {
  id: string;
  backgroundImageUri: string;
  left: CharterPrinciple;
  right: CharterPrinciple;
};

export type CharterHero = {
  title: string;
  subtitle: string;
  intro: string;
  declaration: string;
  backgroundImageUri: string;
};

export type CharterClosing = {
  title: string;
  lines: string[];
  ctas: CharterCta[];
  backgroundImageUri: string;
};

export const CHARTER_HERO: CharterHero = {
  title: 'The Charter of the Open World Assembly',
  subtitle: 'For the Free Peoples of Earth',
  intro:
    'Humanity now possesses the means to communicate, coordinate, and act together across the planet.',
  declaration:
    'We need not wait for kings, parties, corporations, or catastrophes to decide our future. We declare these principles.',
  backgroundImageUri: buildAboutBackgroundImageUri({
    base: "#07131d",
    accentSoft: "#7fb7ff",
    ridge: "#d4f79a",
    seed: 'docs-hero-charter',
    accent: '#8dc2ff',
    glow: '#d4f79a',
  }),
};

export const CHARTER_SECTIONS: CharterPairSection[] = [
  {
    id: 'charter-01-02',
    backgroundImageUri: buildAboutBackgroundImageUri({
    base: "#07131d",
    accentSoft: "#7fb7ff",
    ridge: "#d4f79a",
      seed: 'docs-people-consent',
      accent: '#8dc2ff',
      glow: '#d4f79a',
    }),
    left: {
      numeral: 'I',
      title: 'The People Are the Source',
      body: 'All legitimate power rises from the people and remains answerable to them.',
    },
    right: {
      numeral: 'II',
      title: 'Consent Above Control',
      body: 'No authority is just without consent. No consent is real without the freedom to refuse.',
    },
  },
  {
    id: 'charter-03-04',
    backgroundImageUri: buildAboutBackgroundImageUri({
    base: "#07131d",
    accentSoft: "#7fb7ff",
    ridge: "#d4f79a",
      seed: 'docs-power-participation',
      accent: '#8dc2ff',
      glow: '#d4f79a',
    }),
    left: {
      numeral: 'III',
      title: 'Power Must Be Limited',
      body: 'Any power not checked will drift toward abuse.',
    },
    right: {
      numeral: 'IV',
      title: 'Participation Over Passivity',
      body: 'Those affected by decisions should have a voice in them.',
    },
  },
  {
    id: 'charter-05-06',
    backgroundImageUri: buildAboutBackgroundImageUri({
    base: "#07131d",
    accentSoft: "#7fb7ff",
    ridge: "#d4f79a",
      seed: 'docs-local-shared',
      accent: '#8dc2ff',
      glow: '#d4f79a',
    }),
    left: {
      numeral: 'V',
      title: 'Decentralize What Can Be Local',
      body: 'What can be decided locally should never be captured from afar.',
    },
    right: {
      numeral: 'VI',
      title: 'Coordinate What Must Be Shared',
      body: 'What concerns many may be aligned by many through open cooperation.',
    },
  },
  {
    id: 'charter-07-08',
    backgroundImageUri: buildAboutBackgroundImageUri({
    base: "#07131d",
    accentSoft: "#7fb7ff",
    ridge: "#d4f79a",
      seed: 'docs-unity-nonviolence',
      accent: '#8dc2ff',
      glow: '#d4f79a',
    }),
    left: {
      numeral: 'VII',
      title: 'Unity Without Uniformity',
      body: 'People may differ in culture, belief, and way of life while building peace together.',
    },
    right: {
      numeral: 'VIII',
      title: 'Nonviolence Is Strength',
      body: 'Violence breeds the systems it claims to defeat. Disciplined peace outlasts fear.',
    },
  },
  {
    id: 'charter-09-10',
    backgroundImageUri: buildAboutBackgroundImageUri({
    base: "#07131d",
    accentSoft: "#7fb7ff",
    ridge: "#d4f79a",
      seed: 'docs-truth-fatalism',
      accent: '#8dc2ff',
      glow: '#d4f79a',
    }),
    left: {
      numeral: 'IX',
      title: 'Truth Must Be Visible',
      body: 'Transparency builds trust. Hidden power corrodes it.',
    },
    right: {
      numeral: 'X',
      title: 'Fatalism Is Folly',
      body: 'We need not wait for war, collapse, or nuclear fire to become wise.',
    },
  },
];

export const CHARTER_CLOSING: CharterClosing = {
  title: 'Closing',
  lines: [
    'The future is not owned by tyrants, algorithms, or inherited power.',
    'The future belongs to free peoples who choose to build it together.',
    'Let assemblies rise wherever people are. Let consent become visible.',
    'Let cooperation outrun coercion. Let the age of participation begin.',
  ],
  ctas: [
    { label: 'About OWA', href: '/about' },
    { label: 'Support OWA', href: '/support' },
    { label: 'Enter Nexus', href: '/nexus', variant: 'highlight' },
  ],
  backgroundImageUri: buildAboutBackgroundImageUri({
    base: "#07131d",
    accentSoft: "#7fb7ff",
    ridge: "#d4f79a",
    seed: 'docs-closing-charter',
    accent: '#8dc2ff',
    glow: '#d4f79a',
  }),
};
