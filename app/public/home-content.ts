/**
 * File: home-content.ts
 * Description: Stores the homepage hero and supporting card copy.
 */
import type { PublicPageAction } from '@app/components/public/public-page-actions';
import type { PublicHeroAction, PublicHeroSlide, PublicPrinciple } from './content-types';
import { buildHeroBackgroundImageUri } from './public-graphics';

export type HomeSupportingCard = {
  eyebrow: string;
  title: string;
  body: string;
  actions?: PublicHeroAction[];
};

export type HomePageContent = {
  principlesEyebrow: string;
  heroSlides: PublicHeroSlide[];
  principles: PublicPrinciple[];
  heroActions: PublicPageAction[];
  supportingCards: HomeSupportingCard[];
  actions?: PublicHeroAction[];
};


const heroActions: PublicPageAction[] = [
  { href: '/about', label: 'Learn More', variant: 'secondary' },
  { href: '/docs', label: 'Read the Charter', variant: 'secondary' },
  { href: '/support', label: 'Support Development', variant: 'secondary' },
  { href: '/nexus/dashboard', label: 'Browse the Nexus', variant: 'primary' },
];

const supportingCards: HomeSupportingCard[] = [
  {
    eyebrow: 'Built for real communities',
    title: 'Start where people already are',
    body:
      'Neighborhoods, cities, regions, and larger networks can all use the same democratic pattern without giving power to a permanent center.',
  },
  {
    eyebrow: 'More than discussion',
    title: 'Keep deliberation tied to action',
    body:
      'Discussion, decisions, records, and follow-through stay linked instead of scattering across disconnected apps, feeds, and forgotten threads.',
  },
];

export const publicHeroSlides: PublicHeroSlide[] = [
  {
    eyebrow: 'Open World Assembly',
    title: "It's time to unite.",
    body: 'Cooperation is overdue.',
    kicker: 'Why this matters',
    detail:
      'Humanity already has the communications infrastructure. What is missing is an open democratic coordination layer people can actually use.',
    backgroundImageUri: buildHeroBackgroundImageUri({
      base: '#0b1626',
      accent: '#6dd3ff',
      accentSoft: '#d7ffbf',
      glow: '#19344a',
      ridge: '#35546d',
    }),
    actions: [{ href: '/about', label: 'Learn More', variant: 'primary' }],
  },
  {
    eyebrow: 'From local to global',
    title: 'Direct participation at every scale.',
    body: 'Local voice, global alignment.',
    kicker: 'What this enables',
    detail:
      'Communities can deliberate and act where they are, while linking upward into larger patterns of coordination without losing local context.',
    backgroundImageUri: buildHeroBackgroundImageUri({
      base: '#0b1423',
      accent: '#8ec5ff',
      accentSoft: '#d7ffbf',
      glow: '#173651',
      ridge: '#41596d',
    }),
    actions: [{ href: '/about', label: 'Explore the Vision', variant: 'primary' }],
  },
  {
    eyebrow: 'The question now',
    title: 'The technology now exists.',
    body: 'The question is how we use it.',
    kicker: 'The real choice',
    detail:
      'The same tools that can centralize control can also distribute coordination, memory, and accountability more widely than ever before.',
    backgroundImageUri: buildHeroBackgroundImageUri({
      base: '#09131f',
      accent: '#8ec5ff',
      accentSoft: '#d7ffbf',
      glow: '#183a56',
      ridge: '#466176',
    }),
    actions: [{ href: '/about', label: 'See the Framework', variant: 'primary' }],
  },
  {
    eyebrow: 'Explore OWA',
    title: 'Learn how it works.',
    body: 'Explore the vision. See the framework.',
    kicker: 'Next steps',
    detail:
      'The About page goes deeper into the structure, purpose, and design logic behind the Open World Assembly.',
    backgroundImageUri: buildHeroBackgroundImageUri({
      base: '#09131e',
      accent: '#8ec5ff',
      accentSoft: '#f7d995',
      glow: '#1a3550',
      ridge: '#41596d',
    }),
    actions: [
      { href: '/about', label: 'Learn More', variant: 'primary' },
      { href: '/about', label: 'Explore the Vision', variant: 'secondary' },
      { href: '/about', label: 'See the Framework', variant: 'secondary' },
    ],
  },
];

export const publicPrinciples: PublicPrinciple[] = [];

export const homePageContent: HomePageContent = {
  principlesEyebrow: 'Antifragile direct democracy',
  heroSlides: publicHeroSlides,
  principles: publicPrinciples,
  heroActions,
  supportingCards,
};
