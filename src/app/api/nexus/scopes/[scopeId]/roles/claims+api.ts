/**
 * File: claims+api.ts
 * Description: Deprecated role-claim endpoint retained only to reject stale clients after roles moved to participation relations.
 */

export async function PUT(): Promise<Response> {
  return Response.json(
    {
      error:
        'Role claims have been replaced by participation relations. Use /roles/participation.',
    },
    { status: 410 }
  );
}
