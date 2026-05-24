import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'

export const runtime = 'nodejs'

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const [row] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, id))
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ agent: row })
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  const body = await req.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'invalid body' }, { status: 400 })
  }
  const patch: Partial<{
    name: string
    systemPrompt: string
    model: string | null
    skills: string[]
  }> = {}
  if (typeof body.name === 'string') patch.name = body.name.trim()
  if (typeof body.systemPrompt === 'string')
    patch.systemPrompt = body.systemPrompt
  if (typeof body.model === 'string') patch.model = body.model || null
  if (body.model === null) patch.model = null
  if (Array.isArray(body.skills))
    patch.skills = body.skills.filter(
      (s: unknown): s is string => typeof s === 'string',
    )
  const [row] = await db
    .update(schema.agents)
    .set(patch)
    .where(eq(schema.agents.id, id))
    .returning()
  if (!row) {
    return NextResponse.json({ error: 'not found' }, { status: 404 })
  }
  return NextResponse.json({ agent: row })
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  await db.delete(schema.agents).where(eq(schema.agents.id, id))
  return NextResponse.json({ ok: true })
}
