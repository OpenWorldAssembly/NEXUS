/**
 * File: types/preference.ts
 * Description: Type-owned build rules for canonical Preference packets.
 */

import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import type { PacketBodyByType } from '@core/schema/packet-schema';

export const preferenceBuildDefinition: PacketTypeBuildDefinition<
  'Preference',
  PacketBodyByType['Preference']
> = {
  validateBody: (input) => {
    if (!input.owner_ref.packet_id) {
      throw new Error('Preference packets require owner_ref.');
    }
  },
  finalizeBody: (input) => input,
  prepareMetadataSummary: (input) =>
    `Preference ${input.subtype} for ${input.owner_ref.packet_id}`,
};
