import assert from 'node:assert/strict';
import test from 'node:test';
import { mkdtempSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { DatabaseSync } from 'node:sqlite';

import {
  createClaimedIdentityRevision,
  createPersonIdentityPacket,
} from '@core/packets/identity';
import {
  createActorAssertion,
  createIdentityKeyBinding,
  exportIdentityKeyPairToJwk,
  generateP256KeyPair,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import {
  NexusAuthFailureError,
  NexusAuthGateError,
} from '@runtime/nexus/nexus-auth-gate-error';
import { NodeSQLitePacketStore } from '@runtime/storage/node-sqlite-packet-store';

import { NexusAuthService } from './auth-service.ts';

async function createClaimedIdentityPacket(input: {
  alias: string;
  packetId: string;
  createdAt?: string;
}) {
  const createdAt = input.createdAt ?? '2026-04-28T00:00:00.000Z';
  const keyPair = await generateP256KeyPair();
  const exportedKeys = await exportIdentityKeyPairToJwk(keyPair);
  const keyBinding = await createIdentityKeyBinding({
    publicJwk: exportedKeys.publicJwk,
    addedAt: createdAt,
  });
  const unsignedPacket = createPersonIdentityPacket({
    alias: input.alias,
    claimStatus: 'claimed',
    publicKeyBinding: keyBinding,
    packetId: input.packetId,
    createdAt,
  });

  return {
    unsignedPacket,
    keyBinding,
    privateJwk: exportedKeys.privateJwk,
    signedPacket: await signPacketWithIdentity({
      packet: unsignedPacket,
      signerPacketId: unsignedPacket.header.packet_id,
      kid: keyBinding.kid,
      privateKey: keyPair.privateKey,
      signedAt: createdAt,
    }),
  };
}

function createRequestWithCookies(input: {
  path: string;
  cookieHeaders: string[];
}): Request {
  const cookieHeader = input.cookieHeaders
    .map((header) => header.split(';', 1)[0] ?? '')
    .filter((header) => header.length > 0)
    .join('; ');

  return new Request(`https://example.test${input.path}`, {
    method: 'POST',
    headers: {
      cookie: cookieHeader,
      origin: 'https://example.test',
    },
  });
}

async function createAuthHarness() {
  const directory = mkdtempSync(join(tmpdir(), 'owa-auth-identity-'));
  const packetStore = new NodeSQLitePacketStore({
    databasePath: join(directory, 'owa-auth-identity.db'),
  });
  const authService = new NexusAuthService(packetStore);
  await authService.ensureStorage();

  return {
    authService,
    packetStore,
    cleanup() {
      packetStore.close();
      rmSync(directory, { recursive: true, force: true });
    },
  };
}

function overwriteStoredPreferredRevisionJson(input: {
  databasePath: string;
  packetId: string;
  revisionId: string;
  packet: unknown;
}): void {
  const database = new DatabaseSync(input.databasePath);

  try {
    database.exec('BEGIN IMMEDIATE');
    const revisionJson = JSON.stringify(input.packet);

    database
      .prepare(
        `
          UPDATE packet_revisions
          SET revision_json = ?
          WHERE packet_id = ?
            AND revision_id = ?
        `
      )
      .run(revisionJson, input.packetId, input.revisionId);
    database
      .prepare(
        `
          UPDATE packets
          SET preferred_revision_json = ?
          WHERE packet_id = ?
            AND preferred_revision_id = ?
        `
      )
      .run(revisionJson, input.packetId, input.revisionId);
    database.exec('COMMIT');
  } catch (error) {
    database.exec('ROLLBACK');
    throw error;
  } finally {
    database.close();
  }
}

test('auth service rejects unsigned claimed identity packets with a precise message', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Unsigned User',
    packetId: 'nexus:element/unsigned-user',
  });

  try {
    await assert.rejects(
      harness.authService.createIdentity({
        actorPacket: identity.unsignedPacket,
      }),
      /missing its embedded signature/i
    );
  } finally {
    harness.cleanup();
  }
});

test('auth service rejects signer-mismatched claimed identity packets with a precise message', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Wrong Signer',
    packetId: 'nexus:element/wrong-signer',
  });
  const mismatchedSignerPacket = await signPacketWithIdentity({
    packet: identity.unsignedPacket,
    signerPacketId: 'nexus:element/another-actor',
    kid: identity.keyBinding.kid,
    privateKey: await importPrivateKeyFromJwk(identity.privateJwk),
    signedAt: '2026-04-28T00:00:00.000Z',
  });

  try {
    await assert.rejects(
      harness.authService.createIdentity({
        actorPacket: mismatchedSignerPacket,
      }),
      /signature signer does not match/i
    );
  } finally {
    harness.cleanup();
  }
});

test('auth service classifies canonical packet-shape drift separately from signature invalidity', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Tampered User',
    packetId: 'nexus:element/tampered-user',
  });
  const tamperedPacket = {
    ...identity.signedPacket,
    body: {
      ...identity.signedPacket.body,
      name: 'Tampered User X',
    },
  };

  try {
    await assert.rejects(
      harness.authService.createIdentity({
        actorPacket: tamperedPacket,
      }),
      (error: unknown) =>
        error instanceof NexusAuthFailureError &&
        error.failureCode === 'request_actor_canonicalization_mismatch' &&
        /canonical signature bytes/i.test(error.message)
    );
  } finally {
    harness.cleanup();
  }
});

test('auth service classifies invalid signature bytes separately from canonicalization mismatches', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Invalid Signature User',
    packetId: 'nexus:element/invalid-signature-user',
  });
  const signature =
    identity.signedPacket.header.integrity.embedded_signatures[0];
  const invalidSignaturePacket = {
    ...identity.signedPacket,
    header: {
      ...identity.signedPacket.header,
      integrity: {
        ...identity.signedPacket.header.integrity,
        embedded_signatures: signature
          ? [
              {
                ...signature,
                signature: `${signature.signature}x`,
              },
            ]
          : [],
      },
    },
  };

  try {
    await assert.rejects(
      harness.authService.createIdentity({
        actorPacket: invalidSignaturePacket,
      }),
      (error: unknown) =>
        error instanceof NexusAuthFailureError &&
        error.failureCode === 'request_actor_signature_invalid' &&
        /cryptographic signature verification failed/i.test(error.message)
    );
  } finally {
    harness.cleanup();
  }
});

test('auth service accepts claimed packets that omitted additive header compatibility metadata when signed', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Header Compat User',
    packetId: 'nexus:element/header-compat-user',
  });
  const legacyUnsignedPacket = {
    ...identity.unsignedPacket,
    header: {
      ...identity.unsignedPacket.header,
      metadata: Object.fromEntries(
        Object.entries(identity.unsignedPacket.header.metadata).filter(
          ([key]) => key !== 'compatibility'
        )
      ),
    },
  };
  const legacySignedPacket = await signPacketWithIdentity({
    packet: legacyUnsignedPacket as typeof identity.unsignedPacket,
    signerPacketId: legacyUnsignedPacket.header.packet_id,
    kid: identity.keyBinding.kid,
    privateKey: await importPrivateKeyFromJwk(identity.privateJwk),
    signedAt: legacyUnsignedPacket.header.created_at,
  });

  try {
    const actorPacket = await harness.authService.createIdentity({
      actorPacket: legacySignedPacket,
    });

    assert.equal(actorPacket.header.packet_id, legacySignedPacket.header.packet_id);
  } finally {
    harness.cleanup();
  }
});

test('auth service classifies metadata validation failures separately from signature failures', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Metadata User',
    packetId: 'nexus:element/metadata-user',
  });
  const invalidMetadataUnsignedPacket = {
    ...identity.unsignedPacket,
    body: {
      ...identity.unsignedPacket.body,
      identity: identity.unsignedPacket.body.identity
        ? {
            ...identity.unsignedPacket.body.identity,
            alias: 'Metadata   User',
          }
        : null,
    },
  };
  const invalidMetadataSignedPacket = await signPacketWithIdentity({
    packet: invalidMetadataUnsignedPacket,
    signerPacketId: invalidMetadataUnsignedPacket.header.packet_id,
    kid: identity.keyBinding.kid,
    privateKey: await importPrivateKeyFromJwk(identity.privateJwk),
    signedAt: invalidMetadataUnsignedPacket.header.created_at,
  });

  try {
    await assert.rejects(
      harness.authService.createIdentity({
        actorPacket: invalidMetadataSignedPacket,
      }),
      (error: unknown) =>
        error instanceof NexusAuthFailureError &&
        error.failureCode === 'request_actor_metadata_invalid' &&
        /display alias must be normalized/i.test(error.message)
    );
  } finally {
    harness.cleanup();
  }
});

test('signed reauth falls back from a stale stored claimed actor packet to the request actor packet', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Testy McGee',
    packetId: 'nexus:element/testy-mcgee',
  });

  try {
    await harness.authService.createIdentity({
      actorPacket: identity.signedPacket,
    });

    const challenge = await harness.authService.startSignInChallenge({
      actorPacketId: identity.signedPacket.header.packet_id,
      rateLimitKey: 'testy-mcgee-signin',
    });
    const privateKey = await importPrivateKeyFromJwk(identity.privateJwk);
    const signInAssertion = await createActorAssertion({
      actorPacketId: identity.signedPacket.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/signin/verify',
      body: {
        challenge_id: challenge.challenge_id,
        nonce: challenge.nonce,
        keep_me_logged_in: false,
      },
    });
    const signInResult = await harness.authService.verifySignInChallenge({
      request: createRequestWithCookies({
        path: '/api/nexus/auth/signin/verify',
        cookieHeaders: [],
      }),
      actorAssertion: signInAssertion,
      keepMeLoggedIn: false,
      challengeId: challenge.challenge_id,
      nonce: challenge.nonce,
      rateLimitKey: 'testy-mcgee-signin',
    });
    const staleStoredRevision = createClaimedIdentityRevision({
      actorPacket: identity.signedPacket,
      alias: 'Testy McGee',
    });
    const staleStoredSignedRevision = await signPacketWithIdentity({
      packet: staleStoredRevision,
      signerPacketId: staleStoredRevision.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      signedAt: staleStoredRevision.header.created_at,
    });
    const tamperedStoredRevision = {
      ...staleStoredSignedRevision,
      body: {
        ...staleStoredSignedRevision.body,
        name: 'Testy McGee (tampered)',
      },
    };

    await harness.packetStore.writeRevision(tamperedStoredRevision);
    await harness.packetStore.publishRevision({
      packet_id: tamperedStoredRevision.header.packet_id,
      revision_id: tamperedStoredRevision.header.revision_id,
    });

    const reauthAssertion = await createActorAssertion({
      actorPacketId: identity.signedPacket.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/reauth/signed',
      body: {
        purpose: 'interaction',
        proof_method: 'signed_reauth',
      },
    });
    const reauthResult = await harness.authService.verifySignedReauth({
      request: createRequestWithCookies({
        path: '/api/nexus/auth/reauth/signed',
        cookieHeaders: signInResult.setCookieHeaders,
      }),
      csrfToken: signInResult.session.csrf_token,
      actorPacket: identity.signedPacket,
      actorAssertion: reauthAssertion,
      purpose: 'interaction',
    });

    assert.equal(reauthResult.proof_method, 'signed_reauth');
    assert.match(reauthResult.reauth_token, /./);
  } finally {
    harness.cleanup();
  }
});

test('signed reauth does not discard a valid request packet when the stored copy shares the same revision id but different raw content', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Same Revision Rescue',
    packetId: 'nexus:element/same-revision-rescue',
  });

  try {
    await harness.authService.createIdentity({
      actorPacket: identity.signedPacket,
    });

    const challenge = await harness.authService.startSignInChallenge({
      actorPacketId: identity.signedPacket.header.packet_id,
      rateLimitKey: 'same-revision-rescue-signin',
    });
    const privateKey = await importPrivateKeyFromJwk(identity.privateJwk);
    const signInAssertion = await createActorAssertion({
      actorPacketId: identity.signedPacket.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/signin/verify',
      body: {
        challenge_id: challenge.challenge_id,
        nonce: challenge.nonce,
        keep_me_logged_in: false,
      },
    });
    const signInResult = await harness.authService.verifySignInChallenge({
      request: createRequestWithCookies({
        path: '/api/nexus/auth/signin/verify',
        cookieHeaders: [],
      }),
      actorAssertion: signInAssertion,
      keepMeLoggedIn: false,
      challengeId: challenge.challenge_id,
      nonce: challenge.nonce,
      rateLimitKey: 'same-revision-rescue-signin',
    });
    const tamperedStoredRevision = {
      ...identity.signedPacket,
      body: {
        ...identity.signedPacket.body,
        name: 'Same Revision Rescue (tampered stored copy)',
      },
    };

    overwriteStoredPreferredRevisionJson({
      databasePath: harness.packetStore.databasePath,
      packetId: identity.signedPacket.header.packet_id,
      revisionId: identity.signedPacket.header.revision_id,
      packet: tamperedStoredRevision,
    });

    const reauthAssertion = await createActorAssertion({
      actorPacketId: identity.signedPacket.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/reauth/signed',
      body: {
        purpose: 'interaction',
        proof_method: 'signed_reauth',
      },
    });
    const reauthResult = await harness.authService.verifySignedReauth({
      request: createRequestWithCookies({
        path: '/api/nexus/auth/reauth/signed',
        cookieHeaders: signInResult.setCookieHeaders,
      }),
      csrfToken: signInResult.session.csrf_token,
      actorPacket: identity.signedPacket,
      actorAssertion: reauthAssertion,
      purpose: 'interaction',
    });

    assert.equal(reauthResult.proof_method, 'signed_reauth');
    assert.match(reauthResult.reauth_token, /./);
  } finally {
    harness.cleanup();
  }
});

test('signed reauth reports a session actor mismatch explicitly', async () => {
  const harness = await createAuthHarness();
  const signedInIdentity = await createClaimedIdentityPacket({
    alias: 'Signed In User',
    packetId: 'nexus:element/signed-in-user',
  });
  const mismatchedIdentity = await createClaimedIdentityPacket({
    alias: 'Other User',
    packetId: 'nexus:element/other-user',
  });

  try {
    await harness.authService.createIdentity({
      actorPacket: signedInIdentity.signedPacket,
    });
    await harness.authService.createIdentity({
      actorPacket: mismatchedIdentity.signedPacket,
    });

    const challenge = await harness.authService.startSignInChallenge({
      actorPacketId: signedInIdentity.signedPacket.header.packet_id,
      rateLimitKey: 'signed-in-user-signin',
    });
    const signedInPrivateKey = await importPrivateKeyFromJwk(
      signedInIdentity.privateJwk
    );
    const signInAssertion = await createActorAssertion({
      actorPacketId: signedInIdentity.signedPacket.header.packet_id,
      kid: signedInIdentity.keyBinding.kid,
      privateKey: signedInPrivateKey,
      method: 'POST',
      path: '/api/nexus/auth/signin/verify',
      body: {
        challenge_id: challenge.challenge_id,
        nonce: challenge.nonce,
        keep_me_logged_in: false,
      },
    });
    const signInResult = await harness.authService.verifySignInChallenge({
      request: createRequestWithCookies({
        path: '/api/nexus/auth/signin/verify',
        cookieHeaders: [],
      }),
      actorAssertion: signInAssertion,
      keepMeLoggedIn: false,
      challengeId: challenge.challenge_id,
      nonce: challenge.nonce,
      rateLimitKey: 'signed-in-user-signin',
    });
    const mismatchedPrivateKey = await importPrivateKeyFromJwk(
      mismatchedIdentity.privateJwk
    );
    const reauthAssertion = await createActorAssertion({
      actorPacketId: mismatchedIdentity.signedPacket.header.packet_id,
      kid: mismatchedIdentity.keyBinding.kid,
      privateKey: mismatchedPrivateKey,
      method: 'POST',
      path: '/api/nexus/auth/reauth/signed',
      body: {
        purpose: 'interaction',
        proof_method: 'signed_reauth',
      },
    });

    await assert.rejects(
      harness.authService.verifySignedReauth({
        request: createRequestWithCookies({
          path: '/api/nexus/auth/reauth/signed',
          cookieHeaders: signInResult.setCookieHeaders,
        }),
        csrfToken: signInResult.session.csrf_token,
        actorPacket: mismatchedIdentity.signedPacket,
        actorAssertion: reauthAssertion,
        purpose: 'interaction',
      }),
      (error: unknown) =>
        error instanceof NexusAuthGateError &&
        error.reason === 'stale_actor_packet' &&
        error.failureCode === 'session_actor_mismatch'
    );
  } finally {
    harness.cleanup();
  }
});

test('actor mutation falls back from a stale stored claimed revision to the request actor packet', async () => {
  const harness = await createAuthHarness();
  const identity = await createClaimedIdentityPacket({
    alias: 'Fallback User',
    packetId: 'nexus:element/fallback-user',
  });

  try {
    await harness.authService.createIdentity({
      actorPacket: identity.signedPacket,
    });

    const challenge = await harness.authService.startSignInChallenge({
      actorPacketId: identity.signedPacket.header.packet_id,
      rateLimitKey: 'fallback-user-signin',
    });
    const privateKey = await importPrivateKeyFromJwk(identity.privateJwk);
    const signInAssertion = await createActorAssertion({
      actorPacketId: identity.signedPacket.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      method: 'POST',
      path: '/api/nexus/auth/signin/verify',
      body: {
        challenge_id: challenge.challenge_id,
        nonce: challenge.nonce,
        keep_me_logged_in: false,
      },
    });
    const signInResult = await harness.authService.verifySignInChallenge({
      request: createRequestWithCookies({
        path: '/api/nexus/auth/signin/verify',
        cookieHeaders: [],
      }),
      actorAssertion: signInAssertion,
      keepMeLoggedIn: false,
      challengeId: challenge.challenge_id,
      nonce: challenge.nonce,
      rateLimitKey: 'fallback-user-signin',
    });
    const staleStoredRevision = createClaimedIdentityRevision({
      actorPacket: identity.signedPacket,
      alias: 'Fallback User',
    });
    const staleStoredSignedRevision = await signPacketWithIdentity({
      packet: staleStoredRevision,
      signerPacketId: staleStoredRevision.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      signedAt: staleStoredRevision.header.created_at,
    });
    const tamperedStoredRevision = {
      ...staleStoredSignedRevision,
      body: {
        ...staleStoredSignedRevision.body,
        name: 'Fallback User (tampered)',
      },
    };

    await harness.packetStore.writeRevision(tamperedStoredRevision);
    await harness.packetStore.publishRevision({
      packet_id: tamperedStoredRevision.header.packet_id,
      revision_id: tamperedStoredRevision.header.revision_id,
    });

    const actorAssertion = await createActorAssertion({
      actorPacketId: identity.signedPacket.header.packet_id,
      kid: identity.keyBinding.kid,
      privateKey,
      method: 'POST',
      path: '/api/nexus/mutations/prepare',
      body: {
        actor_packet: identity.signedPacket,
        csrf_token: signInResult.session.csrf_token,
        reauth_token: null,
        intent: {
          kind: 'discussion.surfaces.ensure',
          scope_id: 'global-commons',
        },
      },
    });

    const actorContext = await harness.authService.verifyActorMutation({
      request: createRequestWithCookies({
        path: '/api/nexus/mutations/prepare',
        cookieHeaders: signInResult.setCookieHeaders,
      }),
      actorPacket: identity.signedPacket,
      actorAssertion,
      method: 'POST',
      path: '/api/nexus/mutations/prepare',
      body: {
        actor_packet: identity.signedPacket,
        csrf_token: signInResult.session.csrf_token,
        reauth_token: null,
        intent: {
          kind: 'discussion.surfaces.ensure',
          scope_id: 'global-commons',
        },
      },
      csrfToken: signInResult.session.csrf_token,
      requiredProofLevel: 'session',
    });

    assert.equal(actorContext.actorPacket.header.revision_id, identity.signedPacket.header.revision_id);
  } finally {
    harness.cleanup();
  }
});
