/**
 * File: attestations+api.ts
 * Description: Fortress write endpoint for role participation support/dispute reaction attestations.
 */

import { handleFortressRequest } from '@runtime/nexus/server/fortress-request';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ scopeId?: string }> }
) {
  const { scopeId: rawScopeId } = await params;
  const scopeId =
    typeof rawScopeId === 'string' && rawScopeId.length > 0
      ? decodeURIComponent(rawScopeId)
      : null;
  const body = (await request.json()) as Record<string, unknown>;
  const relationPacketId =
    typeof body.relation_packet_id === 'string'
      ? body.relation_packet_id
      : typeof body.target_packet_id === 'string'
        ? body.target_packet_id
        : null;

  if (!scopeId || !relationPacketId) {
    return Response.json(
      { error: 'Missing scope_id or relation_packet_id.' },
      { status: 400 }
    );
  }

  const attestationValue =
    body.attestation_value === 'support' || body.attestation_value === 'dispute'
      ? body.attestation_value
      : body.mode === 'support' || body.mode === 'dispute'
        ? body.mode
        : null;

  return handleFortressRequest(request, {
    kind: 'reaction.attestation.set',
    scope_id: scopeId,
    target_packet_id: relationPacketId,
    attestation_value: attestationValue,
    note: typeof body.note === 'string' ? body.note : null,
    created_at: typeof body.created_at === 'string' ? body.created_at : null,
    mutation_nonce:
      typeof body.mutation_nonce === 'string' ? body.mutation_nonce : null,
  });
}
