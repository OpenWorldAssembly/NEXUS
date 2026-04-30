import test from 'node:test';
import assert from 'node:assert/strict';

import {
  closePacketExplorerTabs,
  closePacketExplorer,
  closePacketExplorerTab,
  createPacketExplorerRequestKey,
  createEmptyPacketExplorerSession,
  focusPacketExplorerTab,
  MAX_PACKET_EXPLORER_PACKET_TABS,
  openPacketExplorerHome,
  openPacketExplorerPacket,
  retargetActivePacketExplorerTab,
  setPacketExplorerPanelWidth,
  setPacketExplorerPrimaryTab,
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

  assert.equal(secondSession.tabs.length, 2);
  assert.equal(secondSession.active_tab_id, firstSession.active_tab_id);
  assert.equal(secondSession.tabs[0]?.kind, 'home');
  assert.equal(
    secondSession.tabs[1]?.preferred_revision_id,
    'nexus:element/global-commons@r2'
  );
  assert.equal(
    secondSession.tabs[1]?.seed_summary?.summary,
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

  const packetTab = nextSession.tabs.find((tab) => tab.id === tabId);

  assert.equal(packetTab?.active_primary_tab, 'data');
  assert.equal(packetTab?.selected_data_view_mode, 'raw');
  assert.equal(packetTab?.selected_read_mode, 'raw');
});

test('view mode changes preserve the active primary tab', () => {
  const openedSession = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:element/global-commons',
    }
  );
  const tabId = openedSession.active_tab_id ?? '';
  const session = setPacketExplorerPrimaryTab(openedSession, {
    tabId,
    primaryTab: 'links',
  });
  const nextSession = setPacketExplorerTabViewMode(session, {
    tabId,
    viewMode: 'read_model',
  });
  const packetTab = nextSession.tabs.find((tab) => tab.id === tabId);

  assert.equal(packetTab?.active_primary_tab, 'links');
  assert.equal(packetTab?.selected_data_view_mode, 'read_model');
});

test('primary tab changes only affect the targeted tab', () => {
  const session = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:element/global-commons',
    }
  );
  const tabId = session.active_tab_id ?? '';
  const nextSession = setPacketExplorerPrimaryTab(session, {
    tabId,
    primaryTab: 'links',
  });

  const packetTab = nextSession.tabs.find((tab) => tab.id === tabId);

  assert.equal(packetTab?.active_primary_tab, 'links');
  assert.equal(packetTab?.selected_data_view_mode, 'summary');
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
  assert.equal(closedSession.tabs.length, 2);
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

test('packet tabs retain independent primary tabs and data lenses', () => {
  const firstSession = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:discussion-thread/first',
      titleSnapshot: 'First',
    }
  );
  const firstTabId = firstSession.active_tab_id ?? '';
  const secondSession = openPacketExplorerPacket(firstSession, {
    packetId: 'nexus:discussion-thread/second',
    titleSnapshot: 'Second',
  });
  const secondTabId = secondSession.active_tab_id ?? '';
  const configuredFirst = setPacketExplorerPrimaryTab(
    setPacketExplorerTabViewMode(
      focusPacketExplorerTab(secondSession, firstTabId),
      {
        tabId: firstTabId,
        viewMode: 'read_model',
      }
    ),
    {
      tabId: firstTabId,
      primaryTab: 'actions',
    }
  );
  const configuredSecond = setPacketExplorerPrimaryTab(
    setPacketExplorerTabViewMode(
      focusPacketExplorerTab(configuredFirst, secondTabId),
      {
        tabId: secondTabId,
        viewMode: 'adapted',
      }
    ),
    {
      tabId: secondTabId,
      primaryTab: 'links',
    }
  );

  const firstTab = configuredSecond.tabs.find((tab) => tab.id === firstTabId);
  const secondTab = configuredSecond.tabs.find((tab) => tab.id === secondTabId);

  assert.equal(firstTab?.active_primary_tab, 'actions');
  assert.equal(firstTab?.selected_data_view_mode, 'read_model');
  assert.equal(secondTab?.active_primary_tab, 'links');
  assert.equal(secondTab?.selected_data_view_mode, 'adapted');
});

test('retargeting the active packet tab preserves inspector state', () => {
  const openedSession = openPacketExplorerPacket(
    createEmptyPacketExplorerSession(),
    {
      packetId: 'nexus:discussion-thread/original',
      titleSnapshot: 'Original',
    }
  );
  const tabId = openedSession.active_tab_id ?? '';
  const session = setPacketExplorerPrimaryTab(
    setPacketExplorerTabViewMode(openedSession, {
      tabId,
      viewMode: 'adapted',
    }),
    {
      tabId,
      primaryTab: 'links',
    }
  );
  const retargetedSession = retargetActivePacketExplorerTab(session, {
    packetId: 'nexus:discussion-thread/linked',
    preferredRevisionId: 'nexus:discussion-thread/linked@r4',
    titleSnapshot: 'Linked',
    seedSummary: {
      family: 'DiscussionThread',
      summary: 'Linked packet.',
      label: 'Linked',
    },
  });

  assert.equal(retargetedSession.tabs.length, 2);
  const packetTab = retargetedSession.tabs.find((tab) => tab.id === tabId);

  assert.equal(packetTab?.packet_id, 'nexus:discussion-thread/linked');
  assert.equal(packetTab?.active_primary_tab, 'links');
  assert.equal(packetTab?.selected_data_view_mode, 'adapted');
});

test('opening the first packet auto-creates a leftmost home tab', () => {
  const session = openPacketExplorerPacket(createEmptyPacketExplorerSession(), {
    packetId: 'nexus:discussion-thread/example',
    titleSnapshot: 'Example',
  });

  assert.equal(session.tabs.length, 2);
  assert.equal(session.tabs[0]?.kind, 'home');
  assert.equal(session.tabs[1]?.kind, 'packet');
});

test('closePacketExplorerTabs preserves or recreates the home tab', () => {
  const opened = openPacketExplorerPacket(createEmptyPacketExplorerSession(), {
    packetId: 'nexus:discussion-thread/example',
    titleSnapshot: 'Example',
  });
  const closed = closePacketExplorerTabs(opened);

  assert.equal(closed.tabs.length, 1);
  assert.equal(closed.tabs[0]?.kind, 'home');
  assert.equal(closed.active_tab_id, closed.tabs[0]?.id ?? null);
});

test('opening past the packet-tab cap preserves existing tabs and adds a notice', () => {
  let session = createEmptyPacketExplorerSession();

  for (let index = 0; index < MAX_PACKET_EXPLORER_PACKET_TABS; index += 1) {
    session = openPacketExplorerPacket(session, {
      packetId: `nexus:discussion-thread/${index}`,
      titleSnapshot: `Thread ${index}`,
    });
  }

  const capped = openPacketExplorerPacket(session, {
    packetId: 'nexus:discussion-thread/capped',
    titleSnapshot: 'Capped',
  });

  const packetTabCount = capped.tabs.filter((tab) => tab.kind === 'packet').length;

  assert.equal(packetTabCount, MAX_PACKET_EXPLORER_PACKET_TABS);
  assert.match(capped.notice ?? '', /tab cap/i);
});

test('panel width persists inside the session model', () => {
  const session = setPacketExplorerPanelWidth(
    openPacketExplorerPacket(createEmptyPacketExplorerSession(), {
      packetId: 'nexus:discussion-thread/example',
      titleSnapshot: 'Example',
    }),
    860
  );

  assert.equal(session.panel_width, 860);
});
