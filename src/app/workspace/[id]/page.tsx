import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db, schema } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { CreateAgentForm } from '@/components/CreateAgentForm'
import { AgentPanel } from '@/components/AgentPanel'

export const dynamic = 'force-dynamic'

export default async function WorkspacePage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const [workspace] = await db
    .select()
    .from(schema.workspaces)
    .where(eq(schema.workspaces.id, id))
  if (!workspace) notFound()

  const agents = await db
    .select()
    .from(schema.agents)
    .where(eq(schema.agents.workspaceId, id))
    .orderBy(desc(schema.agents.createdAt))

  return (
    <div className="flex flex-col gap-10">
      <section>
        <Link
          href="/"
          className="text-xs text-neutral-500 hover:text-neutral-300"
        >
          ← all workspaces
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">
          {workspace.name}
        </h1>
        <div className="mt-1 font-mono text-xs text-neutral-500">
          {workspace.cwd}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Agents
        </h2>
        <div className="mt-3 flex flex-col gap-4">
          {agents.length === 0 && (
            <div className="rounded-lg border border-dashed border-neutral-800 p-6 text-sm text-neutral-500">
              No agents in this workspace yet. Create one below.
            </div>
          )}
          {agents.map((agent) => (
            <AgentPanel key={agent.id} agent={agent} />
          ))}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Create agent
        </h2>
        <div className="mt-3 max-w-2xl rounded-lg border border-neutral-800 bg-neutral-900/40 p-4">
          <CreateAgentForm workspaceId={workspace.id} />
        </div>
      </section>
    </div>
  )
}
