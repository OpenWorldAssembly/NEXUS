/**
 * File: public-site-content.ts
 * Description: Defines the shared public-site copy and section data for the OWA landing, about, and charter pages.
 */

export type PublicPrinciple = {
  title: string;
  body: string;
};

export type PublicHeroSlide = {
  eyebrow: string;
  title: string;
  body: string;
  kicker: string;
  detail: string;
  backgroundImageUri: string;
};

import type { Href } from 'expo-router';

export type AboutHighlight = {
  title: string;
  body: string;
  href?: Href;
  cta?: string;
  color?: 'sand' | 'cyan' | 'accent';
};

export type AboutSection = {
  id: string;
  title: string;
  eyebrow: string;
  headline: string;
  summary: string;
  highlights: AboutHighlight[];
  backgroundImageUri: string;
};

export type CharterResource = {
  title: string;
  status: string;
  body: string;
};

type HeroPalette = {
  base: string;
  accent: string;
  accentSoft: string;
  glow: string;
};

type AboutPalette = {
  base: string;
  accent: string;
  accentSoft: string;
  glow: string;
  ridge: string;
};

/**
 * Inputs: a small palette for the generated hero background artwork.
 * Output: a data URI pointing to an abstract SVG image for the hero slider.
 */
function buildHeroBackgroundImageUri(palette: HeroPalette) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 960">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.base}" />
          <stop offset="100%" stop-color="#07111c" />
        </linearGradient>
        <radialGradient id="glowA" cx="25%" cy="22%" r="45%">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.72" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="78%" cy="30%" r="42%">
          <stop offset="0%" stop-color="${palette.accentSoft}" stop-opacity="0.46" />
          <stop offset="100%" stop-color="${palette.accentSoft}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="1600" height="960" fill="url(#bg)" />
      <rect width="1600" height="960" fill="url(#glowA)" />
      <rect width="1600" height="960" fill="url(#glowB)" />

      <g opacity="0.32" fill="none" stroke="${palette.accent}" stroke-width="2">
        <path d="M-80 760 C 180 560, 420 900, 760 700 S 1280 520, 1680 760" />
        <path d="M-40 640 C 220 460, 500 720, 860 560 S 1320 420, 1680 620" />
        <path d="M140 860 C 420 620, 730 950, 1070 760 S 1440 640, 1700 820" />
      </g>

      <g opacity="0.18" fill="${palette.accentSoft}">
        <circle cx="260" cy="240" r="110" />
        <circle cx="1290" cy="220" r="88" />
        <circle cx="1190" cy="730" r="156" />
      </g>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Inputs: a color palette for the generated about-section background artwork.
 * Output: a data URI pointing to an abstract SVG image for a single about section.
 */
function buildAboutBackgroundImageUri(palette: AboutPalette) {  
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 980">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.base}" stop-opacity="0.58" />
          <stop offset="55%" stop-color="#02070c" stop-opacity="0.5" />
          <stop offset="100%" stop-color="#000000" />
        </linearGradient>
        <radialGradient id="glowA" cx="24%" cy="22%" r="24%">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.16" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="78%" cy="30%" r="18%">
          <stop offset="0%" stop-color="${palette.accentSoft}" stop-opacity="0.12" />
          <stop offset="100%" stop-color="${palette.accentSoft}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="1600" height="980" fill="url(#bg)" />
      <rect width="1600" height="980" fill="url(#glowA)" />
      <rect width="1600" height="980" fill="url(#glowB)" />

      <g opacity="0.12" fill="none" stroke="${palette.accent}" stroke-width="2">
        <path d="M-80 250 C 180 210, 360 340, 560 410 C 700 458, 820 472, 960 452 C 1140 426, 1320 318, 1700 260" />
        <path d="M-60 340 C 190 300, 390 398, 580 458 C 730 504, 860 514, 1010 494 C 1190 468, 1370 390, 1710 330" />
        <path d="M-40 700 C 220 740, 400 646, 610 584 C 760 540, 880 526, 1020 544 C 1200 566, 1380 660, 1710 720" />
        <path d="M-80 810 C 180 844, 380 750, 590 684 C 760 630, 900 614, 1060 636 C 1240 662, 1420 748, 1700 800" />
      </g>

      <g opacity="0.06" fill="none" stroke="${palette.accentSoft}" stroke-width="1.5">
        <path d="M-40 430 C 220 418, 430 470, 650 490 C 820 505, 980 498, 1170 474 C 1360 450, 1510 430, 1700 438" />
        <path d="M-20 548 C 220 560, 430 516, 650 498 C 830 484, 980 490, 1170 516 C 1380 544, 1530 560, 1700 554" />
      </g>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

export const publicHeroSlides: PublicHeroSlide[] = [
  {
    eyebrow: 'Open World Assembly',
    title: 'A democratic coordination layer for humanity.',
    body: 'Open World Assembly is a decentralized, fractal system of direct democracy that enables people to coordinate, deliberate, and make decisions together at any scale, from local to global, without centralized control.',
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
    body: 'OWA is built so coordination can grow through consent, not command. Local action and larger-scale alignment reinforce each other instead of competing for legitimacy.',
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
    body: 'OWA is not just a place to discuss. It is meant to connect public reasoning with proposals, decisions, missions, and durable civic memory so communities can keep learning together.',
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

export const aboutSections: AboutSection[] = [
  {
  id: 'what-it-is',
  title: 'What It Is',
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
  title: 'Why Now',
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
  title: 'The Vision',
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
  title: 'Structure',
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
  title: 'Coordination',
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
  title: 'Resilience',
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
  title: 'Communities',
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
  title: 'Roadmap',
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
  title: 'Onboarding',
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
      href: '/docs',
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



export const charterResources: CharterResource[] = [
  {
    title: 'Charter',
    status: 'In drafting',
    body: 'This route is now reserved for the public charter. It will become the concise statement of OWA principles, commitments, and structural invariants.',
  },
  {
    title: 'Canon',
    status: 'Current source',
    body: 'The canon currently holds the clearest statement of OWA intent, legitimacy model, fractal structure, and democratic posture.',
  },
  {
    title: 'Implementation guide',
    status: 'Working reference',
    body: 'The implementation guide captures practical architecture decisions, current route structure, and the long-term system model.',
  },
  {
    title: 'Workspace notes',
    status: 'Reference material',
    body: 'Workspace material informs the broader explanation surface and can feed future charter and about-page refinements.',
  },
];
