# CLAUDE.md — gymbro-tracker

Source of truth for how the user, Claude Code, and OpenCode collaborate on this project. Full stack detail lives in `openspec/config.yaml`; this file covers process and hard rules only.

## Project context

Workout tracking app. Next.js 15 (App Router/RSC) + React 19 + TypeScript strict + Prisma/PostgreSQL. Full stack detail: `openspec/config.yaml`.

## Dual-agent workflow

- **User** — final decision-maker. Approves scope, breaks ties, owns delivery.
- **Claude Code (this agent)** — planning, validation, verification.
- **OpenCode (sub-agent)** — execution, implementation. Delegated via the `task` tool.
- **Pattern**: User → Claude Code plans (`/sdd-new`, `/sdd-ff`) → OpenCode executes (`/sdd-apply`) → Claude Code verifies (`/sdd-verify`) → archive (`/sdd-archive`).
- Mid-task handoffs go in `design/` — see `design/README.md` before writing there.

## SDD loop

Backend: hybrid (Engram + OpenSpec under `openspec/changes/<name>/`). Per-phase rules: `openspec/config.yaml`. The SDD procedure itself (phases, commands, preflight) is owned by gentle-ai's global workflow — not repeated here.

**Do not bypass SDD for "small" changes.** If something is truly out-of-band (typo, dead-code removal), log it in the Notion backlog as `Tipo: Housekeeping` first, then execute.

## Testing & database

- `pnpm test` / `pnpm build` / `pnpm lint` / `pnpm run format:check` / `pnpm exec tsc --noEmit` are CI-enforced gates on every PR into `master` (branch protection requires the `verify` check — merge is blocked on failure, not just advisory).
- Current test scope (Vitest Stage 1): pure-logic units only — Zustand stores, Zod schemas, `src/lib/utils.ts`. No component/DOM tests yet.
- Full testing detail: `@.claude/rules/testing.md`.
- Prisma schema-change workflow (migration steps, hard rules): `@.claude/rules/database.md` — read before editing `prisma/schema.prisma`.

## Notion backlog

Source of truth for tasks: Gymbro Tracker — Backlog. Schema and status-sync rules: `@.claude/rules/notion-backlog.md`.

## Hard rules

1. **Never trust "task done" summaries** — verify with `git log`, `git diff`, or by running the command yourself.
2. **Secrets stay in `.env`** (gitignored) or OAuth flows — never in source, `design/`, commit messages, or `opencode.json`. Notion MCP uses hosted OAuth; do not reintroduce a local-token pattern.
3. **Real SDD artifacts live in `openspec/changes/<name>/`.** `design/` is drafts/handoffs only, never committed.
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
| `docker compose up -d` | Start PostgreSQL |
| `pnpm exec prisma studio` | Browse DB in browser |
| `pnpm exec prisma migrate dev --name <name>` | Create + apply migration |

## Conventions

- DB models: plural table names in schema, singular TS class names (`model User`, `model Exercise`).
- Enums: PascalCase enum names, UPPER_CASE values (`enum Role { USER ADMIN }`).
- Server actions: `src/actions/<feature>.ts`.

## Where to start

- New task in the Notion backlog? Read the task, then run `/sdd-new <change-name>`.
- Mid-task? Check `openspec/changes/` for the active change and read its `proposal.md`.
- Confused about the workflow? Read `openspec/config.yaml` and `design/README.md`.
