import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq, desc } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(req: Request) {
  const url = new URL(req.url)
  const workspaceId = url.searchParams.get('workspaceId')
  const query = db.select().from(schema.agents)
  const rows = workspaceId
    ? await query
        .where(eq(schema.agents.workspaceId, workspaceId))
        .orderBy(desc(schema.agents.createdAt))
    : await query.orderBy(desc(schema.agents.createdAt))
  return NextResponse.json({ agents: rows })
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const workspaceId =
    typeof body.workspaceId === 'string' ? body.workspaceId.trim() : ''
  const name = typeof body.name === 'string' ? body.name.trim() : ''
  if (!workspaceId || !name) {
    return NextResponse.json(
      { error: 'workspaceId and name are required' },
      { status: 400 },
    )
  }
  // Confirm workspace exists so we don't get a foreign-key error.
  const [ws] = await db
    .select({ id: schema.workspaces.id })
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, workspaceId))
  if (!ws) {
    return NextResponse.json({ error: 'workspace not found' }, { status: 404 })
  }
  const systemPrompt =
    typeof body.systemPrompt === 'string' ? body.systemPrompt : ''
  const model = typeof body.model === 'string' && body.model ? body.model : null
  const skills = Array.isArray(body.skills)
    ? body.skills.filter((s: unknown): s is string => typeof s === 'string')
    : []
  const [row] = await db
    .insert(schema.agents)
    .values({ workspaceId, name, systemPrompt, model, skills })
    .returning()
  return NextResponse.json({ agent: row }, { status: 201 })
}
