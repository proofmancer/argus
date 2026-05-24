import { promises as fs } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * Discovery for Claude Code "skills" on the local machine.
 *
 * A skill is a directory containing a SKILL.md file with YAML
 * frontmatter (at minimum a name, usually a description). Two roots
 * matter:
 *
 *   user:    ~/.claude/skills/<skill>/SKILL.md
 *   project: <workspace.cwd>/.claude/skills/<skill>/SKILL.md
 *
 * For v1 we scan one level deep under each root. If a frontmatter
 * block is missing or malformed we fall back to the directory name
 * and an empty description rather than throwing, so a single bad
 * skill doesn't break the marketplace.
 */

export type SkillSource = 'user' | 'project'

export type Skill = {
  /** Display name. From frontmatter `name`, falling back to dir name. */
  name: string
  /** Free-text description. From frontmatter `description`, may be empty. */
  description: string
  /** Where we found it. */
  source: SkillSource
  /** Absolute path to the SKILL.md on disk. */
  path: string
}

function userSkillsRoot(): string {
  return path.join(os.homedir(), '.claude', 'skills')
}

function projectSkillsRoot(workspaceCwd: string): string {
  return path.join(workspaceCwd, '.claude', 'skills')
}

/**
 * List skills under a single root. Returns [] if the root does not
 * exist. Skill directories without SKILL.md are skipped silently.
 */
async function scanRoot(
  root: string,
  source: SkillSource,
): Promise<Skill[]> {
  let entries: import('node:fs').Dirent[]
  try {
    entries = await fs.readdir(root, { withFileTypes: true })
  } catch {
    return []
  }

  const skills: Skill[] = []
  for (const entry of entries) {
    if (!entry.isDirectory()) continue
    const skillMd = path.join(root, entry.name, 'SKILL.md')
    let raw: string
    try {
      raw = await fs.readFile(skillMd, 'utf8')
    } catch {
      // No SKILL.md in this directory, skip.
      continue
    }
    const fm = parseFrontmatter(raw)
    skills.push({
      name: typeof fm.name === 'string' && fm.name.trim() ? fm.name.trim() : entry.name,
      description:
        typeof fm.description === 'string' ? fm.description.trim() : '',
      source,
      path: skillMd,
    })
  }
  return skills
}

/**
 * Returns the union of user + project skills. Both roots may contain
 * a skill with the same name; we keep both, distinguished by source.
 */
export async function scanSkills(workspaceCwd: string): Promise<Skill[]> {
  const [userSkills, projectSkills] = await Promise.all([
    scanRoot(userSkillsRoot(), 'user'),
    scanRoot(projectSkillsRoot(workspaceCwd), 'project'),
  ])
  return [...userSkills, ...projectSkills].sort((a, b) => {
    if (a.source !== b.source) return a.source === 'project' ? -1 : 1
    return a.name.localeCompare(b.name)
  })
}

/**
 * Tiny YAML frontmatter parser. Handles only the shape Claude Code
 * skills use: a leading `---` block, one `key: value` per line, no
 * nested structures. Anything fancier falls back to {} so the caller
 * uses sensible defaults.
 */
function parseFrontmatter(src: string): Record<string, string> {
  const trimmed = src.replace(/^﻿/, '')
  if (!trimmed.startsWith('---')) return {}
  const end = trimmed.indexOf('\n---', 3)
  if (end < 0) return {}
  const block = trimmed.slice(3, end).trim()
  const out: Record<string, string> = {}
  for (const line of block.split('\n')) {
    const m = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/)
    if (!m) continue
    let value = m[2].trim()
    // Strip surrounding quotes if present.
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    out[m[1]] = value
  }
  return out
}
