/**
 * File: participation+api.ts
 * Description: Scoped role participation relation mutation endpoint.
 */

import { handleFortressRequest } from '@runtime/nexus/server/fortress-request';

export async function PUT(request: Request, context: unknown): Promise<Response> {
  const scopeId =
    typeof context === 'object' &&
    context !== null &&
    'params' in context &&
    typeof (context as { params?: { scopeId?: unknown } }).params?.scopeId === 'string'
      ? (context as { params: { scopeId: string } }).params.scopeId
      : null;

  const body = (await request.json()) as Record<string, unknown>;
  const rolePacketId =
    typeof body.role_packet_id === 'string' ? body.role_packet_id : null;
  const participating = body.participating !== false;

  if (!scopeId || !rolePacketId) {
    return Response.json({ error: 'Missing scope_id or role_packet_id.' }, { status: 400 });
  }

  return handleFortressRequest(request, {
    ...body,
    kind: participating
      ? 'relation.participation.add'
      : 'relation.participation.clear',
    scope_id: scopeId,
    role_packet_id: rolePacketId,
  });
}
