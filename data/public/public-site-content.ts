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

export type AboutHighlight = {
  title: string;
  body: string;
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

      <g opacity="0.74" fill="${palette.accent}">
        <rect x="970" y="180" width="360" height="14" rx="7" />
        <rect x="1020" y="246" width="250" height="14" rx="7" />
        <rect x="1085" y="312" width="170" height="14" rx="7" />
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
          <stop offset="0%" stop-color="${palette.base}" />
          <stop offset="100%" stop-color="#07111c" />
        </linearGradient>
        <radialGradient id="glowA" cx="20%" cy="18%" r="52%">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="0.7" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="82%" cy="24%" r="44%">
          <stop offset="0%" stop-color="${palette.accentSoft}" stop-opacity="0.4" />
          <stop offset="100%" stop-color="${palette.accentSoft}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="1600" height="980" fill="url(#bg)" />
      <rect width="1600" height="980" fill="url(#glowA)" />
      <rect width="1600" height="980" fill="url(#glowB)" />

      <g opacity="0.22" fill="none" stroke="${palette.accent}" stroke-width="2">
        <path d="M-80 640 C 220 460, 430 720, 760 560 S 1260 420, 1700 620" />
        <path d="M-60 760 C 220 560, 520 860, 860 700 S 1360 560, 1710 760" />
      </g>

      <g opacity="0.36" fill="${palette.ridge}">
        <path d="M0 780 C180 740 320 660 480 670 C650 680 760 760 930 750 C1110 740 1260 630 1440 660 C1515 672 1568 694 1600 710 L1600 980 L0 980 Z" />
        <path d="M0 860 C200 820 350 760 520 770 C700 782 830 848 1010 838 C1168 830 1340 758 1520 780 C1552 784 1580 790 1600 798 L1600 980 L0 980 Z" />
      </g>

      <g opacity="0.2" fill="${palette.accentSoft}">
        <circle cx="1220" cy="260" r="122" />
        <circle cx="360" cy="220" r="84" />
      </g>

      <g opacity="0.78" fill="${palette.accent}">
        <rect x="970" y="210" width="320" height="14" rx="7" />
        <rect x="1015" y="280" width="240" height="14" rx="7" />
        <rect x="1080" y="350" width="170" height="14" rx="7" />
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
    id: 'what-is-owa',
    title: 'What OWA Is',
    eyebrow: 'The basic proposition',
    headline: 'A parallel democratic layer for coordination at any scale.',
    summary:
      'Open World Assembly is a decentralized, fractal system of direct democracy built so people can coordinate, deliberate, and make decisions together from local communities to planetary alignment without centralized control.',
    highlights: [
      {
        title: 'Direct by default',
        body: 'Participation stays open and direct as the baseline, without requiring a permanent political intermediary to carry a person’s voice.',
      },
      {
        title: 'Consent made visible',
        body: 'Shared direction emerges from public participation and visible consent rather than command, coercion, or opaque bargaining.',
      },
      {
        title: 'Lawful and nonviolent',
        body: 'The project is framed as peaceful, adaptive cooperation that expands representation without relying on destabilizing force.',
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
    id: 'substrate',
    title: 'Substrate, Not Sovereignty',
    eyebrow: 'What OWA is not',
    headline: 'It coordinates people without becoming a new ruling center.',
    summary:
      'OWA is not a shadow government, a centralized command hierarchy, or a replacement superstate. It is designed as a civic substrate that strengthens what works, exposes misalignment, and supports reform through clarity rather than confrontation.',
    highlights: [
      {
        title: 'Not a shadow government',
        body: 'The system does not seize authority or depend on existing institutions granting it permission to exist.',
      },
      {
        title: 'Works alongside institutions',
        body: 'It is meant to add democratic visibility and coordination capacity while preserving continuity in the broader civic landscape.',
      },
      {
        title: 'Coordination without command',
        body: 'Its influence is intended to come from legitimacy, alignment, and usefulness rather than enforcement power.',
      },
    ],
    backgroundImageUri: buildAboutBackgroundImageUri({
      base: '#1b2233',
      accent: '#f7d995',
      accentSoft: '#6dd3ff',
      glow: '#6a5b2f',
      ridge: '#2d3044',
    }),
  },
  {
    id: 'assemblies',
    title: 'Fractal Assemblies',
    eyebrow: 'The structural pattern',
    headline: 'The same democratic grammar repeats from neighborhood to world.',
    summary:
      'Assemblies are geographic-first and structurally consistent across scale, so local legitimacy can connect into larger coordination without being overridden by it.',
    highlights: [
      {
        title: 'Geographic-first legitimacy',
        body: 'Real people in real places remain the grounding layer from which wider coordination becomes credible and resilient.',
      },
      {
        title: 'Autonomous but compatible',
        body: 'Each assembly can function meaningfully on its own while still connecting into broader patterns of alignment.',
      },
      {
        title: 'Overlays remain secondary',
        body: 'Teams, nodes, and other abstract groupings can coordinate work, but they do not replace assembly legitimacy.',
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
    id: 'alignment',
    title: 'Local Voice, Global Alignment',
    eyebrow: 'How scale works',
    headline: 'Local decisions can contribute to wider coordination without losing context.',
    summary:
      'OWA is designed around a local expression of consent that can propagate across relevant scales. Delegation, where used, is optional, revocable, and subordinate to direct participation.',
    highlights: [
      {
        title: 'One signal across scales',
        body: 'The system is built so local participation can inform broader coordination without forcing duplicate political machinery at every level.',
      },
      {
        title: 'Revocable delegation',
        body: 'Delegation is a bandwidth tool, not a permanent transfer of sovereignty, and it remains optional wherever it exists.',
      },
      {
        title: 'Human-scale alignment',
        body: 'The goal is to keep decisions as local as possible while still making larger-scale coordination structurally possible.',
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
    id: 'action',
    title: 'Action, Memory, Adaptation',
    eyebrow: 'What the system does',
    headline: 'Discussion should lead to proposals, action, records, and learning.',
    summary:
      'OWA follows a recurring loop of sense, think, act, learn, and adapt. Public memory and iterative improvement make the model stronger as more people participate in it.',
    highlights: [
      {
        title: 'From signal to follow-through',
        body: 'The point is not endless discussion but a visible path from collective reasoning into proposals, decisions, missions, and reform.',
      },
      {
        title: 'Durable civic memory',
        body: 'Decisions, votes, and records are meant to stay auditable and legible so communities can build on what they have learned.',
      },
      {
        title: 'Antifragile by participation',
        body: 'The system is designed to gain clarity through use, adapting to context and strengthening as more assemblies engage.',
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
