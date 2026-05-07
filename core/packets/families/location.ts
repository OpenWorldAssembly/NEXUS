/**
 * File: families/location.ts
 * Description: Family-owned build rules for canonical Location packets.
 */

import type { LocationPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';

export const locationBuildDefinition: PacketFamilyBuildDefinition<
  'Location',
  LocationPacketInput
> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Location packets require a title.');
    }
  },
  finalizeBody: (input) => ({
    type: 'location',
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
