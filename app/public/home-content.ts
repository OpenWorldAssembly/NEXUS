/**
 * File: home-content.ts
 * Description: Stores the homepage hero, principle, and supporting card copy.
 */
import type { Href } from 'expo-router';
import type { PublicPageAction } from '@app/components/public/public-page-actions';
import type { PublicHeroSlide, PublicPrinciple } from './content-types';
import { buildHeroBackgroundImageUri } from './public-graphics';

export type HomeSupportingCard = {
  eyebrow: string;
  title: string;
  body: string;
};

export type HomePageContent = {
  principlesEyebrow: string;
  heroSlides: PublicHeroSlide[];
  principles: PublicPrinciple[];
  heroActions: PublicPageAction[];
  supportingCards: HomeSupportingCard[];
};

const heroActions: PublicPageAction[] = [
  { href: '/about' as Href, label: 'Learn More', variant: 'secondary' },
  { href: '/docs' as Href, label: 'Read the Charter', variant: 'secondary' },
  { href: '/support' as Href, label: 'Support Development', variant: 'secondary' },
  { href: '/nexus/dashboard' as Href, label: 'Browse the Nexus', variant: 'primary' },
];

const supportingCards: HomeSupportingCard[] = [
  {
    eyebrow: 'Built for real communities',
    title: 'Local legitimacy can grow into wider coordination',
    body:
      'OWA starts where people already live and work. Neighborhoods, cities, regions, and larger scales can all use the same democratic pattern without handing power to a permanent center.',
  },
  {
    eyebrow: 'More than discussion',
    title: 'Deliberation, decisions, action, and memory stay connected',
    body:
      'The aim is not another feed or petition tool. It is a durable democratic process that can carry shared intent from public reasoning into visible commitments and real-world follow-through.',
  },
];

export const publicHeroSlides: PublicHeroSlide[] = [
  {
    eyebrow: 'Open World Assembly',
    title: 'A democratic coordination layer for humanity.',
    body:
      'Open World Assembly is a decentralized, fractal system of direct democracy that enables people to coordinate, deliberate, and make decisions together at any scale, from local to global, without centralized control.',
    kicker: 'A future worth building',
    detail:
      'Independent assemblies stay autonomous while still participating in broader alignment, shared learning, and collective action.',
    backgroundImageUri: buildHeroBackgroundImageUri({
      base: '#0f2332',
      accent: '#6dd3ff',
      accentSoft: '#d7ffbf',
      glow: '#245d7d',
    }),
  },
  {
    eyebrow: 'Antifragile civic design',
    title: 'Direct democracy that gets stronger as more people participate.',
    body:
      'OWA is built so coordination can grow through consent, not command. Local action and larger-scale alignment reinforce each other instead of competing for legitimacy.',
    kicker: 'Built to scale without centralization',
    detail:
      'The same assembly pattern can repeat from neighborhoods to planetary coordination without requiring a single ruling center.',
    backgroundImageUri: buildHeroBackgroundImageUri({
      base: '#1a2333',
      accent: '#9fe870',
      accentSoft: '#f7d995',
      glow: '#4d6931',
    }),
  },
  {
    eyebrow: 'From signal to action',
    title: 'A system for deliberation, decisions, records, and real-world follow-through.',
    body:
      'OWA is not just a place to discuss. It is meant to connect public reasoning with proposals, decisions, missions, and durable civic memory so communities can keep learning together.',
    kicker: 'Coordination without command',
    detail:
      'The point is not top-down control. The point is making shared intent visible enough that people can act on it together.',
    backgroundImageUri: buildHeroBackgroundImageUri({
      base: '#221c2f',
      accent: '#f7d995',
      accentSoft: '#6dd3ff',
      glow: '#5e395d',
    }),
  },
];

export const publicPrinciples: PublicPrinciple[] = [
  {
    title: 'Decentralized by design',
    body: 'No central authority. No single point of control. Power remains distributed across independent assemblies.',
  },
  {
    title: 'Aligned through consent',
    body: 'Shared direction emerges from participation, not enforcement. Agreement is built, not imposed.',
  },
  {
    title: 'Synchronized at scale',
    body: 'Local decisions connect into broader coordination, enabling collective action without sacrificing autonomy.',
  },
];

export const homePageContent: HomePageContent = {
  principlesEyebrow: 'Antifragile direct democracy',
  heroSlides: publicHeroSlides,
  principles: publicPrinciples,
  heroActions,
  supportingCards,
};
