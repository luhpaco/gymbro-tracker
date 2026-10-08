# CLAUDE.md — gymbro-tracker

Source of truth for how the user, Claude Code, and OpenCode collaborate on this project. Full stack detail lives in `openspec/config.yaml`; this file covers process and hard rules only.

## Project context

Workout tracking app. Next.js 15 (App Router/RSC) + React 19 + TypeScript strict + Prisma/PostgreSQL. Full stack detail: `openspec/config.yaml`.

## Dual-agent workflow

- **User** — final decision-maker. Approves scope, breaks ties, owns delivery.
- **Claude Code (this agent)** — planning, validation, verification.
- **OpenCode (sub-agent)** — execution, implementation. Delegated via the `task` tool.
- **Pattern**: User approves scope → Claude Code plans and verifies → OpenCode executes via the `task` tool. Work runs through ODD; do not rely on deprecated SDD slash commands.
- Mid-task handoffs go in `design/` — see `design/README.md` before writing there.

## ODD workflow

ODD is the execution workflow. It owns task progress, work-unit commits, and the single detailed checklist.

- **Detailed checklist**: `odd/tasks/<feature>.md`, versioned in Git and mirrored in Engram. It is the sole task checklist — no competing task lists.
- **OpenSpec change** (`openspec/changes/<name>/`): holds concise change intent. Create a brief `proposal.md` for every change; add behavior deltas under `specs/`; add `design.md` only for a meaningful technical decision or risk.
- **OpenSpec tasks file** (`openspec/changes/<name>/tasks.md`): a brief index that points to the ODD checklist. It does not duplicate checkboxes.
- **At close**: archive the detailed ODD task doc with the dated change folder, sync behavior deltas to `openspec/specs/`, and update the Notion task status and archive reference.

Per-phase rules live in `openspec/config.yaml`; the ODD procedure itself is owned by gentle-ai's global workflow and is not repeated here.

**Do not bypass ODD for "small" changes.** If something is truly out-of-band (typo, dead-code removal), log it in the Notion backlog as `Tipo: Housekeeping` first, then execute.

## Testing & database

- `pnpm test` / `pnpm build` / `pnpm lint` / `pnpm run format:check` / `pnpm exec tsc --noEmit` are CI-enforced gates on every PR into `master` (branch protection requires the `verify` check — merge is blocked on failure, not just advisory).
- Current test scope (Vitest Stage 1): pure-logic units only — Zustand stores, Zod schemas, `src/lib/utils.ts`. No component/DOM tests yet.
- Full testing detail: `@.claude/rules/testing.md`.
- Prisma schema-change workflow (migration steps, hard rules): `@.claude/rules/database.md` — read before editing `prisma/schema.prisma`.

## Notion backlog

Source of truth for tasks: Gymbro Tracker — Backlog. Schema and status-sync rules: `@.claude/rules/notion-backlog.md`.

## Worktrees

Isolated git worktrees (concurrent Claude/OpenCode sessions, DB-isolated tasks, long-running branches) use `git worktree add` + `scripts/worktree-provision.sh` as the primary mechanism, torn down with `scripts/worktree-cleanup.sh`. Full decision guide, naming convention, and known limits: `@.claude/rules/worktrees.md`.

## Hard rules

1. **Never trust "task done" summaries** — verify with `git log`, `git diff`, or by running the command yourself.
2. **Secrets stay in `.env`** (gitignored) or OAuth flows — never in source, `design/`, commit messages, or `opencode.json`. Notion MCP uses hosted OAuth; do not reintroduce a local-token pattern.
3. **ODD owns the detailed task checklist; OpenSpec holds change intent and deltas.** Real change artifacts live in `openspec/changes/<name>/`, and `design/` is drafts/handoffs only, never committed.
4. **Prisma queries stay in `src/lib/` or `src/data/`** — components consume, never query directly.
5. **Server actions validate with Zod** before touching the DB — no raw `request.json()` or untyped input reaching Prisma.
6. **Never hand-edit a generated migration file** — roll forward with a new `prisma migrate dev` instead.

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start dev server (http://localhost:3000) |
| `pnpm build` | Production build (verify gate) |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Type check |
| `pnpm seed` | Seed DB |
| `podman compose up -d` | Start PostgreSQL (only `podman` is installed; `docker compose` is not) |
| `pnpm exec prisma studio` | Browse DB in browser |
| `pnpm exec prisma migrate dev --name <name>` | Create + apply migration |
| `scripts/worktree-provision.sh <path>` | Provision a sibling worktree: copy env files, install, start DB, migrate, CodeGraph init, prove dev server compiles |
| `scripts/worktree-cleanup.sh <path> [--force]` | Tear down a worktree's container stack + CodeGraph index + directory (never deletes the branch) |

## Conventions

- DB models: plural table names in schema, singular TS class names (`model User`, `model Exercise`).
- Enums: PascalCase enum names, UPPER_CASE values (`enum Role { USER ADMIN }`).
- Server actions: `src/actions/<feature>.ts`.

## Where to start

- New task in the Notion backlog? Read the task, then start ODD and create `odd/tasks/<feature>.md` as the detailed checklist.
- Mid-task? Read `odd/tasks/<feature>.md` for progress and the active `openspec/changes/<name>/proposal.md` for intent.
- Confused about the workflow? Read `openspec/config.yaml` and `design/README.md`.
