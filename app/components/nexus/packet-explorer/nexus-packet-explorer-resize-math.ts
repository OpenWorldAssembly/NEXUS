export const EXPLORER_DESKTOP_BREAKPOINT = 1100;
export const DEFAULT_EXPLORER_PANEL_WIDTH_RATIO = 0.7;
export const MIN_EXPLORER_PANEL_WIDTH = 720;
export const MAX_EXPLORER_PANEL_MARGIN = 32;

export function clampPacketExplorerPanelWidth(
  panelWidth: number,
  viewportWidth: number
): number {
  const maxWidth = Math.max(
    MIN_EXPLORER_PANEL_WIDTH,
    viewportWidth - MAX_EXPLORER_PANEL_MARGIN
  );

  return Math.min(Math.max(panelWidth, MIN_EXPLORER_PANEL_WIDTH), maxWidth);
}

export function getDefaultPacketExplorerPanelWidth(
  viewportWidth: number
): number {
  return clampPacketExplorerPanelWidth(
    viewportWidth * DEFAULT_EXPLORER_PANEL_WIDTH_RATIO,
    viewportWidth
  );
}

export function getPacketExplorerPanelWidthFromPointer(
  pointerClientX: number,
  viewportWidth: number
): number {
  return clampPacketExplorerPanelWidth(viewportWidth - pointerClientX, viewportWidth);
}
