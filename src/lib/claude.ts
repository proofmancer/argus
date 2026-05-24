import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process'
import { promises as fs } from 'node:fs'
import path from 'node:path'

/**
 * Helpers for spawning the local `claude` CLI as a child process and
 * streaming its output.
 *
 * Two requirements drive the design:
 *
 *   1. We use the Max plan (no API key). The user has already
 *      authenticated with `claude` on their machine; we just need to
 *      shell out and let the CLI handle auth itself.
 *
 *   2. Output needs to stream back to the UI in real time. We use
 *      claude's `--output-format=stream-json` so each event (text
 *      chunk, tool call, system message) arrives as a single JSONL
 *      line on stdout that we can forward straight to the client.
 */

export type AgentRunOptions = {
  prompt: string
  cwd: string
  /**
   * Directory to read shared MEMORY.md from. Defaults to `cwd` if not
   * set. Used by workspaces with multiple directories: the run cwd may
   * be a non-default directory, but memory stays anchored to the
   * workspace's default cwd so it's the same for every agent.
   */
  memoryCwd?: string
  systemPrompt?: string
  model?: string | null
  skills?: string[]
}

/**
 * Spawn `claude -p` with the requested prompt and stream JSONL events
 * back. The caller iterates the returned async generator. Each yield
 * is one parsed JSON event from the claude CLI; the final yield is a
 * synthetic `{ type: 'exit', code }` after the child exits.
 *
 * `cwd` is the working directory the agent runs in (workspace path).
 * `systemPrompt` is appended via `--append-system-prompt`.
 * `model` overrides the default model if set.
 * `skills` is forwarded as a comma-separated list to whatever skill
 * config the CLI expects (currently a no-op slot for the v0.1; future
 * work will write a per-run .claude/settings.local.json).
 */
export async function* runAgent(opts: AgentRunOptions) {
  const args = ['-p', opts.prompt, '--output-format=stream-json', '--verbose']

  // Compose the effective system prompt: workspace shared memory
  // (if any) first, then the agent's own system prompt. Wrapped in
  // labeled fences so the agent can tell where each layer ends.
  // memoryCwd lets a workspace with multiple directories keep one
  // shared memory at the default directory regardless of where the
  // agent actually runs.
  const memory = await readWorkspaceMemory(opts.memoryCwd ?? opts.cwd)
  const own = (opts.systemPrompt ?? '').trim()
  const parts: string[] = []
  if (memory) {
    parts.push(`# workspace memory\n${memory}\n# end workspace memory`)
  }
  if (own) parts.push(own)
  const effectiveSystemPrompt = parts.join('\n\n')
  if (effectiveSystemPrompt) {
    args.push('--append-system-prompt', effectiveSystemPrompt)
  }
  if (opts.model && opts.model.trim()) {
    args.push('--model', opts.model)
  }

  // Make sure the cwd exists. Claude itself will error out if it
  // doesn't, but a clearer error here saves a roundtrip.
  try {
    const stat = await fs.stat(opts.cwd)
    if (!stat.isDirectory()) {
      yield {
        type: 'error',
        message: `cwd is not a directory: ${opts.cwd}`,
      }
      yield { type: 'exit', code: 1 }
      return
    }
  } catch {
    yield { type: 'error', message: `cwd does not exist: ${opts.cwd}` }
    yield { type: 'exit', code: 1 }
    return
  }

  let child: ChildProcessWithoutNullStreams
  try {
    child = spawn('claude', args, {
      cwd: opts.cwd,
      env: { ...process.env },
    })
  } catch (err) {
    yield {
      type: 'error',
      message: `failed to spawn claude: ${err instanceof Error ? err.message : String(err)}`,
    }
    yield { type: 'exit', code: 1 }
    return
  }

  // Forward stdout as JSONL events. Buffer partial lines across
  // chunks so we never yield half a JSON object.
  let stdoutBuf = ''
  let stderrBuf = ''
  const queue: unknown[] = []
  let exited = false
  let exitCode: number | null = null
  let resolver: (() => void) | null = null

  function notify() {
    if (resolver) {
      resolver()
      resolver = null
    }
  }

  child.stdout.setEncoding('utf8')
  child.stdout.on('data', (chunk: string) => {
    stdoutBuf += chunk
    let idx: number
    while ((idx = stdoutBuf.indexOf('\n')) >= 0) {
      const line = stdoutBuf.slice(0, idx).trim()
      stdoutBuf = stdoutBuf.slice(idx + 1)
      if (!line) continue
      try {
        queue.push(JSON.parse(line))
      } catch {
        // Not JSON — forward as raw text so we don't drop signal.
        queue.push({ type: 'raw', line })
      }
    }
    notify()
  })

  child.stderr.setEncoding('utf8')
  child.stderr.on('data', (chunk: string) => {
    stderrBuf += chunk
    // Emit stderr line-by-line so the UI can show it interleaved.
    let idx: number
    while ((idx = stderrBuf.indexOf('\n')) >= 0) {
      const line = stderrBuf.slice(0, idx)
      stderrBuf = stderrBuf.slice(idx + 1)
      queue.push({ type: 'stderr', line })
    }
    notify()
  })

  child.on('error', (err) => {
    queue.push({
      type: 'error',
      message: `spawn error: ${err.message}`,
    })
    notify()
  })

  child.on('exit', (code) => {
    if (stdoutBuf.trim()) {
      try {
        queue.push(JSON.parse(stdoutBuf.trim()))
      } catch {
        queue.push({ type: 'raw', line: stdoutBuf.trim() })
      }
      stdoutBuf = ''
    }
    if (stderrBuf.trim()) {
      queue.push({ type: 'stderr', line: stderrBuf.trim() })
      stderrBuf = ''
    }
    exited = true
    exitCode = code
    notify()
  })

  while (true) {
    if (queue.length > 0) {
      const next = queue.shift()
      yield next
      continue
    }
    if (exited) break
    await new Promise<void>((res) => {
      resolver = res
    })
  }

  yield { type: 'exit', code: exitCode ?? 0 }
}

/**
 * Path on disk where a workspace's shared memory lives. Sibling to
 * .claude/, scoped to argus so it doesn't collide with anything else
 * the workspace might be using.
 */
export function workspaceMemoryPath(cwd: string): string {
  return path.join(cwd, '.argus', 'MEMORY.md')
}

/**
 * Read the workspace's shared memory file. Returns an empty string if
 * the file is missing, empty, or unreadable. Trimmed so an all-blank
 * file behaves the same as no file.
 */
export async function readWorkspaceMemory(cwd: string): Promise<string> {
  try {
    const raw = await fs.readFile(workspaceMemoryPath(cwd), 'utf8')
    return raw.trim()
  } catch {
    return ''
  }
}

/**
 * Write a per-agent .claude/settings.local.json into the workspace
 * cwd that enables the listed skills. Best-effort: if writing fails
 * we just skip and let claude run with whatever's already configured.
 *
 * Currently this just adds the skill names under a `skillOverrides`
 * stub; the actual mechanism for pinning skills is going to evolve.
 * Real implementation will write a proper agent definition file.
 */
export async function writeAgentSkillConfig(
  cwd: string,
  skills: string[],
): Promise<void> {
  if (!skills.length) return
  const dir = path.join(cwd, '.claude')
  try {
    await fs.mkdir(dir, { recursive: true })
    // Don't clobber an existing settings.local.json — read and merge.
    const target = path.join(dir, 'settings.local.json')
    let existing: Record<string, unknown> = {}
    try {
      const raw = await fs.readFile(target, 'utf8')
      existing = JSON.parse(raw)
    } catch {
      // file missing or unparseable — start fresh
    }
    const merged = {
      ...existing,
      argus: {
        pinnedSkills: skills,
        pinnedAt: new Date().toISOString(),
      },
    }
    await fs.writeFile(target, JSON.stringify(merged, null, 2) + '\n', 'utf8')
  } catch {
    // ignore; the run will still happen without skill pinning
  }
}
