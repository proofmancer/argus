import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { and, eq } from 'drizzle-orm'
import { listDirectories } from '@/lib/directories'

export const runtime = 'nodejs'

/**
 * DELETE /api/workspaces/[id]/directories/[dirId]
 *
 * Refuses to delete the last directory of a workspace. The workspace
 * always needs at least one cwd to spawn agents in. Agents bound to
 * the deleted directory get their directory_id set to NULL (via the
 * schema's ON DELETE SET NULL) and will fall back to the first
 * remaining directory at run time.
 */
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string; dirId: string }> },
) {
  const { id, dirId } = await params
  const existing = await listDirectories(id)
  if (!existing.find((d) => d.id === dirId)) {
    return NextResponse.json(
      { error: 'directory not found in this workspace' },
      { status: 404 },
    )
  }
  if (existing.length <= 1) {
    return NextResponse.json(
      { error: 'cannot remove the last directory' },
      { status: 400 },
    )
  }
  await db
    .delete(schema.workspaceDirectories)
    .where(
      and(
        eq(schema.workspaceDirectories.id, dirId),
        eq(schema.workspaceDirectories.workspaceId, id),
      ),
    )
  return NextResponse.json({ ok: true })
}
