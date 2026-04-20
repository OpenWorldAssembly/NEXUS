/**
 * File: home-content.ts
 * Description: Stores the homepage hero and the selected sharp rail sections.
 */
import type { PublicPageAction } from '@app/components/public/public-page-actions';
import { buildAboutBackgroundImageUri } from './public-graphics';

export type HomeHero = {
  title: string;
  statement: string;
  backgroundImageUri: string;
};

export type HomeRailSection = {
  id: string;
  mainPoint: string;
  subPoint: string;
  backgroundImageUri: string;
  align: 'left' | 'right';
  action: PublicPageAction;
};

export type HomePageContent = {
  hero: HomeHero;
  heroActions: PublicPageAction[];
  sections: HomeRailSection[];
};

const heroActions: PublicPageAction[] = [
  { href: '/about', label: 'About OWA', variant: 'secondary' },
  { href: '/nexus/dashboard', label: 'Enter Nexus', variant: 'primary' },
  { href: '/docs', label: 'Read Charter', variant: 'secondary' },
];

const hero: HomeHero = {
  title: 'Open World Assembly',
  statement: 'Decentralized human coordination.',
  backgroundImageUri: buildAboutBackgroundImageUri({
    base: '#09131f',
    accent: '#8ec5ff',
    accentSoft: '#d7ffbf',
    glow: '#173651',
    ridge: '#466176',
  }),
};

const sections: HomeRailSection[] = [
  {
    id: 'unity',
    mainPoint: 'Unity Is Inevitable',
    subPoint: 'Nuclear war is not.',
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#0a1422',
      accent: '#9ecbff',
      accentSoft: '#d7ffbf',
      glow: '#18344c',
      ridge: '#3f5a71',
    }),
    align: 'right',
    action: { href: '/about', label: 'About OWA', variant: 'secondary' },
  },
  {
    id: 'time',
    mainPoint: 'Our Time Has Come',
    subPoint: 'No permission required.',
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#0a1524',
      accent: '#9ac8ff',
      accentSoft: '#d7ffbf',
      glow: '#193a56',
      ridge: '#4a6278',
    }),
    align: 'left',
    action: { href: '/docs', label: 'Read Charter', variant: 'secondary' },
  },
  {
    id: 'technology',
    mainPoint: 'We Have The Technology',
    subPoint: 'To liberate or to enslave.',
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#08111d',
      accent: '#a6d6ff',
      accentSoft: '#f0d79a',
      glow: '#16324b',
      ridge: '#425b70',
    }),
    align: 'right',
    action: { href: '/nexus/dashboard', label: 'Enter Nexus', variant: 'secondary' },
  },
  {
    id: 'future',
    mainPoint: 'The Future Is Ours',
    subPoint: 'Let’s build it together.',
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#09131f',
      accent: '#a2d5ff',
      accentSoft: '#c6d670',
      glow: '#17344d',
      ridge: '#425d73',
    }),
    align: 'left',
    action: { href: '/support', label: 'Support OWA', variant: 'secondary' },
  },
];

export const homePageContent: HomePageContent = {
  hero,
  heroActions,
  sections,
};
