import { DatabaseSync } from 'node:sqlite';

import { canonicalizeJson, sha256Base64Url } from '@core/crypto/canonical-json';
import type { PacketEnvelopeByType } from '@core/schema/packet-schema';
import {
  getRawPacketSignatureCanonicalCandidateDetails,
  parseRawPacketEnvelopeInput,
} from '@core/schema/packet-schema';
import { verifyPacketSignatureDetailed } from '@runtime/nexus/identity-crypto';
import { validateIdentityPacketMetadata } from '@runtime/nexus/server/auth-service.utils';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

type SecurityModeRow = {
  security_mode: string;
} | undefined;

async function main(): Promise<void> {
  const packetId = process.argv[2];
  const databasePath = process.argv[3];

  if (!packetId) {
    throw new Error(
      'Usage: node --experimental-strip-types --experimental-specifier-resolution=node --loader ./scripts/ts-paths-loader.mjs scripts/identity-packet-health-audit.ts <packet-id> [database-path]'
    );
  }

  const packetStore = new NodeSQLitePacketStore(
    databasePath ? { databasePath } : {}
  );
  const database = new DatabaseSync(packetStore.databasePath);

  try {
    const revisionHeads = await packetStore.fetchRevisionHeads({
      packet_id: packetId,
    });
    const preferredRawPacket = await packetStore.readByPacket(
      { packet_id: packetId },
      {
        mode: 'raw',
      }
    );
    const preferredAdaptedPacket = await packetStore.fetchByPacket({
      packet_id: packetId,
    });
    const securityModeRow = database
      .prepare(
        `
          SELECT security_mode
          FROM auth_identity_security
          WHERE actor_packet_id = ?
        `
      )
      .get(packetId) as SecurityModeRow;
    const preferredAdaptedBody = preferredAdaptedPacket?.body as
      | Record<string, unknown>
      | undefined;
    const claimStatus =
      preferredAdaptedPacket?.header.family === 'Element' &&
      preferredAdaptedBody?.kind === 'person'
        ? (
            preferredAdaptedPacket as PacketEnvelopeByType['Element']
          ).body.identity?.claim_status ?? null
        : null;
    const preferredActorPacket =
      preferredAdaptedPacket?.header.family === 'Element' &&
      preferredAdaptedBody?.kind === 'person'
        ? (preferredAdaptedPacket as PacketEnvelopeByType['Element'])
        : null;
    const embeddedSignature =
      preferredActorPacket?.header.integrity.embedded_signatures[0] ?? null;
    const rawVerification =
      preferredRawPacket && preferredActorPacket
        ? await verifyPacketSignatureDetailed({
            packet: preferredRawPacket,
            signerPacket: preferredRawPacket,
          })
        : null;
    const adaptedVerification =
      preferredAdaptedPacket && preferredActorPacket
        ? await verifyPacketSignatureDetailed({
            packet: preferredAdaptedPacket,
            signerPacket: preferredAdaptedPacket,
          })
        : null;
    const metadataValidationResult =
      preferredActorPacket
        ? (() => {
            try {
              validateIdentityPacketMetadata(preferredActorPacket);

              return {
                is_valid: true,
                error: null,
              };
            } catch (error) {
              return {
                is_valid: false,
                error:
                  error instanceof Error
                    ? error.message
                    : 'Identity metadata validation failed.',
              };
            }
          })()
        : null;
    const rawCandidateSources = preferredRawPacket
      ? getRawPacketSignatureCanonicalCandidateDetails(preferredRawPacket).map(
          (candidate) => candidate.source
        )
      : [];
    const rawCandidateDigests = preferredRawPacket
      ? await Promise.all(
          getRawPacketSignatureCanonicalCandidateDetails(preferredRawPacket).map(
            async (candidate) => ({
              source: candidate.source,
              digest: await sha256Base64Url(
                canonicalizeJson(candidate.packet)
              ),
            })
          )
        )
      : [];
    const preferredRawRevisionId = preferredRawPacket
      ? parseRawPacketEnvelopeInput(preferredRawPacket).header.revision_id
      : null;

    console.log(
      JSON.stringify(
        {
          packet_id: packetId,
          database_path: packetStore.databasePath,
          preferred_revision_id:
            revisionHeads.preferred_revision?.revision_id ?? null,
          head_revision_ids: revisionHeads.head_revisions.map(
            (revision) => revision.revision_id
          ),
          preferred_revision_json_id: preferredRawRevisionId,
          claim_status: claimStatus,
          security_mode: securityModeRow?.security_mode ?? null,
          embedded_signature_count:
            preferredActorPacket?.header.integrity.embedded_signatures.length ?? 0,
          signature_kid: embeddedSignature?.kid ?? null,
          signer_packet_ref:
            embeddedSignature?.signer_packet_ref?.packet_id ?? null,
          public_key_binding_kids:
            preferredActorPacket?.body.identity?.public_key_bindings.map(
              (binding) => binding.kid
            ) ?? [],
          raw_verification: rawVerification,
          adapted_verification: adaptedVerification,
          metadata_validation: metadataValidationResult,
          candidate_resolution: {
            candidate_sources: rawCandidateSources,
            candidate_count: rawCandidateSources.length,
            candidate_digests: rawCandidateDigests,
          },
        },
        null,
        2
      )
    );
  } finally {
    database.close();
    packetStore.close();
  }
}

void main();
