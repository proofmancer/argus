import Link from 'next/link'
import { notFound } from 'next/navigation'
import { db, schema } from '@/lib/db'
import { desc, eq } from 'drizzle-orm'
import { CreateAgentForm } from '@/components/CreateAgentForm'
import { AgentPanel } from '@/components/AgentPanel'
import { SkillsGrid } from '@/components/SkillsGrid'
import { SharedMemoryForm } from '@/components/SharedMemoryForm'
import { readWorkspaceMemory } from '@/lib/claude'

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

  // Pre-load the workspace's shared memory so the editor renders
  // with the current contents on first paint. Missing file -> empty
  // string, handled silently by readWorkspaceMemory.
  const memoryContent = await readWorkspaceMemory(workspace.cwd)

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
          Shared memory
        </h2>
        <p className="mt-1 max-w-2xl text-xs text-neutral-500">
          Prepended to every agent&apos;s system prompt in this workspace.
          Lives at{' '}
          <code className="font-mono text-neutral-400">.argus/MEMORY.md</code>{' '}
          inside the workspace directory. Save empty to clear.
        </p>
        <div className="mt-3 max-w-3xl">
          <SharedMemoryForm
            workspaceId={workspace.id}
            initialContent={memoryContent}
          />
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold uppercase tracking-[0.18em] text-neutral-500">
          Skills
        </h2>
        <div className="mt-3">
          <SkillsGrid workspaceId={workspace.id} />
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
