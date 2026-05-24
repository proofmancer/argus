<p align="center">
  <img src="./public/argus-mark.svg" width="80" alt="argus" />
</p>

<h1 align="center">argus</h1>

<p align="center">
  A local web app that orchestrates Claude Code agents from a real UI.
</p>

<p align="center">
  <a href="https://github.com/proofmancer/argus/blob/main/LICENSE">
    <img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License" />
  </a>
</p>

---

Workspaces, persistent agent personas, pinned skills, live output streams, all wrapping the `claude` CLI you already have. Uses your existing Max plan, no Anthropic API key required.

Named after Argus Panoptes, the many-eyed giant who watched everything.

## What it does

- **Workspaces** point at folders on disk. Each agent in that workspace runs with the folder as its cwd and inherits any `.claude/` config you already have there.
- **Agents** are reusable claude-code personas (name, system prompt, model, pinned skills). Create one once, run it many times.
- **Runs** stream stdout from `claude` back to the browser as Server-Sent Events. You see what the agent is doing in real time, no terminal needed.
- **History** is persisted in SQLite. Refresh the page, your workspaces and agents are still there.

## Requirements

- Node.js 20+
- pnpm (or npm / yarn — pnpm recommended)
- `claude` CLI installed and authenticated on the same machine ([install instructions](https://docs.claude.com/en/docs/claude-code/quickstart))
- macOS or Linux (Windows untested, may work in WSL)

## Setup

```bash
git clone <your-fork-url> argus
cd argus
pnpm install
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000).

The SQLite database (`argus.db`) is created automatically on first run. It lives at the project root and is gitignored.

## Usage

1. **Create a workspace.** Give it a name and the absolute path to a code folder you work in.
2. **Create an agent.** Set a name, optional system prompt (the agent's persistent role), optional model, optional skills to pin.
3. **Run a prompt.** Type a prompt, hit Run, watch `claude` output stream in.

## Architecture

- **Frontend**: Next.js 15 App Router, React Server Components, Tailwind v4.
- **Database**: SQLite via `better-sqlite3` + Drizzle ORM. Tables auto-created on first import.
- **Agent execution**: child-process spawn of `claude -p ... --output-format=stream-json --verbose`. Each JSONL line is forwarded to the browser via SSE.
- **Skill pinning**: writes an `argus.pinnedSkills` block into the workspace's `.claude/settings.local.json` before each run. Merges with whatever's already there.

## Scripts

```bash
pnpm dev          # start dev server
pnpm build        # production build
pnpm start        # serve production build
pnpm db:generate  # generate Drizzle migration from schema changes
pnpm db:migrate   # apply migrations
pnpm db:studio    # open Drizzle Studio (DB inspector)
```

## Roadmap (rough, not committed)

- v0.2: persistent run history view per agent, output search across runs
- v0.3: multi-agent parallel runs in one workspace, output side-by-side
- v0.4: skill marketplace UI (browse `.claude/skills/`, toggle on/off per agent)
- v0.5: webhook hooks (run an agent on a cron, on a git push, on a file change)
- v0.6: optional cryptographic attestation of each agent run (per-action receipts)

## License

MIT. See `LICENSE`.

## Why not just use Claude Code directly?

Claude Code is a fantastic CLI. Argus is for when you want:

- A persistent persona library (instead of typing the same `--append-system-prompt` flag every time)
- A visual workspace with multiple agents running side-by-side
- A web UI you can open on another monitor while you code in your terminal
- Output history that survives terminal session resets
- Skill pinning that's discoverable in a UI, not buried in a settings file

If none of those matter to you, the raw `claude` CLI is faster.
