/**
 * File: identity-shell-fortress-adapter.ts
 * Description: Contains the client-side signer/orchestration seam for fortress mutations.
 */

import {
  createActorAssertion,
  importPrivateKeyFromJwk,
  signPacketWithIdentity,
} from '@runtime/nexus/identity-crypto';
import {
  assertClaimedActorPacketReady,
  resolveClaimedSessionActorPacket,
} from '@runtime/nexus/claimed-identity-session';
import type { ActiveIdentityState } from '@runtime/nexus/identity-storage';
import {
  finalizeNexusMutation,
  prepareNexusMutation,
} from '@runtime/nexus/nexus-query-api.mutations';
import type {
  NexusAuthSessionPayload,
  NexusFinalizedMutationPayload,
} from '@runtime/nexus/nexus-api-types';
import type { MutationIntent } from '@core/auth/mutation-corridor';
import type { PacketEnvelope, PacketEnvelopeByType } from '@core/schema/packet-schema';
import type {
  MutationProofMethod,
  WriteProofLevel,
} from '@core/auth/proof-types';
import { NexusAuthGateError } from '@app/components/nexus/nexus-auth-gate-types';

type UnlockedIdentity = ActiveIdentityState & { privateJwk: JsonWebKey };

type MutationWriteRisk = 'standard' | 'high_impact';

type IdentityShellFortressAdapterInput = {
  requireUnlockedCurrentIdentity: () => UnlockedIdentity;
  refreshAuthSession: () => Promise<NexusAuthSessionPayload>;
  ensureFreshReauth: (
    purpose: 'interaction',
    sessionOverride?: NexusAuthSessionPayload | null
  ) => Promise<string>;
  consumePendingInteractionProof: (input: {
    acceptedMethods: MutationProofMethod[];
  }) => string | null;
};

function requireIdentityKid(identity: ActiveIdentityState): string {
  const kid = identity.actorPacket.body.identity?.public_key_bindings[0]?.kid;

  if (!kid) {
    throw new Error('The active identity is missing its key binding.');
  }

  return kid;
}

function requireActorPacketKid(
  actorPacket: PacketEnvelopeByType['Element']
): string {
  const kid = actorPacket.body.identity?.public_key_bindings[0]?.kid;

  if (!kid) {
    throw new Error('The active identity is missing its key binding.');
  }

  return kid;
}

function createClientIdentityHeaders(
  identity: ActiveIdentityState
): Record<string, string> {
  return {
    'x-nexus-client-actor-packet-id': identity.actorPacket.header.packet_id,
    'x-nexus-client-actor-revision-id': identity.actorPacket.header.revision_id,
    'x-nexus-client-identity-mode': identity.claimStatus,
  };
}

async function signPacketForIdentity<TPacket extends PacketEnvelope>(input: {
  identity: UnlockedIdentity;
  packet: TPacket;
}): Promise<TPacket> {
  const privateKey = await importPrivateKeyFromJwk(input.identity.privateJwk);

  return signPacketWithIdentity({
    packet: input.packet,
    signerPacketId: input.identity.actorPacket.header.packet_id,
    kid: requireIdentityKid(input.identity),
    privateKey,
  });
}

export function createIdentityShellFortressAdapter(
  input: IdentityShellFortressAdapterInput
) {
  const createVerifiedRequestBody = async <
    TPayload extends Record<string, unknown>,
  >(
    path: string,
    method: 'POST' | 'PUT',
    payload: TPayload,
    options?: {
      writeRisk?: MutationWriteRisk;
      skipAutomaticReauth?: boolean;
      reauthTokenOverride?: string | null;
    }
  ) => {
    const unlockedIdentity = input.requireUnlockedCurrentIdentity();
    let requestActorPacket = unlockedIdentity.actorPacket;
    let csrfToken: string | null = null;
    let reauthToken = options?.reauthTokenOverride ?? null;

    if (unlockedIdentity.claimStatus === 'claimed') {
      const currentSession = await input.refreshAuthSession();

      if (
        !currentSession.is_authenticated ||
        currentSession.actor_packet_id !== unlockedIdentity.actorPacket.header.packet_id
      ) {
        throw new NexusAuthGateError(
          'sign_in_required',
          'Sign in with this claimed identity before writing Nexus packets.'
        );
      }

      csrfToken = currentSession.csrf_token;

      if (!csrfToken) {
        throw new NexusAuthGateError(
          'session_refresh_required',
          'Refresh the claimed session before writing Nexus packets.'
        );
      }

      requestActorPacket = resolveClaimedSessionActorPacket({
        actorPacket: unlockedIdentity.actorPacket,
        session: currentSession,
      });
      assertClaimedActorPacketReady(requestActorPacket);

      const writeRisk = options?.writeRisk ?? 'standard';

      if (
        !options?.skipAutomaticReauth &&
        (currentSession.security_mode === 'every_write' ||
          (currentSession.security_mode === 'guarded' &&
            writeRisk === 'high_impact'))
      ) {
        reauthToken = await input.ensureFreshReauth('interaction', currentSession);
      }
    }

    const privateKey = await importPrivateKeyFromJwk(unlockedIdentity.privateJwk);
    const actorAssertion = await createActorAssertion({
      actorPacketId: requestActorPacket.header.packet_id,
      kid: requireActorPacketKid(requestActorPacket),
      privateKey,
      method,
      path,
      body: {
        actor_packet: requestActorPacket,
        csrf_token: csrfToken,
        reauth_token: reauthToken,
        ...payload,
      },
    });

    return {
      actor_packet: requestActorPacket,
      actor_assertion: actorAssertion,
      csrf_token: csrfToken,
      reauth_token: reauthToken,
      ...payload,
    };
  };

  const createVerifiedRequestBodyForIdentity = async <
    TPayload extends Record<string, unknown>,
  >(inputForIdentity: {
    identity: UnlockedIdentity;
    session: NexusAuthSessionPayload;
    path: string;
    method: 'POST' | 'PUT';
    payload: TPayload;
  }) => {
    const requestActorPacket = resolveClaimedSessionActorPacket({
      actorPacket: inputForIdentity.identity.actorPacket,
      session: inputForIdentity.session,
    });

    if (
      !inputForIdentity.session.is_authenticated ||
      inputForIdentity.session.actor_packet_id !== requestActorPacket.header.packet_id
    ) {
      throw new NexusAuthGateError(
        'sign_in_required',
        'Sign in with this claimed identity before writing Nexus packets.'
      );
    }

    if (!inputForIdentity.session.csrf_token) {
      throw new NexusAuthGateError(
        'session_refresh_required',
        'Refresh the claimed session before writing Nexus packets.'
      );
    }

    assertClaimedActorPacketReady(requestActorPacket);

    const privateKey = await importPrivateKeyFromJwk(inputForIdentity.identity.privateJwk);
    const actorAssertion = await createActorAssertion({
      actorPacketId: requestActorPacket.header.packet_id,
      kid: requireActorPacketKid(requestActorPacket),
      privateKey,
      method: inputForIdentity.method,
      path: inputForIdentity.path,
      body: {
        actor_packet: requestActorPacket,
        csrf_token: inputForIdentity.session.csrf_token,
        reauth_token: null,
        ...inputForIdentity.payload,
      },
    });

    return {
      actor_packet: requestActorPacket,
      actor_assertion: actorAssertion,
      csrf_token: inputForIdentity.session.csrf_token,
      reauth_token: null,
      ...inputForIdentity.payload,
    };
  };

  const signCurrentIdentityPacket = async <TPacket extends PacketEnvelope>(
    packet: TPacket
  ) => {
    const unlockedIdentity = input.requireUnlockedCurrentIdentity();

    return signPacketForIdentity({
      identity: unlockedIdentity,
      packet,
    });
  };

  const runFortressMutation = async <TResult = unknown>(inputForMutation: {
    intent: MutationIntent;
    writeRisk?: MutationWriteRisk;
    interfaceEventHeaders?: Record<string, string>;
  }): Promise<NexusFinalizedMutationPayload & { result: TResult }> => {
    const unlockedIdentity = input.requireUnlockedCurrentIdentity();
    const prepareRequestBody = await createVerifiedRequestBody(
      '/api/nexus/mutations/prepare',
      'POST',
      {
        intent: inputForMutation.intent,
      },
      {
        writeRisk: inputForMutation.writeRisk,
        skipAutomaticReauth: true,
      }
    );
    const preparedMutation = await prepareNexusMutation({
      requestBody: prepareRequestBody,
      headers: createClientIdentityHeaders(unlockedIdentity),
      interfaceEventHeaders: inputForMutation.interfaceEventHeaders,
    });
    let reauthToken: string | null = null;
    const requiredProofLevel = preparedMutation.prepared_mutation
      .required_proof_level as WriteProofLevel;
    const acceptedProofMethods = (
      preparedMutation.prepared_mutation.accepted_proof_methods ?? []
    ) as MutationProofMethod[];

    if (requiredProofLevel === 'reauth' || requiredProofLevel === 'passkey') {
      reauthToken = input.consumePendingInteractionProof({
        acceptedMethods: acceptedProofMethods,
      });

      if (!reauthToken) {
        throw new NexusAuthGateError(
          'write_approval_required',
          'Fresh approval is required before this write can continue.'
        );
      }
    }

    const signedPackets = await Promise.all(
      preparedMutation.prepared_mutation.prepared_packets.map((candidate) =>
        signCurrentIdentityPacket(candidate.packet)
      )
    );
    const finalizeRequestBody = await createVerifiedRequestBody(
      '/api/nexus/mutations/finalize',
      'POST',
      {
        ticket_id: preparedMutation.ticket.ticket_id,
        signed_packets: signedPackets,
      },
      {
        writeRisk: inputForMutation.writeRisk,
        skipAutomaticReauth: true,
        reauthTokenOverride: reauthToken,
      }
    );
    const finalizedMutation = await finalizeNexusMutation({
      requestBody: finalizeRequestBody,
      headers: createClientIdentityHeaders(unlockedIdentity),
      interfaceEventHeaders: inputForMutation.interfaceEventHeaders,
    });

    await input.refreshAuthSession();

    return finalizedMutation as NexusFinalizedMutationPayload & {
      result: TResult;
    };
  };

  const runFortressMutationForIdentity = async <TResult = unknown>(inputForIdentity: {
    identity: UnlockedIdentity;
    session: NexusAuthSessionPayload;
    intent: MutationIntent;
    writeRisk?: MutationWriteRisk;
    interfaceEventHeaders?: Record<string, string>;
  }): Promise<NexusFinalizedMutationPayload & { result: TResult }> => {
    const prepareRequestBody = await createVerifiedRequestBodyForIdentity({
      identity: inputForIdentity.identity,
      session: inputForIdentity.session,
      path: '/api/nexus/mutations/prepare',
      method: 'POST',
      payload: {
        intent: inputForIdentity.intent,
      },
    });
    const preparedMutation = await prepareNexusMutation({
      requestBody: prepareRequestBody,
      headers: createClientIdentityHeaders(inputForIdentity.identity),
      interfaceEventHeaders: inputForIdentity.interfaceEventHeaders,
    });
    const signedPackets = await Promise.all(
      preparedMutation.prepared_mutation.prepared_packets.map((candidate) =>
        signPacketForIdentity({
          identity: inputForIdentity.identity,
          packet: candidate.packet,
        })
      )
    );
    const finalizeRequestBody = await createVerifiedRequestBodyForIdentity({
      identity: inputForIdentity.identity,
      session: inputForIdentity.session,
      path: '/api/nexus/mutations/finalize',
      method: 'POST',
      payload: {
        ticket_id: preparedMutation.ticket.ticket_id,
        signed_packets: signedPackets,
      },
    });

    return (await finalizeNexusMutation({
      requestBody: finalizeRequestBody,
      headers: createClientIdentityHeaders(inputForIdentity.identity),
      interfaceEventHeaders: inputForIdentity.interfaceEventHeaders,
    })) as NexusFinalizedMutationPayload & { result: TResult };
  };

  return {
    createVerifiedRequestBody,
    runFortressMutation,
    runFortressMutationForIdentity,
    signCurrentIdentityPacket,
  };
}
