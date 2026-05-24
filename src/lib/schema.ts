import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'
import { nanoid } from 'nanoid'

/**
 * Workspaces: top-level container. Each workspace points at a working
 * directory on disk. Claude Code agents in this workspace inherit that
 * directory as their cwd and pick up its .claude/ config (skills,
 * settings, hooks) automatically.
 */
export const workspaces = sqliteTable('workspaces', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  name: text('name').notNull(),
  cwd: text('cwd').notNull(),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

/**
 * Agents: per-workspace claude-code persona. Has a name, a system
 * prompt that gets prepended to every run, optional model override,
 * and an optional list of skills (skill names that should be active
 * for this agent — written to .claude/settings.local.json when the
 * agent runs).
 */
export const agents = sqliteTable('agents', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  workspaceId: text('workspace_id')
    .notNull()
    .references(() => workspaces.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  systemPrompt: text('system_prompt').default(''),
  model: text('model'), // null = use claude default
  skills: text('skills', { mode: 'json' }).$type<string[]>().default([]),
  createdAt: integer('created_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
})

/**
 * Runs: each invocation of an agent. Captures the prompt, the streamed
 * output, exit status, and timing. Useful for observability and the
 * "what did this agent do last week" question.
 */
export const runs = sqliteTable('runs', {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid(12)),
  agentId: text('agent_id')
    .notNull()
    .references(() => agents.id, { onDelete: 'cascade' }),
  prompt: text('prompt').notNull(),
  output: text('output').default(''),
  status: text('status', {
    enum: ['running', 'completed', 'failed', 'cancelled'],
  })
    .notNull()
    .default('running'),
  exitCode: integer('exit_code'),
  startedAt: integer('started_at', { mode: 'timestamp' })
    .notNull()
    .$defaultFn(() => new Date()),
  endedAt: integer('ended_at', { mode: 'timestamp' }),
})

export type Workspace = typeof workspaces.$inferSelect
export type Agent = typeof agents.$inferSelect
export type Run = typeof runs.$inferSelect
