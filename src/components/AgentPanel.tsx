'use client'

import { useState, useRef } from 'react'
import type { Agent } from '@/lib/schema'

type StreamEvent =
  | { type: 'run:start'; runId: string }
  | { type: 'run:end'; runId: string; status: string; exitCode: number | null }
  | { type: 'exit'; code: number | null }
  | { type: 'error'; message: string }
  | { type: 'stderr'; line: string }
  | { type: 'raw'; line: string }
  | Record<string, unknown>

export function AgentPanel({ agent }: { agent: Agent }) {
  const [prompt, setPrompt] = useState('')
  const [events, setEvents] = useState<StreamEvent[]>([])
  const [running, setRunning] = useState(false)
  const outputRef = useRef<HTMLDivElement>(null)

  async function run() {
    if (!prompt.trim() || running) return
    setRunning(true)
    setEvents([])
    try {
      const res = await fetch(`/api/agents/${agent.id}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: prompt.trim() }),
      })
      if (!res.ok || !res.body) {
        const body = await res.json().catch(() => ({}))
        setEvents((prev) => [
          ...prev,
          { type: 'error', message: body.error || 'request failed' },
        ])
        setRunning(false)
        return
      }
      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const lines = buf.split('\n\n')
        buf = lines.pop() ?? ''
        for (const block of lines) {
          const dataLine = block
            .split('\n')
            .find((l) => l.startsWith('data: '))
          if (!dataLine) continue
          try {
            const event = JSON.parse(dataLine.slice('data: '.length))
            setEvents((prev) => [...prev, event])
            // Auto-scroll to bottom of output
            requestAnimationFrame(() => {
              if (outputRef.current) {
                outputRef.current.scrollTop = outputRef.current.scrollHeight
              }
            })
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (err) {
      setEvents((prev) => [
        ...prev,
        {
          type: 'error',
          message: err instanceof Error ? err.message : String(err),
        },
      ])
    } finally {
      setRunning(false)
    }
  }

  async function remove() {
    if (!confirm(`Delete agent "${agent.name}"?`)) return
    await fetch(`/api/agents/${agent.id}`, { method: 'DELETE' })
    window.location.reload()
  }

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium tracking-tight">{agent.name}</div>
          {agent.systemPrompt && (
            <div className="mt-1 max-w-2xl text-xs text-neutral-500">
              {agent.systemPrompt}
            </div>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
            {agent.model && (
              <span className="rounded bg-neutral-800 px-2 py-0.5 font-mono text-neutral-300">
                {agent.model}
              </span>
            )}
            {(agent.skills ?? []).map((s) => (
              <span
                key={s}
                className="rounded border border-neutral-700 px-2 py-0.5 font-mono text-neutral-400"
              >
                {s}
              </span>
            ))}
          </div>
        </div>
        <button
          onClick={remove}
          className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:border-red-900 hover:text-red-400"
        >
          delete
        </button>
      </div>

      <div className="mt-4 flex flex-col gap-2">
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="prompt..."
          rows={2}
          disabled={running}
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none disabled:opacity-50"
        />
        <div className="flex justify-between">
          <button
            onClick={run}
            disabled={running || !prompt.trim()}
            className="rounded bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {running ? 'running...' : 'Run'}
          </button>
          {events.length > 0 && (
            <button
              onClick={() => setEvents([])}
              className="text-xs text-neutral-500 hover:text-neutral-300"
            >
              clear output
            </button>
          )}
        </div>
      </div>

      {events.length > 0 && (
        <div
          ref={outputRef}
          className="mt-4 max-h-80 overflow-y-auto rounded border border-neutral-800 bg-neutral-950 p-3 font-mono text-xs"
        >
          {events.map((event, i) => (
            <EventLine key={i} event={event} />
          ))}
        </div>
      )}
    </div>
  )
}

function EventLine({ event }: { event: StreamEvent }) {
  if (typeof event !== 'object' || event === null) return null
  const type = (event as Record<string, unknown>).type

  if (type === 'run:start') {
    return <div className="text-neutral-500">▸ run start</div>
  }
  if (type === 'run:end') {
    const e = event as {
      status: string
      exitCode: number | null
    }
    return (
      <div className={e.status === 'completed' ? 'text-green-500' : 'text-red-400'}>
        ▸ run {e.status} (exit {e.exitCode ?? '?'})
      </div>
    )
  }
  if (type === 'exit') {
    return null // already covered by run:end
  }
  if (type === 'error') {
    return (
      <div className="text-red-400">
        ✗ {(event as { message: string }).message}
      </div>
    )
  }
  if (type === 'stderr') {
    return (
      <div className="text-amber-500">
        ! {(event as { line: string }).line}
      </div>
    )
  }
  if (type === 'raw') {
    return (
      <div className="text-neutral-400">
        {(event as { line: string }).line}
      </div>
    )
  }
  // Claude CLI JSON event — try to render common fields prettily.
  const e = event as Record<string, unknown>
  if (e.type === 'text' && typeof e.text === 'string') {
    return <div className="whitespace-pre-wrap text-neutral-100">{e.text}</div>
  }
  if (
    e.type === 'assistant' &&
    e.message &&
    typeof e.message === 'object' &&
    e.message !== null
  ) {
    const msg = e.message as Record<string, unknown>
    if (Array.isArray(msg.content)) {
      return (
        <div>
          {msg.content.map((part: unknown, i: number) => {
            if (typeof part === 'object' && part !== null) {
              const p = part as Record<string, unknown>
              if (p.type === 'text' && typeof p.text === 'string') {
                return (
                  <div key={i} className="whitespace-pre-wrap text-neutral-100">
                    {p.text}
                  </div>
                )
              }
              if (p.type === 'tool_use') {
                return (
                  <div key={i} className="text-cyan-400">
                    ▸ tool: {String(p.name)}
                  </div>
                )
              }
            }
            return null
          })}
        </div>
      )
    }
  }
  // Fallback: dump JSON.
  return (
    <div className="text-neutral-500">{JSON.stringify(event)}</div>
  )
}
