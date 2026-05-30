/**
 * File: mutation-digests.ts
 * Description: Builds canonical unsigned packet digests for the Dispatch-owned mutation corridor.
 */

import { canonicalizeJson, sha256Base64Url } from '@core/crypto/canonical-json';
import {
  getPacketSignatureCanonicalCandidates,
  type PacketEnvelope,
} from '@core/schema/packet-schema';

export interface PacketCanonicalDigestCandidate {
  packet: PacketEnvelope;
  canonical_json: string;
  digest: string;
}

export function stripPacketSigningState<TPacket extends PacketEnvelope>(
  packet: TPacket
): TPacket {
  return {
    ...packet,
    header: {
      ...packet.header,
      integrity: {
        ...packet.header.integrity,
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
    },
  } as TPacket;
}

export async function getPacketUnsignedDigestCandidates(
  packet: PacketEnvelope
): Promise<PacketCanonicalDigestCandidate[]> {
  const unsignedPacket = stripPacketSigningState(packet);
  const candidatePackets = getPacketSignatureCanonicalCandidates(unsignedPacket);

  return Promise.all(
    candidatePackets.map(async (candidatePacket) => {
      const canonicalJson = canonicalizeJson(candidatePacket);

      return {
        packet: candidatePacket,
        canonical_json: canonicalJson,
        digest: await sha256Base64Url(canonicalJson),
      };
    })
  );
}
