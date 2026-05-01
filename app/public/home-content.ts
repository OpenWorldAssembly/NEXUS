/**
 * File: home-content.ts
 * Description: Stores the homepage rail sections, including the leading hero section.
 */
import type { PublicPageAction } from '@app/components/public/public-page-actions';
import { buildAboutBackgroundImageUri } from './public-graphics';

export type HomeRailSection = {
  id: string;
  mainPoint: string;
  subPoint?: string;
  subPoints?: string[];
  backgroundImageUri: string;
  align: 'left' | 'right';
  action?: PublicPageAction;
  actions?: PublicPageAction[];
  mainPointScale?: 'standard' | 'compact';
  variant?: 'hero' | 'standard';
};

export type HomePageContent = {
  sections: HomeRailSection[];
};

const sections: HomeRailSection[] = [
  {
    id: 'hero',
    mainPoint: 'Open World Assembly aligns local assemblies into global coordination.',
    subPoints: [
      'Decentralized direct democracy from local to global',
      'Participation is consent-based by default',
      'Assemblies sense, think, act, and learn together',
      'Fair decisions, efficient action, coordination without control',
    ],
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
    mainPointScale: 'compact',
    variant: 'hero',
  },
  {
    id: 'social',
    mainPoint: 'Social media connects people, but profit systems distort coordination.',
    subPoints: [
      'Optimized for truth, trust, and coordinated action',
      'Feeds are organic, transparent, and customizable',
      'Encourages peace and unity over outrage and division',
      'Built for discussion, proposals, consent, and coordination',
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#0a1422',
      accent: '#9ecbff',
      accentSoft: '#d7ffbf',
      glow: '#18344c',
      ridge: '#3f5a71',
    }),
    align: 'right',
    action: { href: '/about', label: 'About OWA', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
  {
    id: 'un',
    mainPoint: 'The UN connects governments; OWA connects people directly.',
    subPoints: [
      'Connects people directly, not through governments',
      'Decisions and funding are local; alignment is global',
      'Cooperation is open, direct, fair, and efficient',
      'Enables populations to synchronize beyond borders',
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#0a1524',
      accent: '#9ac8ff',
      accentSoft: '#d7ffbf',
      glow: '#193a56',
      ridge: '#4a6278',
    }),
    align: 'left',
    action: { href: '/docs', label: 'Read Charter', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
  {
    id: 'why-now',
    mainPoint: 'The tools for global coordination exist, and control systems are already using them.',
    subPoints: [
      'Exponential technology can enslave us or set us free',
      'World leaders and institutions are becoming increasingly corrupt',
      'Conflict patterns continue trending toward world war',
      'Humanity needs a backchannel to coordinate without control',
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#08111d',
      accent: '#a6d6ff',
      accentSoft: '#f0d79a',
      glow: '#16324b',
      ridge: '#425b70',
    }),
    align: 'right',
    action: { href: '/nexus/dashboard', label: 'Enter Nexus', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
  {
    id: 'agency',
    mainPoint: 'We can begin uniting now, without permission or catastrophe.',
    subPoints: [
      'Unity can be achieved without forcing uniformity',
      'Alignment emerges through consent, not decree',
      'Every human deserves for their voice to be heard',
      'A world of peace and prosperity is worth building',
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#09131f',
      accent: '#a2d5ff',
      accentSoft: '#c6d670',
      glow: '#17344d',
      ridge: '#425d73',
    }),
    align: 'left',
    action: { href: '/support', label: 'Support OWA', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
];

export const homePageContent: HomePageContent = {
  sections,
};
