/**
 * File: families/element.ts
 * Description: Family-owned build rules for canonical Element packets.
 */

import type { ElementPacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';
import {
  getCanonicalElementSubtype,
  getElementKindFromSubtype,
} from '@core/schema/packet-schema';

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
  finalizeBody: (input) => {
    const canonicalSubtype = getCanonicalElementSubtype({
      kind: input.kind ?? null,
      subtype: input.subtype ?? null,
    });
    const compatibilityKind = getElementKindFromSubtype({
      subtype: canonicalSubtype,
      fallbackKind: input.kind ?? null,
    });

    if (!compatibilityKind) {
      throw new Error('Element packets require a recognizable kind or canonical subtype.');
    }

    return {
      type: 'element',
      kind: compatibilityKind,
      name: input.name,
      subtype: canonicalSubtype,
      summary: input.summary ?? null,
      scope_kind: input.scope_kind ?? null,
      scope_system: input.scope_system ?? null,
      status: input.status ?? null,
      aliases: input.aliases ?? [],
      display_aliases: input.display_aliases ?? [],
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
      custody_hints: input.custody_hints ?? null,
      tags: input.tags ?? [],
      claimed_role_refs: input.claimed_role_refs ?? [],
    };
  },
  prepareMetadataSummary: (input) => input.summary ?? null,
};
