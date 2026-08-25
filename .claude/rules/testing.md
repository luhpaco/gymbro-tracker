# Testing — gymbro-tracker

- **Runner**: Vitest. `pnpm test` runs once, `pnpm test:watch` watches. Config: `vitest.config.ts` (`environment: "node"`, `vite-tsconfig-paths` for the `@/*` alias).
- **Scope (Stage 1 — current)**: pure-logic units only, co-located as `*.test.ts` next to their source. Covers Zustand stores (`src/store/**/*-store.ts`), Zod schemas (`src/lib/schemas/workout-set.ts`), and shared utilities (`src/lib/utils.ts`). No component/DOM tests yet — no `jsdom`, `@testing-library/react`, or `jest-dom` installed.
- **Linter**: `pnpm lint` (ESLint `next/core-web-vitals` + `prettier` last in `extends`, via `eslint-config-prettier`, to disable stylistic rules that could conflict with formatting).
- **Type checker**: `pnpm exec tsc --noEmit`.
- **Formatter**: Prettier. `pnpm run format` writes, `pnpm run format:check` verifies (both route through `git ls-files -co --exclude-standard -z | xargs -0 prettier ...` to avoid `prettier`'s own glob expansion choking on the gitignored `postgres/` Docker volume directory).
- **CI**: `.github/workflows/ci.yml` runs on every PR targeting `master` (not on push): install → lint → format:check → typecheck → test → `prisma validate` → build, with CI-only placeholder `POSTGRES_URL`/`AUTH_SECRET` env vars (no real secrets, no network/DB access). Branch protection on `master` requires the `verify` check — a red check blocks merge.
- **Build verification**: `pnpm build` is the final CI/`sdd-verify` gate.
- Every SDD task must pass `pnpm test`, `pnpm build`, and `pnpm lint` (`pnpm run format:check` and `pnpm exec tsc --noEmit` too, once touching formatted/typed code).

## Roadmap (not yet implemented — do not assume these exist)

- **Stage 2**: mock-based server-action tests (`src/actions/**`).
- **Stage 3**: Postgres-integration tests against a real service container in CI.

Track these in the Notion backlog, not here — this file reflects current state only.
