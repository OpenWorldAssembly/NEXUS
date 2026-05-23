/**
 * File: types/location.ts
 * Description: Type-owned build rules for canonical Location packets.
 */

import type { LocationPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';

export const locationBuildDefinition: PacketTypeBuildDefinition<
  'Location',
  LocationPacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Location packets require a title.');
    }
  },
  finalizeBody: (input) => ({
    subtype: input.subtype,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status ?? 'active',
    location_label: input.location_label ?? null,
    descriptor_markdown: input.descriptor_markdown ?? null,
    spatial_payload: input.spatial_payload ?? {},
  }),
  prepareMetadataSummary: (input) =>
    input.summary ?? input.descriptor_markdown ?? null,
};
