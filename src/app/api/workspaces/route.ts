import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { ensureDefaultDirectory } from '@/lib/directories'

export const runtime = 'nodejs'

export async function GET() {
  const rows = await db
    .select()
    .from(schema.workspaces)
    .orderBy(desc(schema.workspaces.createdAt))
  return NextResponse.json({ workspaces: rows })
}

/**
 * POST /api/workspaces  { name, cwd?, directories?: [{ path, label? }] }
 *
 * The body accepts either:
 *   - legacy `cwd` (single path) for back-compat
 *   - `directories` (array; first entry is the default cwd)
 *   - both (cwd is used if directories is omitted/empty)
 *
 * After creating the workspace row, every directory is inserted into
 * workspace_directories. The first directory's path is mirrored into
 * workspaces.cwd so the legacy column always reflects the default.
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''

  // Normalize the directories input. `directories` takes precedence if
  // it's a non-empty array; otherwise fall back to `cwd` as a single
  // entry.
  type DirInput = { path: string; label: string }
  let directories: DirInput[] = []
  if (Array.isArray(body.directories)) {
    const raw: unknown[] = body.directories
    for (const d of raw) {
      if (!d || typeof d !== 'object') continue
      const obj = d as Record<string, unknown>
      const path =
        typeof obj.path === 'string' ? (obj.path as string).trim() : ''
      const label =
        typeof obj.label === 'string' ? (obj.label as string).trim() : ''
      if (path) directories.push({ path, label })
    }
  }
  if (directories.length === 0) {
    const cwd = typeof body.cwd === 'string' ? body.cwd.trim() : ''
    if (cwd) directories = [{ path: cwd, label: '' }]
  }

  if (!name || directories.length === 0) {
    return NextResponse.json(
      { error: 'name and at least one directory are required' },
      { status: 400 },
    )
  }

  const defaultPath = directories[0].path
  const [row] = await db
    .insert(schema.workspaces)
    .values({ name, cwd: defaultPath })
    .returning()

  // Insert every directory in order so the first one is also the
  // oldest (resolveAgentCwd treats oldest as default). Labels default
  // to "default" for the first row when blank, otherwise empty.
  for (let i = 0; i < directories.length; i++) {
    const d = directories[i]
    await db.insert(schema.workspaceDirectories).values({
      workspaceId: row.id,
      path: d.path,
      label: d.label || (i === 0 ? 'default' : ''),
    })
  }
  // Safety net: ensureDefaultDirectory is a no-op if any row exists
  // and a backstop if the loop above somehow skipped the default.
  await ensureDefaultDirectory(row.id, defaultPath)

  return NextResponse.json({ workspace: row }, { status: 201 })
}
