/**
 * File: public-graphics.ts
 * Description: SVG background helpers for the public-site content modules.
 */

export type PublicBackgroundMotif =
  | 'none'
  | 'civicLattice'
  | 'signalClarifier'
  | 'distributedChamber'
  | 'choiceCircuit'
  | 'emergentNetwork'
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
type AboutPalette = Partial<PublicBackgroundPalette>;

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
  const faintOpacity = clampOpacity(opacity * 0.72);
  const nodeOpacity = clampOpacity(opacity + 0.045);
  const pulseOpacity = clampOpacity(opacity + 0.025);

  if (motif === 'none') {
    return '';
  }

  if (motif === 'civicLattice' || motif === 'assembly') {
    return `
      <g opacity="${faintOpacity}" fill="none" stroke="${palette.ridge}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
        <path d="M835 682 C 980 590, 1140 550, 1322 570 C 1405 580, 1488 606, 1562 646" />
        <path d="M892 246 C 1028 194, 1210 190, 1374 240 C 1444 262, 1508 294, 1570 338" />
        <path d="M890 326 C 1050 292, 1254 296, 1470 368" />
        <path d="M848 590 C 1030 512, 1240 500, 1526 554" />
        <path d="M1164 184 C 1098 330, 1088 514, 1152 716" />
        <path d="M1164 184 C 1268 342, 1292 520, 1224 734" />
      </g>
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="1196" cy="456" r="274" />
        <circle cx="1196" cy="456" r="188" />
        <circle cx="1196" cy="456" r="92" />
        <path d="M922 456 C 1008 348, 1100 306, 1196 306 C 1294 306, 1386 348, 1470 456" />
        <path d="M922 456 C 1008 564, 1100 606, 1196 606 C 1294 606, 1386 564, 1470 456" />
        <path d="M1008 302 C 1078 408, 1082 512, 1018 614" />
        <path d="M1388 302 C 1318 408, 1314 512, 1378 614" />
      </g>
      <g opacity="${pulseOpacity}" fill="none" stroke="${palette.accent}" stroke-width="1.45" stroke-linecap="round">
        <path d="M896 476 C 996 408, 1096 392, 1196 456 C 1302 524, 1408 506, 1508 436" />
        <path d="M964 646 C 1088 566, 1212 562, 1352 646" />
      </g>
      <g opacity="${nodeOpacity}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.15">
        <circle cx="936" cy="454" r="7" />
        <circle cx="1008" cy="302" r="5" />
        <circle cx="1092" cy="388" r="5" />
        <circle cx="1196" cy="306" r="7" />
        <circle cx="1298" cy="388" r="5" />
        <circle cx="1388" cy="302" r="5" />
        <circle cx="1460" cy="456" r="8" />
        <circle cx="1378" cy="614" r="5" />
        <circle cx="1196" cy="606" r="7" />
        <circle cx="1018" cy="614" r="5" />
        <circle cx="1196" cy="456" r="5" />
      </g>
    `;
  }

  if (motif === 'signalClarifier' || motif === 'social') {
    return `
      <g opacity="${faintOpacity}" fill="none" stroke="${palette.ridge}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
        <path d="M880 258 L922 244 L956 268 L996 238 L1038 272" />
        <path d="M904 624 L940 602 L980 630 L1026 592 L1072 620" />
        <path d="M884 392 L936 410 L982 384 L1028 418 L1082 398" />
        <path d="M922 512 L986 488 L1032 536 L1098 502" />
      </g>
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
        <rect x="870" y="198" width="196" height="62" rx="15" />
        <rect x="920" y="314" width="258" height="70" rx="18" />
        <rect x="860" y="456" width="220" height="66" rx="16" />
        <rect x="958" y="610" width="188" height="58" rx="15" />
        <path d="M1072 230 C 1160 244, 1234 286, 1298 356" />
        <path d="M1178 350 C 1236 368, 1290 398, 1342 446" />
        <path d="M1080 490 C 1170 492, 1266 468, 1362 416" />
        <path d="M1146 640 C 1238 610, 1328 546, 1436 438" />
      </g>
      <g opacity="${pulseOpacity}" fill="none" stroke="${palette.accent}" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1158 510 C 1238 506, 1320 468, 1418 380" />
        <path d="M1248 314 C 1320 354, 1384 392, 1464 410" />
        <path d="M1304 592 C 1364 540, 1420 492, 1498 460" />
      </g>
      <g opacity="${nodeOpacity}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.1">
        <circle cx="1160" cy="510" r="5" />
        <circle cx="1248" cy="314" r="5" />
        <circle cx="1304" cy="592" r="5" />
        <circle cx="1342" cy="446" r="6" />
        <circle cx="1418" cy="380" r="8" />
        <circle cx="1464" cy="410" r="5" />
        <circle cx="1498" cy="460" r="7" />
      </g>
    `;
  }

  if (motif === 'distributedChamber' || motif === 'global') {
    return `
      <g opacity="${faintOpacity}" fill="none" stroke="${palette.ridge}" stroke-width="1.4" stroke-linecap="round">
        <ellipse cx="1190" cy="552" rx="386" ry="122" />
        <ellipse cx="1190" cy="552" rx="282" ry="84" />
        <ellipse cx="1190" cy="552" rx="174" ry="48" />
        <path d="M804 552 C 930 434, 1048 370, 1190 370 C 1332 370, 1452 434, 1576 552" />
        <path d="M884 628 C 1010 708, 1370 710, 1500 628" />
      </g>
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.85" stroke-linecap="round" stroke-linejoin="round">
        <circle cx="1190" cy="430" r="86" />
        <path d="M1012 552 C 1050 480, 1114 430, 1190 430 C 1266 430, 1330 480, 1368 552" />
        <path d="M930 552 C 1000 398, 1110 314, 1190 314 C 1270 314, 1380 398, 1450 552" />
        <path d="M1190 314 L1190 640" />
        <path d="M962 474 C 1082 518, 1284 520, 1420 474" />
        <path d="M914 590 C 1062 634, 1314 636, 1468 590" />
      </g>
      <g opacity="${pulseOpacity}" fill="none" stroke="${palette.accent}" stroke-width="1.5" stroke-linecap="round">
        <path d="M930 552 C 994 524, 1048 498, 1110 466" />
        <path d="M1270 464 C 1338 500, 1396 528, 1450 552" />
        <path d="M1048 634 C 1140 594, 1242 594, 1336 634" />
      </g>
      <g opacity="${nodeOpacity}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.15">
        <circle cx="930" cy="552" r="6" />
        <circle cx="1012" cy="552" r="5" />
        <circle cx="1048" cy="634" r="5" />
        <circle cx="1110" cy="466" r="5" />
        <circle cx="1190" cy="430" r="8" />
        <circle cx="1270" cy="464" r="5" />
        <circle cx="1336" cy="634" r="5" />
        <circle cx="1368" cy="552" r="5" />
        <circle cx="1450" cy="552" r="6" />
      </g>
    `;
  }

  if (motif === 'choiceCircuit' || motif === 'choice') {
    return `
      <g opacity="${faintOpacity}" fill="none" stroke="${palette.ridge}" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">
        <rect x="1278" y="236" width="172" height="96" rx="16" />
        <rect x="1334" y="640" width="150" height="84" rx="14" />
        <path d="M1320 254 L1396 314" />
        <path d="M1320 314 L1396 254" />
        <path d="M1362 658 L1454 706" />
      </g>
      <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M862 504 C 984 504, 1056 468, 1136 406 C 1220 340, 1306 294, 1452 284" />
        <path d="M862 504 C 982 504, 1056 546, 1138 610 C 1234 686, 1340 722, 1510 724" />
        <path d="M1136 406 C 1190 424, 1242 456, 1288 500" />
        <path d="M1138 610 C 1204 584, 1272 578, 1342 596" />
        <path d="M1288 500 C 1342 540, 1404 554, 1492 552" />
      </g>
      <g opacity="${pulseOpacity}" fill="none" stroke="${palette.accent}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
        <path d="M1010 504 C 1110 492, 1228 434, 1384 332" />
        <path d="M1010 504 C 1108 536, 1226 584, 1410 592" />
        <path d="M1160 398 L1160 326 L1216 326" />
        <path d="M1174 618 L1174 692 L1234 692" />
      </g>
      <g opacity="${nodeOpacity}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.15">
        <circle cx="862" cy="504" r="8" />
        <circle cx="1010" cy="504" r="5" />
        <circle cx="1136" cy="406" r="6" />
        <circle cx="1138" cy="610" r="6" />
        <circle cx="1288" cy="500" r="5" />
        <circle cx="1384" cy="332" r="6" />
        <circle cx="1452" cy="284" r="8" />
        <circle cx="1410" cy="592" r="5" />
        <circle cx="1510" cy="724" r="8" />
      </g>
    `;
  }

  return `
    <g opacity="${faintOpacity}" fill="none" stroke="${palette.ridge}" stroke-width="1.25" stroke-linecap="round" stroke-linejoin="round">
      <path d="M820 736 C 990 672, 1162 650, 1350 678 C 1444 692, 1514 716, 1574 746" />
      <path d="M916 704 C 1022 624, 1122 564, 1216 500" />
      <path d="M1066 704 C 1170 606, 1268 522, 1386 408" />
      <path d="M1240 704 C 1300 610, 1370 548, 1480 486" />
    </g>
    <g opacity="${opacity}" fill="none" stroke="${palette.accentSoft}" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round">
      <circle cx="1138" cy="500" r="82" />
      <circle cx="1138" cy="500" r="154" />
      <circle cx="1138" cy="500" r="236" />
      <path d="M1138 500 C 1226 454, 1300 394, 1388 302" />
      <path d="M1138 500 C 1242 546, 1356 596, 1492 664" />
      <path d="M1138 500 C 1030 458, 950 392, 862 292" />
      <path d="M1138 500 C 1038 574, 942 640, 820 704" />
      <path d="M942 640 C 1090 610, 1236 616, 1356 596" />
    </g>
    <g opacity="${pulseOpacity}" fill="none" stroke="${palette.accent}" stroke-width="1.5" stroke-linecap="round">
      <path d="M820 704 C 956 658, 1046 580, 1138 500 C 1230 420, 1318 358, 1388 302" />
      <path d="M942 640 C 1054 590, 1230 592, 1492 664" />
    </g>
    <g opacity="${nodeOpacity}" fill="${palette.accent}" stroke="${palette.accentSoft}" stroke-width="1.15">
      <circle cx="1138" cy="500" r="8" />
      <circle cx="1226" cy="454" r="5" />
      <circle cx="1388" cy="302" r="8" />
      <circle cx="1300" cy="596" r="5" />
      <circle cx="1492" cy="664" r="8" />
      <circle cx="986" cy="416" r="5" />
      <circle cx="862" cy="292" r="8" />
      <circle cx="942" cy="640" r="5" />
      <circle cx="820" cy="704" r="8" />
      <circle cx="916" cy="704" r="4" />
      <circle cx="1066" cy="704" r="4" />
      <circle cx="1240" cy="704" r="4" />
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
 * Inputs: a color palette for generated about-card background artwork.
 * Output: a data URI pointing to abstract SVG card artwork for a single about section.
 */
export function buildAboutBackgroundImageUri(palette: AboutPalette) {
  return buildPublicBackgroundImageUri({
    variant: 'card',
    motif: 'none',
    palette,
  });
}
