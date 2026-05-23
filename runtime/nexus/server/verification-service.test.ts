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
      subtype: 'organization',
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
      subtype: 'organization',
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

    assert.equal(validatorPacket?.header.type, 'Element');
    assert.equal((validatorPacket?.body as { subtype?: string }).subtype, 'local_validator');
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
      subtype: 'organization',
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
      subtype: 'organization',
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
