import assert from 'node:assert/strict';
import test from 'node:test';

import { trustedProjectionCoordinator } from './trusted_projection_coordinator/index.ts';

test('trusted projection projects preselected packet card lists', () => {
  const result = trustedProjectionCoordinator.resolvePacketCardListProjection({
    cards: [
      {
        packet: { packet_id: 'nexus:element/test-card' },
        revision: {
          packet_id: 'nexus:element/test-card',
          revision_id: 'rev:test-card',
        },
        type: 'Element',
        title: 'Test Card',
        label: 'Element',
        summary: 'Projected without owning query selection.',
        status: 'active',
        created_at: '2026-05-28T00:00:00.000Z',
        verification: null,
      },
    ],
    target_surface: 'test_surface',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.projection_kind, 'trusted.packet_card_list_projection');
  assert.equal(result.value?.total_count, 1);
  assert.equal(result.value?.items[0]?.item_kind, 'trusted.packet_card_projection_item');
  assert.equal(result.value?.items[0]?.title, 'Test Card');
  assert.equal(result.value?.items[0]?.source_card.title, 'Test Card');
});

test('trusted projection accepts empty preselected packet card lists', () => {
  const result = trustedProjectionCoordinator.resolvePacketCardListProjection({
    cards: [],
    target_surface: 'test_surface',
  });

  assert.equal(result.status, 'ok');
  assert.equal(result.value?.projection_kind, 'trusted.packet_card_list_projection');
  assert.equal(result.value?.total_count, 0);
  assert.deepEqual(result.value?.items, []);
});
