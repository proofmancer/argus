import { NextResponse } from 'next/server'
import { killRun, isRunning } from '@/lib/run-registry'

export const runtime = 'nodejs'

/**
 * POST /api/runs/[id]/stop
 *
 * SIGTERM the run's child process group if it's still alive. The
 * run-route's SSE loop sees the child exit, persists `status='cancelled'`
 * (detected via the SIGTERM signal), and closes the stream. Idempotent:
 * stopping an already-finished run returns 200 with stopped:false.
 */
export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params
  if (!isRunning(id)) {
    return NextResponse.json({ ok: true, stopped: false })
  }
  const killed = killRun(id)
  return NextResponse.json({ ok: true, stopped: killed })
}
