'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'

export function CreateAgentForm({ workspaceId }: { workspaceId: string }) {
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  const [skills, setSkills] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!name.trim()) {
      setError('name is required')
      return
    }
    const res = await fetch('/api/agents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        workspaceId,
        name: name.trim(),
        systemPrompt: systemPrompt.trim(),
        model: model.trim() || null,
        skills: skills
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      setError(body.error || 'failed to create')
      return
    }
    setName('')
    setSystemPrompt('')
    setModel('')
    setSkills('')
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
          placeholder="reviewer"
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>
      <label className="flex flex-col gap-1">
        <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">
          System prompt (the agent&apos;s persistent role)
        </span>
        <textarea
          value={systemPrompt}
          onChange={(e) => setSystemPrompt(e.target.value)}
          placeholder="You are a senior code reviewer. Comment line-by-line on the diff..."
          rows={3}
          className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm focus:border-neutral-600 focus:outline-none"
        />
      </label>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">
            Model (optional, e.g. opus / sonnet)
          </span>
          <input
            type="text"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            placeholder="sonnet"
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm focus:border-neutral-600 focus:outline-none"
          />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs uppercase tracking-[0.16em] text-neutral-500">
            Skills (comma-separated)
          </span>
          <input
            type="text"
            value={skills}
            onChange={(e) => setSkills(e.target.value)}
            placeholder="review, simplify"
            className="rounded border border-neutral-800 bg-neutral-950 px-3 py-2 font-mono text-sm focus:border-neutral-600 focus:outline-none"
          />
        </label>
      </div>
      {error && <div className="text-sm text-red-400">{error}</div>}
      <button
        type="submit"
        disabled={pending}
        className="self-start rounded bg-amber-500 px-4 py-2 text-sm font-medium text-neutral-950 transition hover:bg-amber-400 disabled:opacity-50"
      >
        {pending ? 'creating...' : 'Create agent'}
      </button>
    </form>
  )
}
