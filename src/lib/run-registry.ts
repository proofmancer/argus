import type { ChildProcessWithoutNullStreams } from 'node:child_process'

/**
 * Process-local registry mapping runId -> the child process spawned
 * for that run. Used by the Stop endpoint to find and SIGTERM a run
 * that was started in a different request.
 *
 * In-memory only, single process. A `next start` worker restart drops
 * the map and any leftover process becomes an orphan (cleaned up by
 * the OS or by exiting on its own). Good enough for a local single-
 * user app; revisit if Argus ever runs multi-process.
 *
 * Cached on globalThis so Next.js dev's module hot reload doesn't
 * silently fork the map.
 */

declare global {
  // eslint-disable-next-line no-var
  var __argus_run_registry: Map<string, ChildProcessWithoutNullStreams> | undefined
}

const registry: Map<string, ChildProcessWithoutNullStreams> =
  globalThis.__argus_run_registry ??
  (globalThis.__argus_run_registry = new Map())

export function registerRun(
  runId: string,
  child: ChildProcessWithoutNullStreams,
): void {
  registry.set(runId, child)
  // Auto-clean when the process exits, so the map doesn't grow forever
  // and so a Stop request after a natural exit just no-ops cleanly.
  child.once('exit', () => {
    if (registry.get(runId) === child) registry.delete(runId)
  })
}

export function unregisterRun(runId: string): void {
  registry.delete(runId)
}

export function isRunning(runId: string): boolean {
  return registry.has(runId)
}

/**
 * SIGTERM the run's process group. Returns true if a process was
 * found and signaled, false if there's nothing to kill (already
 * exited, never registered, etc).
 *
 * Targets `-pid` (negative) so the signal hits the whole process group
 * the child was placed into (see detached:true on spawn). That kills
 * any tool subprocesses claude itself started.
 */
export function killRun(runId: string): boolean {
  const child = registry.get(runId)
  if (!child || child.pid == null) return false
  try {
    process.kill(-child.pid, 'SIGTERM')
    return true
  } catch {
    // Process already gone or signal not permitted; either way, drop
    // it from the map so we don't try again.
    registry.delete(runId)
    return false
  }
}
