/**
 * File: types/role.ts
 * Description: Type-owned build rules for canonical Role packets.
 */

import type { RolePacketInput } from '@core/packets/builders';
import type { PacketTypeBuildDefinition } from '@core/packets/packet-build-pipeline';

export const roleBuildDefinition: PacketTypeBuildDefinition<'Role', RolePacketInput> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Role packets require a title.');
    }
  },
  finalizeBody: (input) => ({
    subtype: input.subtype,
    title: input.title,
    summary: input.summary ?? null,
    status: input.status,
    responsibility_markdown: input.responsibility_markdown ?? null,
  }),
  prepareMetadataSummary: (input) => input.summary ?? null,
};
