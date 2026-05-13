import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { createElementPacket } from '@core/packets/builders';
import { createPersonIdentityPacket } from '@core/packets/identity';
import {
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  signPacketWithIdentity,
  verifyPacketSignatureDetailed,
} from '@runtime/nexus/identity-crypto';
import { NexusPacketActionService } from '@runtime/nexus/server/packet-action-service';
import { NexusPacketVerificationService } from '@runtime/nexus/server/verification-service';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';
import { createNodeSQLiteQueryServicesAsync } from '@runtime/storage/node-sqlite-query-services';

async function createSignedIdentityPacket(input: {
  packetId: string;
  alias: string;
  createdAt: string;
}) {
  const keyPair = await generateP256KeyPair();
  const jwkPair = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: jwkPair.publicJwk,
    addedAt: input.createdAt,
  });
  const identityPacket = createPersonIdentityPacket({
    alias: input.alias,
    claimStatus: 'claimed',
    packetId: input.packetId,
    createdAt: input.createdAt,
    publicKeyBinding: keyBinding,
  });

  return {
    keyPair,
    packet: await signPacketWithIdentity({
      packet: identityPacket,
      signerPacketId: input.packetId,
      kid: keyBinding.kid,
      privateKey: keyPair.privateKey,
      signedAt: input.createdAt,
    }),
    keyBinding,
  };
}

function createLegacyElementPacket(input: {
  packetId: string;
  revisionId: string;
  createdAt: string;
  name: string;
}) {
  return {
    header: {
      packet_id: input.packetId,
      revision_id: input.revisionId,
      family: 'Element' as const,
      schema_version: '0.9.0',
      protocol_version: '0.1.0',
      created_at: input.createdAt,
      parent_revision_refs: [],
      merge_strategy: null,
      authority_scope_ref: null,
      applicable_scope_refs: [],
      edges: [],
      provenance: {
        created_by: null,
        submitted_by: null,
        adapter: 'test',
        recorded_at: input.createdAt,
        imported_from_revision: null,
      },
      integrity: {
        canonicalization: 'RFC8785',
        hash_alg: 'sha-256',
        digest: null,
        embedded_signatures: [],
        signature_refs: [],
      },
      moderation: {
        visibility: 'public',
        moderation_state: 'open',
        policy_refs: [],
        content_warning_ids: [],
      },
      external_refs: [],
      metadata: {
        tags: [],
        language: null,
        summary: null,
      },
      producer: {
        adapter: 'test',
        app_version: null,
      },
    },
    body: {
      kind: 'organization',
      name: input.name,
      subtype: 'assembly',
      summary: null,
      locality_label: null,
      identity: null,
      tags: ['legacy'],
    },
  };
}

test('verification service writes one logical report and revalidation revises it', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-verification-'));
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'verification.db'),
    }),
  });
  const verificationService = new NexusPacketVerificationService(
    queryServices.packetStore
  );

  try {
    const createdAt = '2026-05-12T00:00:00.000Z';
    const signer = await createSignedIdentityPacket({
      packetId: 'nexus:element/test-signer',
      alias: 'Test Signer',
      createdAt,
    });
    const unsignedTarget = createElementPacket({
      packet_id: 'nexus:element/verified-target',
      revision_id: 'nexus:element/verified-target@r1',
      kind: 'organization',
      name: 'Verified Target',
      created_at: createdAt,
    });
    const signedTarget = await signPacketWithIdentity({
      packet: unsignedTarget,
      signerPacketId: signer.packet.header.packet_id,
      kid: signer.keyBinding.kid,
      privateKey: signer.keyPair.privateKey,
      signedAt: createdAt,
    });

    await queryServices.packetStore.writeRevision(signer.packet);
    await queryServices.packetStore.publishRevision({
      packet_id: signer.packet.header.packet_id,
      revision_id: signer.packet.header.revision_id,
    });
    await queryServices.packetStore.writeRevision(signedTarget);
    await queryServices.packetStore.publishRevision({
      packet_id: signedTarget.header.packet_id,
      revision_id: signedTarget.header.revision_id,
    });

    const firstValidation = await verificationService.validatePacket(
      signedTarget.header.packet_id
    );
    const firstSummary =
      await queryServices.packetStore.getPacketVerificationSummary({
        packet_id: signedTarget.header.packet_id,
      });

    assert.equal(firstValidation.status, 'trusted_signer');
    assert.equal(firstSummary?.status, 'trusted_signer');
    assert.equal(firstSummary?.target_revision_id, signedTarget.header.revision_id);
    assert.equal(firstSummary?.target_digest, signedTarget.header.integrity.digest);
    assert.equal(firstSummary?.latest_report_packet_id, firstValidation.report_packet_id);

    const secondValidation = await verificationService.validatePacket(
      signedTarget.header.packet_id
    );

    assert.equal(
      secondValidation.report_packet_id,
      firstValidation.report_packet_id
    );
    assert.notEqual(
      secondValidation.report_revision_id,
      firstValidation.report_revision_id
    );
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('local validator service identity signs reports that verify under the normal signature law', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-verification-validator-'));
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'verification-validator.db'),
    }),
  });
  const verificationService = new NexusPacketVerificationService(
    queryServices.packetStore
  );

  try {
    const createdAt = '2026-05-12T00:00:00.000Z';
    const signer = await createSignedIdentityPacket({
      packetId: 'nexus:element/local-validator-target-signer',
      alias: 'Validator Target Signer',
      createdAt,
    });
    const unsignedTarget = createElementPacket({
      packet_id: 'nexus:element/local-validator-target',
      revision_id: 'nexus:element/local-validator-target@r1',
      created_at: createdAt,
      kind: 'organization',
      name: 'Local Validator Target',
    });
    const signedTarget = await signPacketWithIdentity({
      packet: unsignedTarget,
      signerPacketId: signer.packet.header.packet_id,
      kid: signer.keyBinding.kid,
      privateKey: signer.keyPair.privateKey,
      signedAt: createdAt,
    });

    await queryServices.packetStore.writeRevision(signer.packet);
    await queryServices.packetStore.publishRevision({
      packet_id: signer.packet.header.packet_id,
      revision_id: signer.packet.header.revision_id,
    });
    await queryServices.packetStore.writeRevision(signedTarget);
    await queryServices.packetStore.publishRevision({
      packet_id: signedTarget.header.packet_id,
      revision_id: signedTarget.header.revision_id,
    });

    const validation = await verificationService.validatePacket(
      signedTarget.header.packet_id
    );
    const validatorPacket = await queryServices.packetStore.fetchByPacket({
      packet_id: validation.validator_packet_id,
    });
    const reportPacket = await queryServices.packetStore.fetchByPacket({
      packet_id: validation.report_packet_id,
    });

    assert.ok(validatorPacket);
    assert.ok(reportPacket);

    const verification = await verifyPacketSignatureDetailed({
      packet: reportPacket,
      signerPacket: validatorPacket,
    });

    assert.equal(validatorPacket?.header.family, 'Element');
    assert.equal((validatorPacket?.body as { kind?: string }).kind, 'service');
    assert.equal(verification.isValid, true);
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('unknown signer assessments stay unverifiable instead of claiming a valid signature', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-verification-unverifiable-'));
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'verification-unverifiable.db'),
    }),
  });
  const verificationService = new NexusPacketVerificationService(
    queryServices.packetStore
  );

  try {
    const createdAt = '2026-05-12T00:00:00.000Z';
    const signer = await createSignedIdentityPacket({
      packetId: 'nexus:element/external-missing-signer',
      alias: 'Missing Signer',
      createdAt,
    });
    const unsignedTarget = createElementPacket({
      packet_id: 'nexus:element/unverifiable-target',
      revision_id: 'nexus:element/unverifiable-target@r1',
      created_at: createdAt,
      kind: 'organization',
      name: 'Unverifiable Target',
    });
    const signedTarget = await signPacketWithIdentity({
      packet: unsignedTarget,
      signerPacketId: signer.packet.header.packet_id,
      kid: signer.keyBinding.kid,
      privateKey: signer.keyPair.privateKey,
      signedAt: createdAt,
    });

    const assessment = await verificationService.assessPacket({
      rawPacket: signedTarget,
      packet: signedTarget,
      signerPacket: null,
      compatibilityStatus: 'native',
      provenanceStatus: 'imported',
    });

    assert.equal(assessment.status, 'unknown_signer');
    assert.equal(assessment.signature_status, 'unverifiable');
    assert.equal(assessment.signer_status, 'unknown');
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('verification keeps raw signature validity separate from adapted compatibility reads', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-verification-adapted-'));
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'verification-adapted.db'),
    }),
  });
  const verificationService = new NexusPacketVerificationService(
    queryServices.packetStore
  );

  try {
    const createdAt = '2026-05-12T00:00:00.000Z';
    const signer = await createSignedIdentityPacket({
      packetId: 'nexus:element/legacy-verification-signer',
      alias: 'Legacy Verification Signer',
      createdAt,
    });
    const legacyUnsignedPacket = createLegacyElementPacket({
      packetId: 'nexus:element/legacy-verification-target',
      revisionId: 'nexus:element/legacy-verification-target@r1',
      createdAt,
      name: 'Legacy Verification Target',
    });
    const signedLegacyPacket = await signPacketWithIdentity({
      packet: legacyUnsignedPacket as never,
      signerPacketId: signer.packet.header.packet_id,
      kid: signer.keyBinding.kid,
      privateKey: signer.keyPair.privateKey,
      signedAt: createdAt,
    });

    await queryServices.packetStore.importBundle(
      JSON.stringify({
        bundle_version: 1,
        exported_at: createdAt,
        packets: [signer.packet, signedLegacyPacket],
      })
    );

    const rawRead = await queryServices.packetStore.readByRevision(
      {
        packet_id: signedLegacyPacket.header.packet_id,
        revision_id: signedLegacyPacket.header.revision_id,
      },
      { mode: 'raw' }
    );
    const adaptedRead = await queryServices.packetStore.readByRevision(
      {
        packet_id: signedLegacyPacket.header.packet_id,
        revision_id: signedLegacyPacket.header.revision_id,
      },
      { mode: 'raw_plus_adaptation' }
    );
    const validation = await verificationService.validatePacket(
      signedLegacyPacket.header.packet_id
    );
    const storedSummary =
      await queryServices.packetStore.getPacketVerificationSummary({
        packet_id: signedLegacyPacket.header.packet_id,
      });

    assert.ok(rawRead);
    assert.ok(adaptedRead);
    assert.ok(storedSummary);
    assert.equal(
      (rawRead as { header: { schema_version: string } }).header.schema_version,
      '0.9.0'
    );
    assert.equal(adaptedRead.raw_packet.header.schema_version, '0.9.0');
    assert.equal(adaptedRead.adapted_packet.header.schema_version, '1.1.0');
    assert.equal(validation.status, 'trusted_signer');
    assert.equal(storedSummary.signature_status, 'valid');
    assert.equal(storedSummary.compatibility_status, 'adapted');
    assert.equal(
      storedSummary.target_revision_id,
      signedLegacyPacket.header.revision_id
    );
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});

test('packet action projection flips from validate to revalidate after local verification', async () => {
  const directory = mkdtempSync(join(tmpdir(), 'owa-verification-actions-'));
  const queryServices = await createNodeSQLiteQueryServicesAsync({
    packetStore: new NodeSQLitePacketStore({
      databasePath: join(directory, 'verification-actions.db'),
    }),
  });
  const verificationService = new NexusPacketVerificationService(
    queryServices.packetStore
  );
  const packetActionService = new NexusPacketActionService(
    queryServices.browserQueryService,
    verificationService
  );

  try {
    const packet = createElementPacket({
      packet_id: 'nexus:element/unsigned-target',
      revision_id: 'nexus:element/unsigned-target@r1',
      created_at: '2026-05-12T00:00:00.000Z',
      kind: 'organization',
      name: 'Unsigned Target',
    });

    await queryServices.packetStore.writeRevision(packet);
    await queryServices.packetStore.publishRevision({
      packet_id: packet.header.packet_id,
      revision_id: packet.header.revision_id,
    });

    const before = await packetActionService.projectPacketActions({
      currentSurface: 'dashboard',
      target: {
        packet_id: packet.header.packet_id,
      },
    });

    assert.equal(before.actions['packet.validate']?.visible, true);
    assert.equal(before.actions['packet.revalidate']?.visible, false);
    assert.equal(before.actions['packet.view_verification']?.visible, false);

    await verificationService.validatePacket(packet.header.packet_id);

    const after = await packetActionService.projectPacketActions({
      currentSurface: 'dashboard',
      target: {
        packet_id: packet.header.packet_id,
      },
    });

    assert.equal(after.actions['packet.validate']?.visible, false);
    assert.equal(after.actions['packet.revalidate']?.visible, true);
    assert.equal(after.actions['packet.view_verification']?.visible, true);
    assert.equal(after.verification_summary?.status, 'unsigned');
  } finally {
    queryServices.packetStore.close();
    rmSync(directory, { recursive: true, force: true });
  }
});
