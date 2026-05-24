'use client'

import { useCallback, useEffect, useState } from 'react'
import type { Skill } from '@/lib/skills'

/**
 * Grid of skills discovered under the workspace's `.claude/skills/`
 * and the user-level `~/.claude/skills/`. Read-only browsing surface.
 * The agent form (CreateAgentForm) reuses the same fetch to let the
 * user pick which ones to pin per agent.
 */
export function SkillsGrid({ workspaceId }: { workspaceId: string }) {
  const [skills, setSkills] = useState<Skill[] | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/workspaces/${workspaceId}/skills`)
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          error?: string
        }
        setError(body.error || 'failed to load skills')
        setSkills([])
        return
      }
      const body = (await res.json()) as { skills: Skill[] }
      setSkills(body.skills)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'failed to load skills')
      setSkills([])
    } finally {
      setLoading(false)
    }
  }, [workspaceId])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div>
      <div className="flex items-center justify-between">
        <p className="text-xs text-neutral-500">
          Discovered under <code className="font-mono">~/.claude/skills/</code>{' '}
          and{' '}
          <code className="font-mono">
            &lt;workspace&gt;/.claude/skills/
          </code>
          .
        </p>
        <button
          onClick={load}
          disabled={loading}
          className="text-xs text-neutral-500 hover:text-neutral-300 disabled:opacity-50"
        >
          {loading ? 'scanning...' : 'rescan'}
        </button>
      </div>

      {error && <div className="mt-2 text-xs text-red-400">{error}</div>}

      {skills && skills.length === 0 && !error && (
        <div className="mt-3 rounded border border-dashed border-neutral-800 p-4 text-xs text-neutral-500">
          no skills found. drop a SKILL.md under{' '}
          <code className="font-mono">~/.claude/skills/&lt;name&gt;/</code> or{' '}
          <code className="font-mono">
            &lt;workspace&gt;/.claude/skills/&lt;name&gt;/
          </code>
          .
        </div>
      )}

      {skills && skills.length > 0 && (
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {skills.map((skill) => (
            <SkillCard key={`${skill.source}:${skill.path}`} skill={skill} />
          ))}
        </div>
      )}
    </div>
  )
}

function SkillCard({ skill }: { skill: Skill }) {
  return (
    <div className="flex flex-col gap-2 rounded border border-neutral-800 bg-neutral-900/40 p-3">
      <div className="flex items-start justify-between gap-2">
        <div className="font-mono text-sm font-medium text-neutral-100">
          {skill.name}
        </div>
        <SourceBadge source={skill.source} />
      </div>
      {skill.description ? (
        <p className="line-clamp-2 text-xs text-neutral-400">
          {skill.description}
        </p>
      ) : (
        <p className="text-xs text-neutral-600 italic">no description</p>
      )}
    </div>
  )
}

function SourceBadge({ source }: { source: 'user' | 'project' }) {
  const classes =
    source === 'project'
      ? 'border-amber-900 text-amber-500'
      : 'border-neutral-700 text-neutral-400'
  return (
    <span
      className={`shrink-0 rounded border px-1.5 py-0.5 font-mono text-[10px] ${classes}`}
    >
      {source}
    </span>
  )
}
