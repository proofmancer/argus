import Database from 'better-sqlite3'
import { drizzle } from 'drizzle-orm/better-sqlite3'
import path from 'node:path'
import * as schema from './schema'

/**
 * SQLite + Drizzle setup.
 *
 * The DB file lives at the project root (./argus.db) so it travels
 * with the source — no external state. better-sqlite3 is synchronous
 * and fast enough for single-user local app loads.
 *
 * In Next.js dev mode the module is re-imported on hot reloads, which
 * would normally open a new connection each time. We cache the
 * Database instance on globalThis so reloads keep the same handle and
 * we don't leak file descriptors.
 */
declare global {
  // eslint-disable-next-line no-var
  var __argus_db: Database.Database | undefined
}

const DB_PATH =
  process.env.ARGUS_DB_PATH || path.join(process.cwd(), 'argus.db')

const sqlite = globalThis.__argus_db ?? new Database(DB_PATH)
sqlite.pragma('journal_mode = WAL')
sqlite.pragma('foreign_keys = ON')

if (process.env.NODE_ENV !== 'production') {
  globalThis.__argus_db = sqlite
}

export const db = drizzle(sqlite, { schema })

/**
 * Run pending migrations at import time. Called once per process.
 * Cheap because better-sqlite3 keeps the migration tracker in the
 * same SQLite file.
 */
export function ensureMigrated() {
  // Inline minimal migration: create tables if missing. Drizzle Kit
  // can replace this with proper migration files later (`pnpm
  // db:generate`), but for v0.1 we want zero-setup boot.
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS workspaces (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      cwd TEXT NOT NULL,
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS agents (
      id TEXT PRIMARY KEY,
      workspace_id TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      system_prompt TEXT DEFAULT '',
      model TEXT,
      skills TEXT DEFAULT '[]',
      created_at INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS runs (
      id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
      prompt TEXT NOT NULL,
      output TEXT DEFAULT '',
      status TEXT NOT NULL DEFAULT 'running',
      exit_code INTEGER,
      started_at INTEGER NOT NULL,
      ended_at INTEGER
    );
    CREATE INDEX IF NOT EXISTS idx_agents_workspace ON agents(workspace_id);
    CREATE INDEX IF NOT EXISTS idx_runs_agent ON runs(agent_id);
    CREATE INDEX IF NOT EXISTS idx_runs_started ON runs(started_at DESC);
  `)
}

ensureMigrated()

export { schema }
