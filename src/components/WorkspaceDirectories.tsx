'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { WorkspaceDirectory } from '@/lib/schema'

/**
 * Manage the list of working directories attached to a workspace. The
 * server renders the initial list, this component handles add / remove
 * and triggers `router.refresh()` so the rest of the page (the agent
 * form's directory dropdown in particular) stays in sync.
 */
export function WorkspaceDirectories({
  workspaceId,
  initialDirectories,
}: {
  workspaceId: string
  initialDirectories: WorkspaceDirectory[]
}) {
  const [directories, setDirectories] =
    useState<WorkspaceDirectory[]>(initialDirectories)
  const [path, setPath] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!path.trim()) {
      setError('path is required')
      return
    }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/directories`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ path: path.trim(), label: label.trim() }),
        },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'failed to add directory')
        return
      }
      const body = (await res.json()) as { directory: WorkspaceDirectory }
      setDirectories((cur) => [...cur, body.directory])
      setPath('')
      setLabel('')
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  async function remove(dirId: string) {
    if (directories.length <= 1) return
    if (!confirm('remove this directory? agents bound to it will fall back to the first directory.'))
      return
    setBusy(true)
    setError(null)
    try {
      const res = await fetch(
        `/api/workspaces/${workspaceId}/directories/${dirId}`,
        { method: 'DELETE' },
      )
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        setError(body.error || 'failed to remove directory')
        return
      }
      setDirectories((cur) => cur.filter((d) => d.id !== dirId))
      router.refresh()
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <ul className="flex flex-col divide-y divide-neutral-800 overflow-hidden rounded border border-neutral-800">
        {directories.length === 0 && (
          <li className="px-3 py-2 text-xs text-neutral-500">
            no directories yet.
          </li>
        )}
        {directories.map((dir, i) => (
          <li
            key={dir.id}
            className="grid grid-cols-[auto_1fr_auto] items-center gap-3 bg-neutral-950 px-3 py-2 text-xs"
          >
            <span
              className={`rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                i === 0
                  ? 'border-amber-900 text-amber-500'
                  : 'border-neutral-700 text-neutral-500'
              }`}
            >
              {i === 0 ? 'default' : (dir.label || `dir ${i + 1}`)}
            </span>
            <span className="truncate font-mono text-neutral-200">
              {dir.path}
            </span>
            <button
              onClick={() => remove(dir.id)}
              disabled={busy || directories.length <= 1}
              className="rounded border border-neutral-800 px-2 py-0.5 text-[10px] text-neutral-500 hover:border-red-900 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
              title={
                directories.length <= 1
                  ? 'cannot remove the only directory'
                  : 'remove'
              }
            >
              remove
            </button>
          </li>
        ))}
      </ul>

      <form
        onSubmit={add}
        className="flex flex-col gap-2 rounded border border-dashed border-neutral-800 bg-neutral-900/40 p-3 sm:flex-row sm:items-end"
      >
        <label className="flex flex-1 flex-col gap-1">
          <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            path
          </span>
          <input
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="/Users/you/another-project"
            className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 font-mono text-xs focus:border-neutral-600 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1 sm:w-40">
          <span className="text-[10px] uppercase tracking-[0.16em] text-neutral-500">
            label (optional)
          </span>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="api"
            className="rounded border border-neutral-800 bg-neutral-950 px-2 py-1.5 text-xs focus:border-neutral-600 focus:outline-none"
          />
        </label>
        <button
          type="submit"
          disabled={busy}
          className="rounded bg-amber-500 px-3 py-1.5 text-xs font-medium text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50"
        >
          {busy ? 'working...' : 'Add directory'}
        </button>
      </form>

      {error && <div className="text-xs text-red-400">{error}</div>}
    </div>
  )
}
