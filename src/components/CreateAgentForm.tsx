'use client'

import { useCallback, useEffect, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import type { Skill } from '@/lib/skills'

export function CreateAgentForm({ workspaceId }: { workspaceId: string }) {
  const [name, setName] = useState('')
  const [systemPrompt, setSystemPrompt] = useState('')
  const [model, setModel] = useState('')
  // Selected skill names. Picked from a checkbox list populated by
  // the workspace's discovered skills (user + project roots).
  const [selectedSkills, setSelectedSkills] = useState<Set<string>>(
    new Set(),
  )
  const [availableSkills, setAvailableSkills] = useState<Skill[]>([])
  const [skillsError, setSkillsError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [pending, startTransition] = useTransition()
  const router = useRouter()

  const loadSkills = useCallback(async () => {
    setSkillsError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/skills`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        setSkillsError(body.error || 'failed to load skills')
        setAvailableSkills([])
        return
      }
      const body = (await res.json()) as { skills: Skill[] }
      setAvailableSkills(body.skills)
    } catch (err) {
      setSkillsError(err instanceof Error ? err.message : 'failed to load skills')
      setAvailableSkills([])
    }
  }, [workspaceId])

  useEffect(() => {
    loadSkills()
  }, [loadSkills])

  function toggleSkill(name: string) {
    setSelectedSkills((cur) => {
      const next = new Set(cur)
      if (next.has(name)) {
        next.delete(name)
      } else {
        next.add(name)
      }
      return next
    })
  }

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
        skills: Array.from(selectedSkills),
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
    setSelectedSkills(new Set())
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

      <fieldset className="flex flex-col gap-2">
        <legend className="text-xs uppercase tracking-[0.16em] text-neutral-500">
          Skills (pick from this workspace and your user-level set)
        </legend>
        {skillsError && (
          <div className="text-xs text-red-400">{skillsError}</div>
        )}
        {availableSkills.length === 0 && !skillsError && (
          <div className="rounded border border-dashed border-neutral-800 px-3 py-2 text-xs text-neutral-500">
            no skills discovered yet.
          </div>
        )}
        {availableSkills.length > 0 && (
          <div className="grid grid-cols-1 gap-1 rounded border border-neutral-800 bg-neutral-950 p-2 sm:grid-cols-2">
            {availableSkills.map((skill) => {
              const checked = selectedSkills.has(skill.name)
              const key = `${skill.source}:${skill.path}`
              return (
                <label
                  key={key}
                  className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs hover:bg-neutral-900"
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleSkill(skill.name)}
                    className="accent-amber-500"
                  />
                  <span className="font-mono text-neutral-200">
                    {skill.name}
                  </span>
                  <span
                    className={`ml-auto rounded border px-1.5 py-0.5 font-mono text-[10px] ${
                      skill.source === 'project'
                        ? 'border-amber-900 text-amber-500'
                        : 'border-neutral-700 text-neutral-500'
                    }`}
                  >
                    {skill.source}
                  </span>
                </label>
              )
            })}
          </div>
        )}
        {/* If a previously-pinned skill no longer exists on disk, show
            it tagged "missing" so the user can see why it isn't loading. */}
        {Array.from(selectedSkills)
          .filter((s) => !availableSkills.some((a) => a.name === s))
          .map((s) => (
            <label
              key={`missing:${s}`}
              className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-xs text-neutral-500"
            >
              <input
                type="checkbox"
                checked
                onChange={() => toggleSkill(s)}
                className="accent-amber-500"
              />
              <span className="font-mono">{s}</span>
              <span className="ml-auto rounded border border-red-900 px-1.5 py-0.5 font-mono text-[10px] text-red-400">
                missing
              </span>
            </label>
          ))}
      </fieldset>

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
