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

export type AboutSection = {
  id: string;
  title: string;
  summary: string;
  points: string[];
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
    id: 'foundation',
    title: 'Foundation',
    summary:
      'OWA is a democratic coordination layer built to help people deliberate, decide, and act together without centralized command.',
    points: [
      'It is a civic substrate rather than a sovereign replacement for existing institutions.',
      'Its goal is coordination without command and unity without uniformity across different communities and scales.',
      'The public site explains the model, while the portal will eventually support active participation.',
    ],
  },
  {
    id: 'assemblies',
    title: 'Fractal assemblies',
    summary:
      'The same assembly pattern repeats from neighborhood to world scale so local legitimacy can connect into larger coordination.',
    points: [
      'Assemblies are geographic-first and rooted in real places and real participants.',
      'Each level keeps full democratic capacity instead of acting as a symbolic layer beneath a central authority.',
      'Teams, nodes, and other overlays can coordinate work, but they do not replace assembly legitimacy.',
    ],
  },
  {
    id: 'consent',
    title: 'Consent and legitimacy',
    summary:
      'OWA treats legitimacy as something that emerges from visible participation and consent, not coercion or inherited office.',
    points: [
      'Trust is layered and probabilistic rather than a simple verified versus unverified switch.',
      'Identity continuity matters, but public exposure should not be mandatory for participation.',
      'Influence can be shaped by local grounding, relationship history, and demonstrated credibility.',
    ],
  },
  {
    id: 'coordination',
    title: 'Coordination loop',
    summary:
      'The system follows a simple civic loop that lets communities sense reality, deliberate, act, learn, and adapt.',
    points: [
      'Sense, think, act, learn, and adapt is the repeating operational pattern.',
      'Proposals, decisions, actions, and records are meant to form a durable civic memory rather than disappear into feeds.',
      'Large-scale coordination should emerge from connected local decisions rather than top-down instruction.',
    ],
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
