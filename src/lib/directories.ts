import { asc, eq } from 'drizzle-orm'
import { db, schema } from './db'
import type { Agent, Workspace, WorkspaceDirectory } from './schema'

/**
 * Helpers around the workspace_directories table. Centralized here so
 * routes and the run pipeline agree on what "the workspace's directories"
 * means: ordered by created_at ascending, oldest-first (mirrors the
 * order the user added them).
 */

export async function listDirectories(
  workspaceId: string,
): Promise<WorkspaceDirectory[]> {
  return db
    .select()
    .from(schema.workspaceDirectories)
    .where(eq(schema.workspaceDirectories.workspaceId, workspaceId))
    .orderBy(asc(schema.workspaceDirectories.createdAt))
}

/**
 * Resolve the cwd a given agent will actually run in.
 *
 * Order of preference:
 *   1. The directory the agent is bound to via directoryId.
 *   2. The workspace's first (oldest) directory row.
 *   3. The legacy workspaces.cwd column as a last-resort fallback.
 *
 * Always returns a string. If everything is missing we return
 * `workspace.cwd` rather than throwing so the run can still happen.
 */
export async function resolveAgentCwd(
  agent: Agent,
  workspace: Workspace,
): Promise<string> {
  if (agent.directoryId) {
    const [dir] = await db
      .select()
      .from(schema.workspaceDirectories)
      .where(eq(schema.workspaceDirectories.id, agent.directoryId))
    if (dir) return dir.path
  }
  const dirs = await listDirectories(workspace.id)
  if (dirs.length > 0) return dirs[0].path
  return workspace.cwd
}

/**
 * Mirror a new workspace's `cwd` into a directory row labeled
 * "default". Called from the workspace POST handler so freshly created
 * workspaces have a directory row from the start. Backfill in
 * ensureMigrated() handles pre-existing rows.
 */
export async function ensureDefaultDirectory(
  workspaceId: string,
  cwd: string,
): Promise<void> {
  const existing = await listDirectories(workspaceId)
  if (existing.length > 0) return
  await db.insert(schema.workspaceDirectories).values({
    workspaceId,
    path: cwd,
    label: 'default',
  })
}
