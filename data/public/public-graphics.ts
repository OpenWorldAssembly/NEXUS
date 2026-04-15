/**
 * File: public-graphics.ts
 * Description: SVG background helpers for the public-site content modules.
 */

type HeroPalette = {
  base: string;
  accent: string;
  accentSoft: string;
  glow: string;
};

type AboutPalette = HeroPalette & {
  ridge: string;
};

/**
 * Inputs: a small palette for the generated hero background artwork.
 * Output: a data URI pointing to an abstract SVG image for the hero slider.
 */
export function buildHeroBackgroundImageUri(palette: HeroPalette) {
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
export function buildAboutBackgroundImageUri(palette: AboutPalette) {
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

      <g opacity="0.045" fill="none" stroke="${palette.ridge}" stroke-width="3">
        <path d="M-60 150 C 240 190, 520 140, 780 210 C 1060 286, 1300 260, 1700 150" />
        <path d="M-40 880 C 260 830, 520 900, 820 820 C 1090 748, 1340 780, 1700 900" />
      </g>
    </svg>
  `;

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}
