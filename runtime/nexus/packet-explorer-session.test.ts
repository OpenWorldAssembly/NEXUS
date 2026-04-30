import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closePacketExplorer,
  closePacketExplorerTab,
  createPacketExplorerRequestKey,
  createEmptyPacketExplorerSession,
  focusPacketExplorerTab,
  openPacketExplorerHome,
  openPacketExplorerPacket,
  setPacketExplorerTabViewMode,
} from './packet-explorer-session.ts';

test('opening Explorer home creates one home tab and focuses it', () => {
  const session = openPacketExplorerHome(createEmptyPacketExplorerSession());

  assert.equal(session.is_open, true);
  assert.equal(session.tabs.length, 1);
  assert.equal(session.tabs[0]?.kind, 'home');
  assert.equal(session.active_tab_id, session.tabs[0]?.id ?? null);
});

test('opening the same packet twice focuses the existing tab instead of duplicating it', () => {
  const firstSession = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:element/global-commons',
      titleSnapshot: 'Global Commons',
      seedSummary: {
        family: 'Element',
        summary: 'Global scope packet.',
        label: 'Global Commons',
      },
    }
  );
  const secondSession = openPacketExplorerPacket(firstSession, {
    packetId: 'nexus:element/global-commons',
    titleSnapshot: 'Global Commons',
    preferredRevisionId: 'nexus:element/global-commons@r2',
    seedSummary: {
      family: 'Element',
      summary: 'Updated global scope packet.',
      label: 'Global Commons',
    },
  });

  assert.equal(secondSession.tabs.length, 1);
  assert.equal(secondSession.active_tab_id, firstSession.active_tab_id);
  assert.equal(
    secondSession.tabs[0]?.preferred_revision_id,
    'nexus:element/global-commons@r2'
  );
  assert.equal(
    secondSession.tabs[0]?.seed_summary?.summary,
    'Updated global scope packet.'
  );
});

test('closing the active tab falls back to the previous remaining tab', () => {
  const homeSession = openPacketExplorerHome(createEmptyPacketExplorerSession());
  const packetSession = openPacketExplorerPacket(homeSession, {
    packetId: 'nexus:element/global-commons',
  });
  const packetTabId = packetSession.active_tab_id ?? '';
  const closedSession = closePacketExplorerTab(packetSession, packetTabId);

  assert.equal(closedSession.tabs.length, 1);
  assert.equal(closedSession.tabs[0]?.kind, 'home');
  assert.equal(closedSession.active_tab_id, closedSession.tabs[0]?.id ?? null);
});

test('view mode changes only affect the targeted tab', () => {
  const session = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:element/global-commons',
    }
  );
  const tabId = session.active_tab_id ?? '';
  const nextSession = setPacketExplorerTabViewMode(session, {
    tabId,
    viewMode: 'raw',
  });

  assert.equal(nextSession.tabs[0]?.active_view_mode, 'raw');
  assert.equal(nextSession.tabs[0]?.selected_read_mode, 'raw');
});

test('closing Explorer hides it without removing the current tabs', () => {
  const session = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:element/global-commons',
    }
  );
  const closedSession = closePacketExplorer(session);

  assert.equal(closedSession.is_open, false);
  assert.equal(closedSession.tabs.length, 1);
});

test('focusPacketExplorerTab leaves unknown tabs unchanged', () => {
  const session = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:element/global-commons',
    }
  );
  const nextSession = focusPacketExplorerTab(session, 'missing-tab');

  assert.deepEqual(nextSession, session);
});

test('request keys change only when request identity changes', () => {
  const baseKey = createPacketExplorerRequestKey({
    packetId: 'nexus:element/global-commons',
    viewerActorPacketId: 'nexus:element/guest-a',
    preferredRevisionId: 'nexus:element/global-commons@r2',
    retryNonce: 0,
  });
  const sameKey = createPacketExplorerRequestKey({
    packetId: 'nexus:element/global-commons',
    viewerActorPacketId: 'nexus:element/guest-a',
    preferredRevisionId: 'nexus:element/global-commons@r2',
    retryNonce: 0,
  });
  const retryKey = createPacketExplorerRequestKey({
    packetId: 'nexus:element/global-commons',
    viewerActorPacketId: 'nexus:element/guest-a',
    preferredRevisionId: 'nexus:element/global-commons@r2',
    retryNonce: 1,
  });

  assert.equal(baseKey, sameKey);
  assert.notEqual(baseKey, retryKey);
});
