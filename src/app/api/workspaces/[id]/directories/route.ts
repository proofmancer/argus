import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { listDirectories } from '@/lib/directories'

export const runtime = 'nodejs'

/**
 * GET  /api/workspaces/[id]/directories
 * POST /api/workspaces/[id]/directories  { path, label? }
 *
 * The path is not validated against the filesystem here. The user is
 * trusted to point at a real folder, same trust model as the workspace
 * cwd. We do require an absolute-ish path: rejecting empty / pure
 * whitespace, that's all.
 */

async function loadWorkspace(id: string) {
  const [row] = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, id))
  return row ?? null
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const workspace = await loadWorkspace(id)
  if (!workspace) {
    return NextResponse.json({ error: 'workspace not found' }, { status: 404 })
  }
  const directories = await listDirectories(workspace.id)
  return NextResponse.json({ directories })
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const workspace = await loadWorkspace(id)
  if (!workspace) {
    return NextResponse.json({ error: 'workspace not found' }, { status: 404 })
  }
  const body = await req.json().catch(() => null)
  const path =
    body && typeof body.path === 'string' ? body.path.trim() : ''
  const label =
    body && typeof body.label === 'string' ? body.label.trim() : ''
  if (!path) {
    return NextResponse.json({ error: 'path is required' }, { status: 400 })
  }
  const [row] = await db
    .insert(schema.workspaceDirectories)
    .values({ workspaceId: workspace.id, path, label })
    .returning()
  return NextResponse.json({ directory: row }, { status: 201 })
}
