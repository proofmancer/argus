import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { promises as fs } from 'node:fs'
import path from 'node:path'
import { workspaceMemoryPath } from '@/lib/claude'

export const runtime = 'nodejs'

/**
 * GET / POST shared memory file for a workspace.
 *
 * Storage: <workspace.cwd>/.argus/MEMORY.md on the user's disk
 * (created on first non-empty save, deleted when saved empty).
 *
 * On every agent run, the file's contents are prepended to the
 * agent's system prompt via --append-system-prompt. See claude.ts.
 */

async function loadWorkspace(id: string) {
  const [row] = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, id))
  return row ?? null
}

async function assertWritableCwd(
  cwd: string,
): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  if (!path.isAbsolute(cwd)) {
    return {
      ok: false,
      status: 400,
      error: 'workspace cwd is not an absolute path',
    }
  }
  try {
    const stat = await fs.stat(cwd)
    if (!stat.isDirectory()) {
      return {
        ok: false,
        status: 400,
        error: 'workspace cwd is not a directory',
      }
    }
  } catch {
    return {
      ok: false,
      status: 400,
      error: 'workspace cwd does not exist on disk',
    }
  }
  return { ok: true }
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
  const check = await assertWritableCwd(workspace.cwd)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }
  try {
    const content = await fs.readFile(workspaceMemoryPath(workspace.cwd), 'utf8')
    return NextResponse.json({ content })
  } catch {
    // File doesn't exist yet, return empty.
    return NextResponse.json({ content: '' })
  }
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
  const check = await assertWritableCwd(workspace.cwd)
  if (!check.ok) {
    return NextResponse.json({ error: check.error }, { status: check.status })
  }

  const body = await req.json().catch(() => null)
  const content =
    body && typeof body.content === 'string' ? body.content : ''
  const target = workspaceMemoryPath(workspace.cwd)

  try {
    if (content.trim() === '') {
      // Empty save clears the file. Treat missing-file as success.
      try {
        await fs.unlink(target)
      } catch {
        // already gone, fine
      }
      return NextResponse.json({ ok: true, cleared: true })
    }
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content, 'utf8')
    return NextResponse.json({ ok: true })
  } catch (err) {
    return NextResponse.json(
      {
        error: err instanceof Error ? err.message : 'write failed',
      },
      { status: 500 },
    )
  }
}
