/**
 * File: families/element.ts
 * Description: Family-owned build rules for canonical Element packets.
 */

import type { ElementPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';

function normalizeIdentity(input: ElementPacketInput) {
  if (!input.identity) {
    return null;
  }

  return {
    alias: input.identity.alias,
    claim_status: input.identity.claim_status,
    location_disclosure: input.identity.location_disclosure ?? null,
    public_key_bindings: input.identity.public_key_bindings ?? [],
  };
}

export const elementBuildDefinition: PacketFamilyBuildDefinition<
  'Element',
  ElementPacketInput
> = {
  finalizeBody: (input) => ({
    kind: input.kind,
    name: input.name,
    subtype: input.subtype ?? null,
    summary: input.summary ?? null,
    locality_label: input.locality_label ?? null,
    locality: input.locality
      ? {
          level: input.locality.level,
          canonical_name_key: input.locality.canonical_name_key,
          alias_keys: input.locality.alias_keys ?? [],
          display_aliases: input.locality.display_aliases ?? [],
        }
      : null,
    identity: normalizeIdentity(input),
    tags: input.tags ?? [],
    claimed_role_refs: input.claimed_role_refs ?? [],
  }),
  prepareMetadataSummary: (input) => input.summary ?? null,
};
