'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Run } from '@/lib/schema'

/**
 * Past runs panel for a single agent. Reads from
 * GET /api/agents/[id]/run (which returns the 25 most recent runs)
 * and renders them as a collapsed list. Click a row to expand its
 * recorded JSONL output inline.
 *
 * `version` is a re-fetch trigger. Parent components bump it after a
 * live run ends so the history list refreshes without a full reload.
 */
export function RunHistory({
  agentId,
  version = 0,
}: {
  agentId: string
  version?: number
}) {
  const [runs, setRuns] = useState<Run[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/agents/${agentId}/run`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        setError(body.error || 'failed to load history')
        setRuns([])
        return
      }
      const body = (await res.json()) as { runs: Run[] }
      // Normalize timestamps: API ships ISO strings or numbers depending
      // on serialization. Coerce to Date for the formatters.
      const normalized = body.runs.map((r) => ({
        ...r,
        startedAt: new Date(r.startedAt),
        endedAt: r.endedAt ? new Date(r.endedAt) : null,
      })) as Run[]
      setRuns(normalized)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load history')
      setRuns([])
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    load()
  }, [load, version])

  return (
    <div className="mt-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">
          History
        </h3>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
        >
          {loading ? 'loading...' : 'refresh'}
        </button>
      </div>

      {error && (
        <div className="mt-2 text-xs text-red-400">{error}</div>
      )}

      {runs && runs.length === 0 && !error && (
        <div className="mt-2 text-xs text-neutral-500">no runs yet.</div>
      )}

      {runs && runs.length > 0 && (
        <ul className="mt-2 flex flex-col divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800">
          {runs.map((run) => (
            <RunRow
              key={run.id}
              run={run}
              expanded={expanded === run.id}
              onToggle={() =>
                setExpanded((cur) => (cur === run.id ? null : run.id))
              }
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function RunRow({
  run,
  expanded,
  onToggle,
}: {
  run: Run
  expanded: boolean
  onToggle: () => void
}) {
  const status = run.status
  const exit = run.exitCode
  const statusColor =
    status === 'running'
      ? 'text-amber-400'
      : exit === 0
        ? 'text-green-500'
        : 'text-red-400'

  return (
    <li className="bg-neutral-950">
      <button
        onClick={onToggle}
        className="grid w-full grid-cols-[1fr_auto_auto_auto] items-center gap-3 px-3 py-2 text-left text-xs hover:bg-neutral-900"
      >
        <span className="truncate text-neutral-200">
          {previewPrompt(run.prompt)}
        </span>
        <span className="font-mono text-[10px] text-neutral-500">
          {formatRelative(run.startedAt)}
        </span>
        <span className="font-mono text-[10px] text-neutral-500">
          {formatDuration(run.startedAt, run.endedAt, status)}
        </span>
        <span className={`font-mono text-[10px] ${statusColor}`}>
          {status === 'running' ? 'running' : `exit ${exit ?? '?'}`}
        </span>
      </button>
      {expanded && (
        <div className="border-t border-neutral-800 bg-neutral-950 p-3">
          {run.output ? (
            <pre className="max-h-[60vh] overflow-y-auto font-mono text-[11px] leading-relaxed whitespace-pre-wrap break-words text-neutral-300">
              {run.output}
            </pre>
          ) : (
            <div className="text-xs text-neutral-500">
              no output recorded.
            </div>
          )}
        </div>
      )}
    </li>
  )
}

function previewPrompt(s: string): string {
  const trimmed = s.replace(/\s+/g, ' ').trim()
  return trimmed.length > 80 ? trimmed.slice(0, 77) + '...' : trimmed
}

function formatRelative(d: Date): string {
  const now = Date.now()
  const then = d.getTime()
  const sec = Math.max(0, Math.floor((now - then) / 1000))
  if (sec < 60) return `${sec}s ago`
  const min = Math.floor(sec / 60)
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  const day = Math.floor(hr / 24)
  if (day < 30) return `${day}d ago`
  return d.toISOString().slice(0, 10)
}

function formatDuration(
  start: Date,
  end: Date | null,
  status: string,
): string {
  if (status === 'running' || !end) return 'running'
  const ms = end.getTime() - start.getTime()
  if (ms < 0) return ''
  const sec = ms / 1000
  if (sec < 60) return `${sec.toFixed(1)}s`
  const m = Math.floor(sec / 60)
  const s = Math.floor(sec - m * 60)
  return `${m}m ${String(s).padStart(2, '0')}s`
}
