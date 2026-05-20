/**
 * File: home-content.ts
 * Description: Stores the homepage rail sections, including the leading hero section.
 */
import type { ImageSource } from 'expo-image';

import type { PublicPageAction } from '@app/public/content-types';
import {
  homeSectionBetterTechnologyImageSource,
  homeSectionGrassrootsUnImageSource,
  homeSectionOpenAssemblyImageSource,
  homeSectionOwaClarityImageSource,
  homeSectionUnityImageSource,
  homeSectionUtilitarianImageSource,
} from './home-section-assets';
import { buildPublicBackgroundImageUri } from './public-graphics';

export type HomeRailSection = {
  id: string;
  mainPoint: string;
  subPoint?: string;
  subPoints?: string[];
  backgroundImageUri: string;
  align: 'left' | 'right';
  sideImageSource?: ImageSource;
  sideImageAlt?: string;
  visualMode?: 'motif' | 'image';
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
    mainPoint: 'Open World Assembly \n- Local Decisions \n- Global Alignment',
    subPoints: [
      'Decentralized organization from local to global',
      'Consent-based participation open to all humans',
      'Fractal assemblies sense, think, act, and learn',
      'Antifragile design survives hostile environments',
    ],
    backgroundImageUri: buildPublicBackgroundImageUri({
      variant: 'card',
      motif: 'civicLattice',
      motifOpacity: 0.095,
      motifSide: 'right',
      palette: {
        base: '#09131f',
        accent: '#8ec5ff',
        accentSoft: '#d7ffbf',
        glow: '#173651',
        ridge: '#466176',
      },
    }),
    align: 'left',
    sideImageSource: homeSectionOpenAssemblyImageSource,
    sideImageAlt: 'A luminous open assembly forming in a public civic space.',
    visualMode: 'image',
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
    mainPoint: 'Media distorts reality \nOWA restores clarity',
    subPoints: [
      'Optimized for truth, trust, and transparency',
      'Feeds are open, organic, and user-controlled',
      'Facilitates dialogue over outrage and division',
      'Peer-verified credibility and accountability',
    ],
    backgroundImageUri: buildPublicBackgroundImageUri({
      variant: 'card',
      motif: 'signalClarifier',
      motifOpacity: 0.09,
      motifSide: 'left',
      palette: {
        base: '#0a1422',
        accent: '#9ecbff',
        accentSoft: '#d7ffbf',
        glow: '#18344c',
        ridge: '#3f5a71',
      },
    }),
    align: 'right',
    sideImageSource: homeSectionOwaClarityImageSource,
    sideImageAlt:
      'A clarity lens revealing transparent civic information packets through media noise.',
    visualMode: 'image',
    action: { href: '/about', label: 'About OWA', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
  {
    id: 'un',
    mainPoint: 'Like a grassroots United Nations',
    subPoints: [
      'A civilizational backchannel for humanity',
      'Local decisions and funding translate globally',
      'Cooperation is open, direct, fair, and efficient',
      'Enables global decentralized synchronization',
    ],
    backgroundImageUri: buildPublicBackgroundImageUri({
      variant: 'card',
      motif: 'distributedChamber',
      motifOpacity: 0.09,
      motifSide: 'right',
      palette: {
        base: '#0a1524',
        accent: '#9ac8ff',
        accentSoft: '#d7ffbf',
        glow: '#193a56',
        ridge: '#4a6278',
      },
    }),
    align: 'left',
    sideImageSource: homeSectionGrassrootsUnImageSource,
    sideImageAlt:
      'A decentralized global civic chamber linking local assemblies into a planetary coordination network.',
    visualMode: 'image',
    action: { href: '/docs', label: 'Read Charter', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
  {
    id: 'why-now',
    mainPoint: 'The technology exists \nWe can do better',
    subPoints: [
      'World leaders are leaving their people behind',
      'Big Tech is enslaving minds and stealing data',
      'Nations are sleepwalking toward world war 3',
      'Humanity may not get another chance to act',
    ],
    backgroundImageUri: buildPublicBackgroundImageUri({
      variant: 'card',
      motif: 'choiceCircuit',
      motifOpacity: 0.09,
      motifSide: 'left',
      palette: {
        base: '#08111d',
        accent: '#a6d6ff',
        accentSoft: '#f0d79a',
        glow: '#16324b',
        ridge: '#425b70',
      },
    }),
    align: 'right',
    sideImageSource: homeSectionBetterTechnologyImageSource,
    sideImageAlt:
      'A technological crossroads between extractive control systems and transparent civic coordination.',
    visualMode: 'image',
    action: { href: '/nexus/dashboard', label: 'Enter Nexus', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
  {
    id: 'agency',
    mainPoint: 'Unity is achievable \nNo permission required',
    subPoints: [
      'Unity is possible without forcing uniformity',
      'Alignment through consent, not decree',
      'Every voice deserves to be heard clearly',
      'Peace and prosperity for all of humanity',
    ],
    backgroundImageUri: buildPublicBackgroundImageUri({
      variant: 'card',
      motif: 'emergentNetwork',
      motifOpacity: 0.09,
      motifSide: 'right',
      palette: {
        base: '#09131f',
        accent: '#a2d5ff',
        accentSoft: '#c6d670',
        glow: '#17344d',
        ridge: '#425d73',
      },
    }),
    align: 'left',
    sideImageSource: homeSectionUnityImageSource,
    sideImageAlt:
      'Local community lights self-organizing into a peaceful global alignment network.',
    visualMode: 'image',
    action: { href: '/support', label: 'Support OWA', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
  {
    id: 'utilitarian',
    mainPoint: 'Not utopian \nUtilitarian',
    subPoints: [
      'Built for coordination under real-world pressure',
      'Useful even when people disagree',
      'Clear tools for decisions, action, and review',
      'Measure what works, repair what fails',
    ],
    backgroundImageUri: buildPublicBackgroundImageUri({
      variant: 'card',
      motif: 'choiceCircuit',
      motifOpacity: 0.09,
      motifSide: 'left',
      palette: {
        base: '#08111d',
        accent: '#a6d6ff',
        accentSoft: '#f0d79a',
        glow: '#16324b',
        ridge: '#425b70',
      },
    }),
    align: 'right',
    sideImageSource: homeSectionUtilitarianImageSource,
    sideImageAlt:
      'A practical field operations hub with maps, tools, supplies, and coordination equipment ready for use.',
    visualMode: 'image',
    action: { href: '/nexus/dashboard', label: 'Enter Nexus', variant: 'secondary' },
    mainPointScale: 'compact',
    variant: 'standard',
  },
];

export const homePageContent: HomePageContent = {
  sections,
};
