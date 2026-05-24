import { NextResponse } from 'next/server'
import { db, schema } from '@/lib/db'
import { eq } from 'drizzle-orm'
import { runAgent, writeAgentSkillConfig } from '@/lib/claude'

export const runtime = 'nodejs'
// Allow long-running streams; default Vercel limit is short, but we're
// running locally on `next dev` / `next start` where there's no hard cap.
export const maxDuration = 600 // 10 min ceiling per run

/**
 * POST /api/agents/[id]/run
 *
 * Body: { prompt: string }
 * Response: Server-Sent Events stream of JSONL events from the claude
 * CLI, plus a synthetic `run:start` (with runId) and `run:end` (with
 * exit code + status) frame so the client knows what's happening.
 *
 * Each event is sent as a single SSE message with `data:` payload.
 * The frontend reads this via EventSource and renders incrementally.
 *
 * Run state is persisted in the `runs` table so a refresh re-loads
 * the last output. Output column is updated as a single blob on
 * completion (chunk-level persistence is a v0.2 concern).
 */
export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params
  const body = await req.json().catch(() => null)
  const prompt =
    body && typeof body.prompt === 'string' ? body.prompt.trim() : ''
  if (!prompt) {
    return NextResponse.json({ error: 'prompt is required' }, { status: 400 })
  }

  const [agent] = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.id, agentId))
  if (!agent) {
    return NextResponse.json({ error: 'agent not found' }, { status: 404 })
  }
  const [workspace] = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, agent.workspaceId))
  if (!workspace) {
    return NextResponse.json(
      { error: 'workspace not found' },
      { status: 404 },
    )
  }

  // Pin the agent's skills into the workspace's .claude config (best
  // effort; failures are non-fatal and surface in stderr instead).
  await writeAgentSkillConfig(workspace.cwd, agent.skills ?? [])

  // Insert a `running` row so we can update it when the stream ends.
  const [run] = await db
    .insert(schema.runs)
    .values({ agentId, prompt })
    .returning()

  const encoder = new TextEncoder()
  const collected: string[] = []
  let exitCode: number | null = null

  const stream = new ReadableStream({
    async start(controller) {
      function send(event: object) {
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify(event)}\n\n`),
        )
      }

      send({ type: 'run:start', runId: run.id })

      try {
        for await (const event of runAgent({
          prompt,
          cwd: workspace.cwd,
          systemPrompt: agent.systemPrompt ?? '',
          model: agent.model,
          skills: agent.skills ?? [],
        })) {
          send(event as object)
          collected.push(JSON.stringify(event))
          if (
            event &&
            typeof event === 'object' &&
            'type' in event &&
            (event as { type: unknown }).type === 'exit'
          ) {
            const code = (event as unknown as { code?: number | null }).code
            exitCode = code ?? null
          }
        }
      } catch (err) {
        send({
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        })
      }

      const status: 'completed' | 'failed' =
        exitCode === 0 ? 'completed' : 'failed'
      try {
        await db
          .update(schema.runs)
          .set({
            output: collected.join('\n'),
            status,
            exitCode: exitCode ?? -1,
            endedAt: new Date(),
          })
          .where(eq(schema.runs.id, run.id))
      } catch {
        // best-effort persistence; ignore.
      }

      send({ type: 'run:end', runId: run.id, status, exitCode })
      controller.close()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  })
}

/**
 * GET /api/agents/[id]/run
 *
 * Returns the most recent runs for this agent. Useful for the UI to
 * show "last 5 runs" without bringing in a streaming reader.
 */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: agentId } = await params
  const rows = await db
    .select()
    .from(schema.runs)
    .where(eq(schema.runs.agentId, agentId))
  // Sort newest-first in JS (small N, not worth a db.orderBy chain
  // when we're already pulling everything).
  rows.sort((a, b) => +b.startedAt - +a.startedAt)
  return NextResponse.json({ runs: rows.slice(0, 25) })
}
