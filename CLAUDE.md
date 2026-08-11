# CLAUDE.md — gymbro-tracker

Source of truth for how the user, Claude Code, and OpenCode collaborate on this project. Read this first; the rest of the doc references it.

## Project context

- **What**: workout tracking app.
- **Stack**: Next.js 15.x (App Router with RSC), React 19, TypeScript 5 (strict), pnpm.
- **Database**: PostgreSQL 15.3 via Docker Compose, Prisma ORM 5.16.1.
- **Auth**: Next-Auth 5 (`5.0.0-beta.32`, Credentials provider, middleware-protected routes).
- **UI**: Tailwind CSS 3.4, shadcn/ui (Radix UI primitives), `class-variance-authority`, `lucide-react`, `react-icons`.
- **Forms / validation**: React Hook Form + Zod.
- **State**: Zustand (exercise, workout, UI stores).
- **Architecture**: feature-grouped server actions, App Router with RSC, Prisma data layer.

## Dual-agent workflow

- **User** — final decision-maker. Approves scope, breaks ties, owns delivery.
- **Claude Code (this agent)** — planning, validation, verification. Reads sub-agent output, runs gates, never trusts "done" summaries without proof.
- **OpenCode (sub-agent)** — execution, implementation, code-writing. Delegated by Claude Code through the `task` tool.
- **Pattern**: User → Claude Code plans (`/sdd-new`, `/sdd-ff`) → OpenCode executes (`/sdd-apply`) → Claude Code verifies (`/sdd-verify`) → archive (`/sdd-archive`).
- **Handoffs** happen in `design/` (see below). Real artifacts live in `openspec/`.

## SDD loop

Phases: `proposal` → `spec` → `design` → `tasks` → `apply` → `verify` → `archive`.

- **Artifact store**: hybrid (Engram + OpenSpec). Engram for cross-session memory; OpenSpec for the team-shareable trail.
- **Per-phase artifacts** (when using OpenSpec backend):
  - Proposal: `openspec/changes/<name>/proposal.md`
  - Spec: `openspec/changes/<name>/specs/`
  - Design: `openspec/changes/<name>/design.md`
  - Tasks: `openspec/changes/<name>/tasks.md`
  - Archive: deltas synced into `openspec/specs/`
- **Per-phase rules** (RFC 2119 keywords, Given/When/Then, sequence diagrams, etc.) live in `openspec/config.yaml`. Read that file before each phase.
- **Strict TDD**: disabled — no test runner is configured. See "Testing" below.

## `design/` convention

`design/` is a gitignored scratch space for inter-agent handoffs. The full rules (what goes in, what does not, naming, multi-machine caveat) are in `design/README.md`. Read that file before writing anything into `design/`.

## Notion backlog

- **Source of truth for tasks**: [Gymbro Tracker — Backlog](https://app.notion.com/p/aff05be5327d4b68b2e9969339c94fac).
- **Schema**: `Tarea` (title) / `Status` (Sin empezar, En curso, Listo) / `Prioridad` (Alta, Media, Baja) / `Tipo` (Feature, Bug, Housekeeping, Decisión) / `Owner` (Claude, OpenCode, Sin asignar) / `Fase / Referencia` (text) / `Notas` (text).
- **MCP**: hosted at `https://mcp.notion.com/mcp` (OAuth). No token lives in this repo or in `opencode.json`. Do not add one.
- **Sync with SDD**: when a Notion task starts, change `Status` to `En curso` and `Owner` to whoever is executing. When done, `Listo`. The `Fase / Referencia` column is the link to the SDD change folder (e.g., `openspec/changes/exercise-delete-state/`).

## Testing

- **No test runner configured.** `pnpm test` is undefined. `openspec/config.yaml` reflects this (`strict_tdd: false`).
- **Linter**: `pnpm lint` (ESLint `next/core-web-vitals`).
- **Type checker**: `pnpm exec tsc --noEmit`.
- **No formatter** configured. Optional: add Prettier.
- **Build verification (proxy for now)**: `pnpm build` is the closest thing to a gate until a test runner exists. `sdd-verify` runs it.
- **To enable strict TDD**:
  1. Install `vitest` + `@testing-library/react` + `@testing-library/jest-dom`.
  2. Add `test` and `test:watch` scripts in `package.json`.
  3. Update `openspec/config.yaml` `testing` block: set `strict_tdd: true`, `runner.available: true`, `runner.framework: vitest`, `runner.command: pnpm test`.
  4. Add a `vitest.config.ts` with the Next.js + React plugin.
- **Until then**: every SDD task must at least pass `pnpm build` and `pnpm lint`. No "I think it works" without proof.

## Database (Prisma)

- **Schema**: `prisma/schema.prisma`. Connection via `POSTGRES_URL` in `.env` (gitignored; use `.env.template` as reference).
- **Models** (current): `User`, `MuscleGroup`, `Exercise`, `Workout`, `Set`. Enums: `Role`.
- **Workflow for schema changes**:
  1. Edit `prisma/schema.prisma`.
  2. `pnpm exec prisma migrate dev --name <descriptive-name>` — generates and applies a migration.
  3. Verify `prisma/migrations/<timestamp>_<name>/migration.sql` reads correctly.
  4. The Prisma client auto-regenerates. If not, `pnpm exec prisma generate`.
  5. Run the dev DB locally: `docker compose up -d`.
  6. Commit the schema change AND the migration folder together.
- **Hard rules**:
  - **Never edit generated migration files manually** — they will be reapplied incorrectly on the next `migrate dev`. Roll forward with a new migration instead.
  - **Never commit `.env`** — it contains `POSTGRES_URL` and `AUTH_SECRET`. `.env.template` is the safe template.
  - **Prisma queries stay in `src/lib/` or `src/data/`** — not in components. Components consume the data layer; they do not query directly.
  - **Server actions live in `src/actions/<feature>.ts`** and always validate input with Zod before touching the DB.

## Hard rules (applies to every agent)

1. **Never trust "task done" summaries** — verify with `git log`, `git diff`, or actually running the relevant command. If a sub-agent says a task is complete, prove it before moving on.
2. **Tokens / secrets stay in `.env`** (gitignored) or in OAuth flows. Never in source code, never in `design/`, never in commit messages, never in `opencode.json`.
3. **Notion MCP uses hosted OAuth** — do not add a token to `opencode.json` or to any file in this repo. The previous local-stdio + wrapper pattern was deleted on 2026-07-22; do not reintroduce it.
4. **Real artifacts in `openspec/changes/<name>/`. `design/` is for drafts and handoffs only.** Do not commit `design/` content. Do not move SDD artifacts into `design/`.
5. **Do not bypass SDD for "small" changes** — the discipline is the value. If something is truly out-of-band (typo, dead-code removal), log it in the Notion backlog as `Tipo: Housekeeping` first, then execute.
6. **Keep Prisma queries in the data layer.** Components consume, never query.
7. **Server actions validate with Zod** — no raw `request.json()` or untyped inputs reaching Prisma.

## Useful commands

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Start dev server (http://localhost:3000) |
| `pnpm build` | Production build (used as verify gate) |
| `pnpm start` | Run production build |
| `pnpm lint` | ESLint |
| `pnpm exec tsc --noEmit` | Type check |
| `pnpm seed` | Seed DB |
| `docker compose up -d` | Start PostgreSQL |
| `docker compose down` | Stop PostgreSQL |
| `pnpm exec prisma studio` | Browse DB in browser |
| `pnpm exec prisma migrate dev --name <name>` | Create + apply migration |
| `pnpm exec prisma generate` | Regenerate Prisma client |
| `pnpm exec prisma format` | Format `schema.prisma` |

## Conventions

- **File naming**: kebab-case for files, PascalCase for components and types.
- **Components**: feature-grouped under `src/components/<feature>/`.
- **Server actions**: `src/actions/<feature>.ts`, always with Zod input validation.
- **Data layer**: `src/lib/` for shared utilities, `src/data/` for Prisma queries.
- **Imports**: use the `@/` alias for `src/`.
- **DB models**: plural-table names in the schema; singular TS class names (`model User`, `model Exercise`).
- **Enums**: PascalCase enum names, UPPER_CASE values (`enum Role { USER ADMIN }`).

## Where to start

- New task in the Notion backlog? Read the task, then run `/sdd-new <change-name>`.
- Mid-task? Check `openspec/changes/` for the active change and read its `proposal.md`.
- Confused about the workflow? Read `openspec/config.yaml` and `design/README.md`.
- Stuck on tooling? Read the relevant skill (`/sdd-init`, `/sdd-apply`, etc.) before improvising.
