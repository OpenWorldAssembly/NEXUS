/**
 * File: claimed-identity-session.ts
 * Description: Keeps claimed local bundle state aligned with the server-authenticated actor packet.
 */

import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import type { ActiveIdentityState } from '@runtime/nexus/identity-storage';
import type { NexusAuthSessionPayload } from '@runtime/nexus/nexus-api-types';

function getSessionActorPacket(
  session: NexusAuthSessionPayload | null | undefined
): PacketEnvelopeByType['Element'] | null {
  const actorPacket = session?.actor_packet ?? null;

  if (!actorPacket || actorPacket.body.identity?.claim_status !== 'claimed') {
    return null;
  }

  return actorPacket;
}

export function resolveClaimedSessionActorPacket(input: {
  actorPacket: PacketEnvelopeByType['Element'];
  session: NexusAuthSessionPayload | null | undefined;
}): PacketEnvelopeByType['Element'] {
  const sessionActorPacket = getSessionActorPacket(input.session);

  if (
    !sessionActorPacket ||
    sessionActorPacket.header.packet_id !== input.actorPacket.header.packet_id
  ) {
    return input.actorPacket;
  }

  return sessionActorPacket;
}

export function adoptClaimedSessionActorPacket<TIdentity extends ActiveIdentityState>(
  identity: TIdentity,
  session: NexusAuthSessionPayload | null | undefined
): TIdentity {
  const actorPacket = resolveClaimedSessionActorPacket({
    actorPacket: identity.actorPacket,
    session,
  });

  if (actorPacket.header.revision_id === identity.actorPacket.header.revision_id) {
    return identity;
  }

  const publicJwk = actorPacket.body.identity?.public_key_bindings[0]
    ?.public_jwk as JsonWebKey | undefined;

  return {
    ...identity,
    actorPacket,
    publicJwk: publicJwk ?? identity.publicJwk,
    claimStatus: actorPacket.body.identity?.claim_status ?? identity.claimStatus,
  };
}

export function assertClaimedActorPacketReady(
  actorPacket: PacketEnvelopeByType['Element']
): void {
  if (actorPacket.body.identity?.claim_status !== 'claimed') {
    return;
  }

  const signature = actorPacket.header.integrity.embedded_signatures[0];

  if (!signature) {
    throw new Error(
      'Claimed identity packet is missing its embedded signature. Refresh the session or unlock this identity again.'
    );
  }

  if (
    signature.signer_packet_ref?.packet_id &&
    signature.signer_packet_ref.packet_id !== actorPacket.header.packet_id
  ) {
    throw new Error(
      'Claimed identity packet signature signer does not match this identity. Refresh the session or unlock this identity again.'
    );
  }

  const hasActiveKeyBinding =
    actorPacket.body.identity?.public_key_bindings.some(
      (binding) => binding.kid === signature.kid && binding.status === 'active'
    ) ?? false;

  if (!hasActiveKeyBinding) {
    throw new Error(
      'Claimed identity packet signature key is not active for this identity. Refresh the session or unlock this identity again.'
    );
  }
}
