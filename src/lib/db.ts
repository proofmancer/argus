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

function openSqlite(file: string): Database.Database {
  const d = new Database(file)
  d.pragma('busy_timeout = 5000')
  d.pragma('journal_mode = WAL')
  d.pragma('foreign_keys = ON')
  return d
}

// During `next build`, Next.js spawns multiple worker processes that
// each import this module in parallel. Setting `journal_mode = WAL`
// requires an exclusive lock and does NOT honor busy_timeout, so the
// races produce SQLITE_BUSY on the file DB. Build never executes
// queries; it just imports modules for static analysis. So during the
// build phase we point at an in-memory DB instead, which is per-process
// and conflict-free. At `next start` and `next dev` we hit the real
// file as usual.
const isBuild = process.env.NEXT_PHASE === 'phase-production-build'
const sqlite =
  globalThis.__argus_db ?? openSqlite(isBuild ? ':memory:' : DB_PATH)

if (!isBuild && process.env.NODE_ENV !== 'production') {
  globalThis.__argus_db = sqlite
}

export const db = drizzle(sqlite, { schema })

/**
 * Run pending migrations at import time. Called once per process.
 * Cheap because better-sqlite3 keeps the migration tracker in the
 * same SQLite file.
 *
 * The schema is fully idempotent (CREATE ... IF NOT EXISTS), so a
 * SQLITE_BUSY from a parallel build worker that already migrated is
 * harmless: we swallow it and trust the peer's success.
 */
export function ensureMigrated() {
  try {
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
  } catch (err) {
    const code =
      err && typeof err === 'object' && 'code' in err
        ? (err as { code?: string }).code
        : undefined
    if (code === 'SQLITE_BUSY') return
    throw err
  }
}

ensureMigrated()

export { schema }
