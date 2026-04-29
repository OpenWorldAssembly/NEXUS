/**
 * File: families/role.ts
 * Description: Family-owned build rules for canonical Role packets.
 */

import type { RolePacketInput } from '@core/packets/builders';
import type { PacketFamilyBuildDefinition } from '@core/packets/packet-build-pipeline';

export const roleBuildDefinition: PacketFamilyBuildDefinition<'Role', RolePacketInput> = {
  validateBody: (input) => {
    if (!input.title.trim()) {
      throw new Error('Role packets require a title.');
    }
  },
  finalizeBody: (input) => ({
    title: input.title,
    summary: input.summary ?? null,
    role_kind: input.role_kind,
    status: input.status,
    responsibility_markdown: input.responsibility_markdown ?? null,
  }),
  prepareMetadataSummary: (input) => input.summary ?? null,
};
