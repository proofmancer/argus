import Link from 'next/link'
import { db, schema } from '@/lib/db'
import { desc } from 'drizzle-orm'
import { CreateWorkspaceForm } from '@/components/CreateWorkspaceForm'

export const dynamic = 'force-dynamic'

export default async function Home() {
  const workspaces = await db
    .select()
    .from(schema.workspaces)
    .orderBy(desc(schema.workspaces.createdAt))

  return (
    <div className="flex flex-col gap-10">
      <section>
        <h1 className="text-2xl font-semibold tracking-tight">Workspaces</h1>
        <p className="mt-1 max-w-2xl text-sm text-neutral-400">
          A workspace points at a folder on disk. Agents in that workspace
          inherit the folder as their cwd. Skills, settings, and hooks come
          from the folder&apos;s <code>.claude/</code> config.
        </p>
      </section>

      <section className="grid gap-3 sm:grid-cols-2">
        {workspaces.length === 0 && (
          <div className="rounded-lg border border-dashed border-neutral-800 p-6 text-sm text-neutral-500 sm:col-span-2">
            No workspaces yet. Create one below to spawn your first agent.
          </div>
        )}
        {workspaces.map((ws) => (
          <Link
            key={ws.id}
            href={`/workspace/${ws.id}`}
            className="group rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 transition hover:border-neutral-700 hover:bg-neutral-900/70"
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium tracking-tight">{ws.name}</div>
              <span className="text-xs text-neutral-500 group-hover:text-neutral-300">
                open →
              </span>
            </div>
            <div className="mt-1 truncate font-mono text-xs text-neutral-500">
              {ws.cwd}
            </div>
          </Link>
        ))}
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Create workspace
        </h2>
        <div className="mt-3 max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <CreateWorkspaceForm />
        </div>
      </section>
    </div>
  )
}
