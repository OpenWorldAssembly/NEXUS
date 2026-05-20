/**
 * File: families/bundle.ts
 * Description: Family-owned build rules for canonical Bundle packets.
 */

import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import { createPacketEdge } from '@core/packets/packet-build-helpers';
import type { PacketBodyByType } from '@core/schema/packet-schema';

export const bundleBuildDefinition: PacketFamilyBuildDefinition<
  'Bundle',
  PacketBodyByType['Bundle']
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Bundle packets require a title.');
    }

    if (!input.purpose.trim()) {
      throw new Error('Bundle packets require a purpose.');
    }
  },
  prepareEdges: (input) => [
    ...input.root_refs.map((rootRef) =>
      createPacketEdge('references', rootRef, {
        source_field: 'root_refs',
      })
    ),
    ...input.items
      .map((item) => item.packet_ref)
      .filter((packetRef): packetRef is NonNullable<typeof packetRef> => packetRef !== null)
      .map((packetRef) =>
        createPacketEdge('references', packetRef, {
          source_field: 'items.packet_ref',
        })
      ),
  ],
  finalizeBody: (input) => input,
  prepareMetadataSummary: (input) => input.summary ?? input.purpose,
};
