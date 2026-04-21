/**
 * File: home-content.ts
 * Description: Stores the homepage rail sections, including the leading hero section.
 */
import type { PublicPageAction } from '@app/components/public/public-page-actions';
import { buildAboutBackgroundImageUri } from './public-graphics';

export type HomeRailSection = {
  id: string;
  mainPoint: string;
  subPoint: string;
  backgroundImageUri: string;
  align: 'left' | 'right';
  action?: PublicPageAction;
  actions?: PublicPageAction[];
  variant?: 'hero' | 'standard';
};

export type HomePageContent = {
  sections: HomeRailSection[];
};

const sections: HomeRailSection[] = [
  {
    id: 'hero',
    mainPoint: 'Open World Assembly',
    subPoint: 'Decentralized human coordination.',
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#09131f',
      accent: '#8ec5ff',
      accentSoft: '#d7ffbf',
      glow: '#173651',
      ridge: '#466176',
    }),
    align: 'left',
    actions: [
      { href: '/about', label: 'About OWA', variant: 'secondary' },
      { href: '/nexus/dashboard', label: 'Enter Nexus', variant: 'primary' },
      { href: '/docs', label: 'Read Charter', variant: 'secondary' },
    ],
    variant: 'hero',
  },
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
    variant: 'standard',
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
    variant: 'standard',
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
    variant: 'standard',
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
    variant: 'standard',
  },
];

export const homePageContent: HomePageContent = {
  sections,
};
