/**
 * File: public-graphics.ts
 * Description: SVG background helpers for the public-site content modules.
 */

export type PublicBackgroundMotif =
  | 'none'
  | 'assembly'
  | 'social'
  | 'global'
  | 'choice'
  | 'agency';

export type PublicBackgroundMotifSide = 'left' | 'right';

export type PublicBackgroundVariant = 'hero' | 'section' | 'panel' | 'card';

export type PublicBackgroundPalette = {
  base: string;
  accent: string;
  accentSoft: string;
  glow: string;
  ridge: string;
};

export type PublicBackgroundOptions = {
  variant?: PublicBackgroundVariant;
  motif?: PublicBackgroundMotif;
  palette?: Partial<PublicBackgroundPalette>;
  motifOpacity?: number;
  motifSide?: PublicBackgroundMotifSide;
};

type PublicBackgroundVariantSettings = {
  backgroundStartOpacity: number;
  backgroundMidOpacity: number;
  glowOpacity: number;
  accentGlowOpacity: number;
  waveOpacity: number;
  softWaveOpacity: number;
  ridgeOpacity: number;
  motifOpacity: number;
  glowRadius: string;
  accentGlowRadius: string;
};

type HeroPalette = PublicBackgroundPalette;
type AboutPalette = PublicBackgroundPalette;

const DEFAULT_PUBLIC_BACKGROUND_PALETTE: PublicBackgroundPalette = {
  base: '#09131f',
  accent: '#8ec5ff',
  accentSoft: '#d7ffbf',
  glow: '#173651',
  ridge: '#466176',
};

const PUBLIC_BACKGROUND_VARIANT_SETTINGS: Record<PublicBackgroundVariant, PublicBackgroundVariantSettings> = {
  hero: {
    backgroundStartOpacity: 0.92,
    backgroundMidOpacity: 0.82,
    glowOpacity: 0.22,
    accentGlowOpacity: 0.14,
    waveOpacity: 0.16,
    softWaveOpacity: 0.07,
    ridgeOpacity: 0.055,
    motifOpacity: 0.07,
    glowRadius: '26%',
    accentGlowRadius: '20%',
  },
  section: {
    backgroundStartOpacity: 0.58,
    backgroundMidOpacity: 0.5,
    glowOpacity: 0.16,
    accentGlowOpacity: 0.12,
    waveOpacity: 0.12,
    softWaveOpacity: 0.06,
    ridgeOpacity: 0.045,
    motifOpacity: 0.075,
    glowRadius: '24%',
    accentGlowRadius: '18%',
  },
  panel: {
    backgroundStartOpacity: 0.64,
    backgroundMidOpacity: 0.54,
    glowOpacity: 0.16,
    accentGlowOpacity: 0.1,
    waveOpacity: 0.1,
    softWaveOpacity: 0.05,
    ridgeOpacity: 0.04,
    motifOpacity: 0.065,
    glowRadius: '24%',
    accentGlowRadius: '18%',
  },
  card: {
    backgroundStartOpacity: 0.5,
    backgroundMidOpacity: 0.44,
    glowOpacity: 0.12,
    accentGlowOpacity: 0.08,
    waveOpacity: 0.08,
    softWaveOpacity: 0.04,
    ridgeOpacity: 0.032,
    motifOpacity: 0.055,
    glowRadius: '22%',
    accentGlowRadius: '16%',
  },
};

function resolvePublicBackgroundPalette(
  palette: Partial<PublicBackgroundPalette> = {},
): PublicBackgroundPalette {
  return {
    ...DEFAULT_PUBLIC_BACKGROUND_PALETTE,
    ...palette,
  };
}

function clampOpacity(opacity: number) {
  return Math.max(0, Math.min(opacity, 0.22));
}

function positionPublicBackgroundMotifSvg(motifSvg: string, motifSide: PublicBackgroundMotifSide) {
  if (!motifSvg || motifSide === 'right') {
    return motifSvg;
  }

  return `<g transform="translate(1600 0) scale(-1 1)">${motifSvg}</g>`;
}

function buildPublicBackgroundMotifSvg(
  motif: PublicBackgroundMotif,
  palette: PublicBackgroundPalette,
  motifOpacity: number,
) {
  const opacity = clampOpacity(motifOpacity);

  if (motif === 'none') {
    return '';
  }

  if (motif === 'assembly') {
    return `
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="1160" cy="430" r="250" />
        <path d="M910 430 C 980 320, 1060 270, 1160 270 C 1260 270, 1340 320, 1410 430" />
        <path d="M910 430 C 980 540, 1060 590, 1160 590 C 1260 590, 1340 540, 1410 430" />
        <path d="M1160 180 C 1110 285, 1090 355, 1090 430 C 1090 505, 1110 575, 1160 680" />
        <path d="M1160 180 C 1210 285, 1230 355, 1230 430 C 1230 505, 1210 575, 1160 680" />
      </g>
      <g opacity="${opacity + 0.035}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.4">
        <circle cx="990" cy="315" r="8" />
        <circle cx="1090" cy="260" r="6" />
        <circle cx="1218" cy="262" r="7" />
        <circle cx="1326" cy="330" r="6" />
        <circle cx="1386" cy="450" r="8" />
        <circle cx="1288" cy="566" r="6" />
        <circle cx="1158" cy="600" r="7" />
        <circle cx="1026" cy="548" r="6" />
        <circle cx="936" cy="438" r="7" />
      </g>
    `;
  }

  if (motif === 'social') {
    return `
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <rect x="930" y="210" width="230" height="72" rx="18" />
        <rect x="1010" y="328" width="300" height="82" rx="20" />
        <rect x="900" y="466" width="250" height="76" rx="18" />
        <path d="M1160 246 C 1228 270, 1276 304, 1310 356" />
        <path d="M1150 504 C 1224 496, 1302 456, 1360 400" />
        <path d="M1242 408 C 1276 470, 1334 530, 1418 584" />
      </g>
      <g opacity="${opacity + 0.025}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.2">
        <circle cx="1328" cy="366" r="7" />
        <circle cx="1382" cy="404" r="5" />
        <circle cx="1422" cy="584" r="7" />
        <circle cx="1470" cy="634" r="4" />
        <circle cx="1236" cy="500" r="5" />
      </g>
    `;
  }

  if (motif === 'global') {
    return `
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.7" stroke-linecap="round">
        <path d="M900 250 C 1060 190, 1270 190, 1460 250" />
        <path d="M840 410 C 1030 350, 1280 350, 1520 410" />
        <path d="M880 590 C 1070 650, 1280 650, 1480 590" />
        <path d="M1160 150 C 1070 310, 1070 520, 1160 730" />
        <path d="M1160 150 C 1250 310, 1250 520, 1160 730" />
        <path d="M800 490 C 1010 420, 1240 430, 1540 520" />
      </g>
      <g opacity="${opacity + 0.03}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.2">
        <circle cx="970" cy="390" r="6" />
        <circle cx="1088" cy="330" r="5" />
        <circle cx="1210" cy="382" r="7" />
        <circle cx="1342" cy="452" r="5" />
        <circle cx="1278" cy="560" r="6" />
        <circle cx="1120" cy="610" r="5" />
      </g>
    `;
  }

  if (motif === 'choice') {
    return `
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M890 510 C 1010 510, 1060 470, 1134 410 C 1220 340, 1300 294, 1450 280" />
        <path d="M890 510 C 1010 510, 1070 548, 1142 610 C 1232 688, 1322 726, 1480 730" />
        <path d="M1128 412 C 1180 430, 1224 454, 1260 486" />
        <path d="M1140 608 C 1200 584, 1266 576, 1338 592" />
        <path d="M1260 486 C 1310 532, 1360 552, 1448 556" />
      </g>
      <g opacity="${opacity + 0.025}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.2">
        <circle cx="890" cy="510" r="8" />
        <circle cx="1134" cy="410" r="6" />
        <circle cx="1142" cy="610" r="6" />
        <circle cx="1260" cy="486" r="5" />
        <circle cx="1450" cy="280" r="7" />
        <circle cx="1480" cy="730" r="7" />
      </g>
    `;
  }

  return `
    <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="1110" cy="500" r="80" />
      <circle cx="1110" cy="500" r="150" />
      <circle cx="1110" cy="500" r="230" />
      <path d="M1110 500 C 1200 450, 1280 390, 1360 300" />
      <path d="M1110 500 C 1214 540, 1318 586, 1450 660" />
      <path d="M1110 500 C 1002 450, 930 380, 850 280" />
      <path d="M1110 500 C 1016 570, 930 630, 820 690" />
    </g>
    <g opacity="${opacity + 0.03}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.2">
      <circle cx="1110" cy="500" r="8" />
      <circle cx="1218" cy="440" r="5" />
      <circle cx="1360" cy="300" r="7" />
      <circle cx="1308" cy="584" r="5" />
      <circle cx="1450" cy="660" r="7" />
      <circle cx="964" cy="414" r="5" />
      <circle cx="850" cy="280" r="7" />
      <circle cx="930" cy="630" r="5" />
      <circle cx="820" cy="690" r="7" />
    </g>
  `;
}

/**
 * Inputs: public background artwork options, including variant, palette, and optional motif.
 * Output: a data URI pointing to reusable generated public-site SVG artwork.
 */
export function buildPublicBackgroundImageUri(options: PublicBackgroundOptions = {}) {
  const variant = options.variant ?? 'section';
  const motif = options.motif ?? 'none';
  const palette = resolvePublicBackgroundPalette(options.palette);
  const settings = PUBLIC_BACKGROUND_VARIANT_SETTINGS[variant];
  const motifSvg = positionPublicBackgroundMotifSvg(
    buildPublicBackgroundMotifSvg(
      motif,
      palette,
      options.motifOpacity ?? settings.motifOpacity,
    ),
    options.motifSide ?? 'right',
  );

  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 980">
      <defs>
        <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${palette.base}" stop-opacity="${settings.backgroundStartOpacity}" />
          <stop offset="55%" stop-color="#02070c" stop-opacity="${settings.backgroundMidOpacity}" />
          <stop offset="100%" stop-color="#000000" />
        </linearGradient>
        <radialGradient id="glowA" cx="24%" cy="22%" r="${settings.glowRadius}">
          <stop offset="0%" stop-color="${palette.glow}" stop-opacity="${settings.glowOpacity}" />
          <stop offset="100%" stop-color="${palette.glow}" stop-opacity="0" />
        </radialGradient>
        <radialGradient id="glowB" cx="78%" cy="30%" r="${settings.accentGlowRadius}">
          <stop offset="0%" stop-color="${palette.accentSoft}" stop-opacity="${settings.accentGlowOpacity}" />
          <stop offset="100%" stop-color="${palette.accentSoft}" stop-opacity="0" />
        </radialGradient>
      </defs>

      <rect width="1600" height="980" fill="url(#bg)" />
      <rect width="1600" height="980" fill="url(#glowA)" />
      <rect width="1600" height="980" fill="url(#glowB)" />

      <g opacity="${settings.waveOpacity}" fill="none" stroke="${palette.accent}" stroke-width="2">
        <path d="M-80 250 C 180 210, 360 340, 560 410 C 700 458, 820 472, 960 452 C 1140 426, 1320 318, 1700 260" />
        <path d="M-60 340 C 190 300, 390 398, 580 458 C 730 504, 860 514, 1010 494 C 1190 468, 1370 390, 1710 330" />
        <path d="M-40 700 C 220 740, 400 646, 610 584 C 760 540, 880 526, 1020 544 C 1200 566, 1380 660, 1710 720" />
        <path d="M-80 810 C 180 844, 380 750, 590 684 C 760 630, 900 614, 1060 636 C 1240 662, 1420 748, 1700 800" />
      </g>

      <g opacity="${settings.softWaveOpacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.5">
        <path d="M-40 430 C 220 418, 430 470, 650 490 C 820 505, 980 498, 1170 474 C 1360 450, 1510 430, 1700 438" />
        <path d="M-20 548 C 220 560, 430 516, 650 498 C 830 484, 980 490, 1170 516 C 1380 544, 1530 560, 1700 554" />
      </g>

      <g opacity="${settings.ridgeOpacity}" fill="none" stroke="${palette.ridge}" stroke-width="3">
        <path d="M-60 150 C 240 190, 520 140, 780 210 C 1060 286, 1300 260, 1700 150" />
        <path d="M-40 880 C 260 830, 520 900, 820 820 C 1090 748, 1340 780, 1700 900" />
      </g>

      ${motifSvg}
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/**
 * Inputs: a small palette for the generated hero background artwork.
 * Output: a data URI pointing to an abstract SVG image for the hero slider.
 */
export function buildHeroBackgroundImageUri(palette: HeroPalette) {
  return buildPublicBackgroundImageUri({
    variant: 'hero',
    motif: 'none',
    palette,
  });
}

/**
 * Inputs: a color palette for the generated about-section background artwork.
 * Output: a data URI pointing to an abstract SVG image for a single about section.
 */
export function buildAboutBackgroundImageUri(palette: AboutPalette) {
  return buildPublicBackgroundImageUri({
    variant: 'section',
    motif: 'none',
    palette,
  });
}
