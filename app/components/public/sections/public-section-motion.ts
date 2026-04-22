/**
 * File: public-section-motion.ts
 * Description: Shared scroll progress helpers for animated public-facing section cards.
 */

/**
 * Inputs: scroll offset, section top/height, and viewport height.
 * Output: a normalized 0..1 progress value centered around the viewport midpoint.
 */
export function getSectionProgress(
  scrollY: number,
  sectionTop: number,
  sectionHeight: number,
  viewportHeight: number,
) {
  if (viewportHeight <= 0) {
    return 0;
  }

  const viewportMidpoint = scrollY + viewportHeight * 0.5;
  const sectionMidpoint = sectionTop + sectionHeight * 0.5;
  const sectionRange = Math.max(sectionHeight, viewportHeight) * 0.6;
  const distance = Math.abs(sectionMidpoint - viewportMidpoint);

  return Math.max(0, 1 - distance / sectionRange);
}
