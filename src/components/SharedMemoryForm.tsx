'use client'

import { useState } from 'react'

type Status =
  | { kind: 'idle' }
  | { kind: 'saving' }
  | { kind: 'ok'; message: string }
  | { kind: 'error'; message: string }

/**
 * Editor for a workspace's shared MEMORY.md. Writes through the
 * /api/workspaces/[id]/memory endpoint. Empty save clears the file.
 */
export function SharedMemoryForm({
  workspaceId,
  initialContent,
}: {
  workspaceId: string
  initialContent: string
}) {
  const [content, setContent] = useState(initialContent)
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  async function save() {
    setStatus({ kind: 'saving' })
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/memory`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setStatus({
          kind: 'error',
          message: body.error || 'save failed',
        })
        return
      }
      setStatus({
        kind: 'ok',
        message: content.trim() ? 'saved' : 'cleared',
      })
    } catch (err) {
      setStatus({
        kind: 'error',
        message: err instanceof Error ? err.message : 'save failed',
      })
    }
  }

  return (
    <div className="flex flex-col gap-2">
      <textarea
        value={content}
        onChange={(e) => {
          setContent(e.target.value)
          if (status.kind !== 'idle' && status.kind !== 'saving') {
            setStatus({ kind: 'idle' })
          }
        }}
        placeholder="Notes, conventions, code style. Prepended to every agent's system prompt in this workspace."
        rows={6}
        className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-xs leading-relaxed focus:border-neutral-600 focus:outline-none"
      />
      <div className="flex items-center gap-3">
        <button
          onClick={save}
          disabled={status.kind === 'saving'}
          className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-amber-400 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {status.kind === 'saving' ? 'saving...' : 'Save memory'}
        </button>
        {status.kind === 'ok' && (
          <span className="text-xs text-neutral-500">{status.message}</span>
        )}
        {status.kind === 'error' && (
          <span className="text-xs text-red-400">{status.message}</span>
        )}
        <span className="ml-auto font-mono text-[10px] text-neutral-600">
          .argus/MEMORY.md
        </span>
      </div>
    </div>
  )
}
