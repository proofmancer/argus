'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function CreateWorkspaceForm() {
  const [name, setName] = useState('')
  const [cwd, setCwd] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim() || !cwd.trim()) {
      setError('name and cwd are required')
      return
    }
    const res = await fetch('/api/workspaces', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: name.trim(), cwd: cwd.trim() }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'failed to create')
      return
    }
    setName('')
    setCwd('')
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
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">
          Working directory (absolute path)
        </span>
        <input
          type="text"
          value={cwd}
          onChange={(e) => setCwd(e.target.value)}
          placeholder="/Users/you/code/my-project"
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>
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
