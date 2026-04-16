/**
 * File: about-content.ts
 * Description: Content source for the public about route.
 */

import type { AboutSection } from './content-types';
import { buildAboutBackgroundImageUri } from './public-graphics';

export type AboutPageContent = {
  railTitle: string;
  railSubtitle: string;
  sections: AboutSection[];
  header: string;
};

export const aboutSections: AboutSection[] = [
  {
    id: 'what-it-is',
    eyebrow: 'Civilizational Backchannel',
    headline: 'What It Is',
    summary:
      'Open World Assembly is a decentralized system that lets people coordinate and make decisions together at any scale, locally to globally, without centralized control, creating a shared layer of direct participation that can align humanity toward peace, freedom, and fair representation.',
    highlights: [
      {
        title: 'OPEN',
        body: 'Anyone can participate directly. The system is designed to be accessible by default, without requiring permission or infrastructure.',
      },
      {
        title: 'WORLD',
        body: 'OWA is fractal, extending from local communities to cities, nations, and the planet as a whole, allowing coordination to scale without losing local context.',
      },
      {
        title: 'ASSEMBLY',
        body: 'Participants can deliberate, vote, take action, and affect change together through open assemblies rooted in real communities.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#102233',
      accent: '#6dd3ff',
      accentSoft: '#d7ffbf',
      glow: '#245d7d',
      ridge: '#16354d',
    }),
  },
  {
    id: 'why-now',
    eyebrow: 'Our Moment in History',
    headline: 'Why Now',
    summary:
      'Humanity is at a critical point in history where accelerating technology, failing representation, and rising global tension are converging. The trajectory of our civilization, and possibly our long-term survival, now depends on our ability to coordinate as a species.',
    highlights: [
      {
        title: 'ACCELERATING TECHNOLOGY',
        body: 'Technology is advancing at an exponential pace and can either be used to enslave humanity or to set it free, and that decision is ours to make.',
      },
      {
        title: 'BREAKDOWN OF REPRESENTATION',
        body: 'Traditional systems are increasingly unresponsive to the will of their people. Trust is eroding, and true representation is becoming harder to find.',
      },
      {
        title: 'ESCALATING GLOBAL RISK',
        body: 'Geopolitical tensions continue to rise worldwide, driven by generations of Cold War propaganda and decades of deep-state military posturing.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#1a1f2e',
      accent: '#ff9b6a',
      accentSoft: '#ffd6bf',
      glow: '#6a3f2f',
      ridge: '#2a2f44',
    }),
  },
  {
    id: 'vision',
    eyebrow: 'A Future Worth Building',
    headline: 'The Vision',
    summary:
      'The goal is to improve existing systems peacefully from within while building the capacity to evolve beyond them. As coordination strengthens, every person can gain a meaningful democratic voice, and humanity can begin to cooperate as a species without centralized control.',
    highlights: [
      {
        title: 'RENEWAL FROM WITHIN',
        body: 'Communities can use open coordination to restore representation, reduce corruption, and make systems accountable to the will of their people.',
      },
      {
        title: 'ALIGNMENT OF NATIONS',
        body: 'Nations can begin to align around the shared principles and coordination of their people, reducing conflict and enabling cooperation at a global scale.',
      },
      {
        title: 'CONTINUED EVOLUTION',
        body: 'Over time, more effective forms of coordination can reduce reliance on legacy structures, allowing new systems to emerge through natural transition.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#241f2f',
      accent: '#f7d995',
      accentSoft: '#9fe870',
      glow: '#704f7d',
      ridge: '#3a3043',
    }),
  },
  {
    id: 'how-it-works',
    eyebrow: 'What Makes It Work',
    headline: 'Structure',
    summary:
      'OWA combines a fractal coordination framework, a decentralized data system, and open community assemblies to enable alignment, communication, and action at any scale. Together, these layers allow people to coordinate across environments without relying on centralized control.',
    highlights: [
      {
        title: 'COORDINATION',
        body: 'A fractal coordination framework enables groups to make decisions, align, and synchronize actions across scales without forcing uniformity or central authority.',
      },
      {
        title: 'RESILIENCE',
        body: 'A decentralized data system ensures that information can be stored, shared, and synchronized across environments, including low-connectivity and hostile conditions.',
      },
      {
        title: 'COMMUNITIES',
        body: 'OWA provides open geographic assemblies, allowing anyone to instantly join and participate in their local, regional, national, and international communities.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#1a2333',
      accent: '#9fe870',
      accentSoft: '#f7d995',
      glow: '#4d6931',
      ridge: '#2d3044',
    }),
  },
  {
    id: 'fcf',
    eyebrow: 'Fractal Alignment',
    headline: 'Coordination',
    summary:
      'OWA uses a fractal framework to enable alignment without uniformity and coordination without control at any scale. Groups can make fair, ethical, and practical decisions, take effective action, learn and adapt, and synchronize across boundaries without losing local autonomy.',
    highlights: [
      {
        title: 'FAIR DECISIONS',
        body: 'Communities make decisions through open participation, supported by balanced processes that integrate practical needs, ethical considerations, and collective voice.',
      },
      {
        title: 'EFFECTIVE ACTION',
        body: 'Ideas become structured work through shared planning and coordination, allowing groups to move from discussion to real-world execution without chaos.',
      },
      {
        title: 'SCALABLE ALIGNMENT',
        body: 'Independent groups can align on specific issues across regions and contexts without central control, allowing coordination to expand without forcing uniformity.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#162734',
      accent: '#9fe870',
      accentSoft: '#f7d995',
      glow: '#395f3a',
      ridge: '#1d3a35',
    }),
  },
  {
    id: 'nexus',
    eyebrow: 'Antifragile Systems',
    headline: 'Resilience',
    summary:
      'OWA uses a decentralized data system to enable antifragile coordination in a wide range of conditions, including low-connectivity and hostile environments. Information can be stored, shared, and synchronized without relying on a central platform or stable infrastructure.',
    highlights: [
      {
        title: 'PORTABLE DATA',
        body: 'All coordination is stored as structured data packet bundles that can be shared, inspected, and reused across independent systems instead of being locked into a single platform.',
      },
      {
        title: 'LOCAL FIRST',
        body: 'Each system node can operate independently, storing data locally and synchronizing with others when possible, rather than depending on connectivity with other nodes.',
      },
      {
        title: 'ADAPTIVE NETWORK',
        body: 'The system is designed to function across high bandwidth, low bandwidth, intermittent connectivity, and offline environments without losing coordination capability.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#202033',
      accent: '#6dd3ff',
      accentSoft: '#f7d995',
      glow: '#473f75',
      ridge: '#2f3150',
    }),
  },
  {
    id: 'communities',
    eyebrow: 'Multi-Level Participation',
    headline: 'Communities',
    summary:
      'OWA enables a continuous cycle of discussion, decision, and action across a global network of communities, allowing people to participate directly at every level. Local activity contributes to broader alignment, making coordination visible, scalable, and grounded in real-world participation.',
    highlights: [
      {
        title: 'OPEN ASSEMBLIES',
        body: 'People engage through their local, regional, national, and global assemblies, discussing issues, proposing ideas, and participating in decisions that affect their shared environments.',
      },
      {
        title: 'SHARED SIGNALS',
        body: 'Signals flow across scopes, geographies, and initiatives, allowing local decisions to contribute to a broader shared understanding and enabling alignment to emerge organically.',
      },
      {
        title: 'SYNCHRONIZED ACTION',
        body: 'Aligned communities can act in parallel, where many small, local efforts converge into larger coordinated outcomes, multiplying impact across regions and scales.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#1f2a2f',
      accent: '#6dd3ff',
      accentSoft: '#9fe870',
      glow: '#3f6f75',
      ridge: '#2a3f44',
    }),
  },
  {
    id: 'roadmap',
    eyebrow: 'Implementation Priorities',
    headline: 'Roadmap',
    summary:
      'OWA is being developed and distributed in stages, with a focus on proving the system in practice and expanding it through open collaboration. As adoption grows across communities and environments, coordination can scale until it reaches a critical mass capable of reshaping how humanity organizes and acts.',
    highlights: [
      {
        title: 'BETA TESTING',
        body: 'The immediate focus is building toward a public open beta, where the system can be tested in real conditions and refined through active use. Estimated release: July 4, 2026',
      },
      {
        title: 'OPEN DEVELOPMENT',
        body: 'The system will be open-source, enabling contributions, independent deployments, and decentralized adoption across different communities and use cases.',
      },
      {
        title: 'DISTRIBUTED ADOPTION',
        body: 'As usage grows, the system can spread across platforms and environments. By the time it becomes a target, it is already distributed, allowing coordination to persist and expand.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#1f2a2f',
      accent: '#f7d995',
      accentSoft: '#6dd3ff',
      glow: '#5a6f7a',
      ridge: '#2f3f44',
    }),
  },
  {
    id: 'onboarding',
    eyebrow: 'Getting Started',
    headline: 'Onboarding',
    summary:
      'OWA is entering a phase of early access, open development, and distributed adoption. These entry points allow you to understand the system, explore it directly, or help accelerate its development.',
    highlights: [
      {
        title: 'FOUNDING CHARTER',
        body: 'The charter defines the principles, structure, and intent behind OWA, serving as a concise and durable foundation for the system.',
        href: '/docs',
        cta: 'Read',
        color: 'sand',
      },
      {
        title: 'EARLY ACCESS NEXUS',
        body: 'The Nexus is the live participation layer where assemblies, proposals, and coordination take shape in real environments.',
        href: '/nexus/dashboard',
        cta: 'Explore',
        color: 'cyan',
      },
      {
        title: 'SUPPORT DEVELOPMENT',
        body: 'Support helps accelerate infrastructure, design, and deployment, enabling the system to grow and reach real-world scale faster.',
        href: '/support',
        cta: 'Accelerate',
        color: 'accent',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#1f2a2f',
      accent: '#6dd3ff',
      accentSoft: '#9fe870',
      glow: '#3f6f75',
      ridge: '#2a3f44',
    }),
  },
];

export const aboutPageContent: AboutPageContent = {
  railTitle: 'About OWA',
  railSubtitle:
    'Open - Local - Global',
  sections: aboutSections,
  header: ''
};
