/**
 * File: families/definition.ts
 * Description: Family-owned build rules for canonical Definition packets.
 */

import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import type { PacketBodyByType } from '@core/schema/packet-schema';

export const definitionBuildDefinition: PacketFamilyBuildDefinition<
  'Definition',
  PacketBodyByType['Definition']
> = {
  validateBody: (input) => {
    if (!input.defines_packet_type.trim()) {
      throw new Error('Definition packets require defines_packet_type.');
    }
  },
  finalizeBody: (input) => input,
  prepareMetadataSummary: (input) => input.summary,
};
