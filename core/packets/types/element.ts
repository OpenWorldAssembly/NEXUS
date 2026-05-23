/**
 * File: types/element.ts
 * Description: Type-owned build rules for canonical Element packets.
 */

import type { ElementPacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';
import {
  getCanonicalElementSubtype,
  type ElementSubtype,
} from '@core/schema/packet-schema';

function normalizeIdentity(input: ElementPacketInput) {
  if (!input.identity) {
    return null;
  }

  return {
    alias: input.identity.alias,
    claim_status: input.identity.claim_status,
    location_disclosure: input.identity.location_disclosure ?? null,
    public_key_bindings: (input.identity.public_key_bindings ?? []).map(
      (binding) => ({
        kid: binding.kid,
        alg: binding.alg,
        kty: binding.kty,
        crv: binding.crv ?? null,
        public_jwk: binding.public_jwk,
        status: binding.status ?? 'active',
        added_at: binding.added_at,
        revoked_at: binding.revoked_at ?? null,
      })
    ),
  };
}

export const elementBuildDefinition: PacketTypeBuildDefinition<
  'Element',
  ElementPacketInput
> = {
  finalizeBody: (input) => {
    const canonicalSubtype = getCanonicalElementSubtype({
      subtype: input.subtype ?? null,
    });

    if (!canonicalSubtype) {
      throw new Error('Element packets require a canonical subtype.');
    }

    return {
      subtype: canonicalSubtype as ElementSubtype,
      name: input.name,
      summary: input.summary ?? null,
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
