'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

type DirRow = { path: string; label: string }

const EMPTY_ROW: DirRow = { path: '', label: '' }

export function CreateWorkspaceForm() {
  const [name, setName] = useState('')
  // Start with one empty row. The user can add more before submitting.
  // The first row's path also becomes workspaces.cwd (the default).
  const [dirs, setDirs] = useState<DirRow[]>([{ ...EMPTY_ROW }])
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  function updateRow(i: number, patch: Partial<DirRow>) {
    setDirs((cur) =>
      cur.map((row, idx) => (idx === i ? { ...row, ...patch } : row)),
    )
  }
  function addRow() {
    setDirs((cur) => [...cur, { ...EMPTY_ROW }])
  }
  function removeRow(i: number) {
    setDirs((cur) => (cur.length <= 1 ? cur : cur.filter((_, idx) => idx !== i)))
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('name is required')
      return
    }
    const cleaned = dirs
      .map((d) => ({ path: d.path.trim(), label: d.label.trim() }))
      .filter((d) => d.path)
    if (cleaned.length === 0) {
      setError('at least one directory is required')
      return
    }
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: name.trim(),
        // First directory is the default; mirror to legacy cwd so
        // existing API consumers keep working.
        cwd: cleaned[0].path,
        directories: cleaned,
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'failed to create')
      return
    }
    setName('')
    setDirs([{ ...EMPTY_ROW }])
    startTransition(() => router.refresh())
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-3">
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">
          Name
        </span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="my project"
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs uppercase tracking-[0.16em] text-neutral-500">
          Directories (absolute paths)
        </legend>
        <div className="flex flex-col gap-2">
          {dirs.map((dir, i) => (
            <div
              key={i}
              className="grid grid-cols-[auto_1fr_10rem_auto] items-center gap-2"
            >
              <span
                className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                  i === 0
                    ? 'border-amber-900 text-amber-500'
                    : 'border-neutral-700 text-neutral-500'
                }`}
                title={i === 0 ? 'default cwd' : `directory ${i + 1}`}
              >
                {i === 0 ? 'default' : i + 1}
              </span>
              <input
                type="text"
                value={dir.path}
                onChange={(e) => updateRow(i, { path: e.target.value })}
                placeholder="/Users/you/code/my-project"
                className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm focus:border-neutral-600 focus:outline-none"
              />
              <input
                type="text"
                value={dir.label}
                onChange={(e) => updateRow(i, { label: e.target.value })}
                placeholder="label (optional)"
                className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => removeRow(i)}
                disabled={dirs.length <= 1}
                className="rounded border border-neutral-800 px-2 py-1 text-xs text-neutral-500 hover:border-red-900 hover:text-red-400 disabled:cursor-not-allowed disabled:opacity-40"
                title={
                  dirs.length <= 1
                    ? 'a workspace needs at least one directory'
                    : 'remove this directory'
                }
              >
                remove
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addRow}
          className="self-start text-xs text-neutral-500 hover:text-neutral-300"
        >
          + add another directory
        </button>
        <p className="text-[10px] text-neutral-600">
          the first one is the default cwd. agents that don&apos;t pick a
          specific directory run there.
        </p>
      </fieldset>

      {error && <div className="text-sm text-red-400">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? 'creating...' : 'Create workspace'}
      </button>
    </form>
  )
}
