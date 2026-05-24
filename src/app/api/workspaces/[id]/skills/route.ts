import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { scanSkills } from '@/lib/skills'

export const runtime = 'nodejs'

/**
 * GET /api/workspaces/[id]/skills
 *
 * Returns the union of skills under ~/.claude/skills/ and the
 * workspace's own .claude/skills/. Always rescanned (cheap local FS).
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [workspace] = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, id))
  if (!workspace) {
    return NextResponse.json({ error: 'workspace not found' }, { status: 404 })
  }
  if (!path.isAbsolute(workspace.cwd)) {
    return NextResponse.json(
      { error: 'workspace cwd is not an absolute path' },
      { status: 400 },
    )
  }
  try {
    const stat = await fs.stat(workspace.cwd)
    if (!stat.isDirectory()) {
      return NextResponse.json(
        { error: 'workspace cwd is not a directory' },
        { status: 400 },
      )
    }
  } catch {
    return NextResponse.json(
      { error: 'workspace cwd does not exist on disk' },
      { status: 400 },
    )
  }

  const skills = await scanSkills(workspace.cwd)
  return NextResponse.json({ skills })
}
