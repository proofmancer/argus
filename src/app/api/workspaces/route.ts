import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { desc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET() {
  const rows = await db
    .select()
    .from(schema.workspaces)
    .orderBy(desc(schema.workspaces.createdAt))
  return NextResponse.json({ workspaces: rows })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  const cwd = typeof body.cwd === 'string' ? body.cwd.trim() : ''
  if (!name || !cwd) {
    return NextResponse.json(
      { error: 'name and cwd are required' },
      { status: 400 },
    )
  }
  const [row] = await db
    .insert(schema.workspaces)
    .values({ name, cwd })
    .returning()
  return NextResponse.json({ workspace: row }, { status: 201 })
}
