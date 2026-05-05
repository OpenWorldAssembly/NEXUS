import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampPacketExplorerPanelWidth,
  getDefaultPacketExplorerPanelWidth,
  getPacketExplorerPanelWidthFromPointer,
  MAX_EXPLORER_PANEL_MARGIN,
  MIN_EXPLORER_PANEL_WIDTH,
} from './nexus-packet-explorer-resize-math.ts';

test('default explorer width resolves to roughly seventy percent of viewport', () => {
  assert.equal(getDefaultPacketExplorerPanelWidth(1600), 1120);
});

test('clampPacketExplorerPanelWidth enforces the minimum width', () => {
  assert.equal(
    clampPacketExplorerPanelWidth(420, 1440),
    MIN_EXPLORER_PANEL_WIDTH
  );
});

test('clampPacketExplorerPanelWidth enforces the maximum width margin', () => {
  assert.equal(
    clampPacketExplorerPanelWidth(2000, 1440),
    1440 - MAX_EXPLORER_PANEL_MARGIN
  );
});

test('getPacketExplorerPanelWidthFromPointer derives width from the viewport edge', () => {
  assert.equal(getPacketExplorerPanelWidthFromPointer(480, 1440), 960);
});
