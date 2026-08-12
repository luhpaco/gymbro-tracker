## Exploration: Supabase PostgreSQL Deployment

### Current State
The application uses a single Prisma PostgreSQL datasource, `env("POSTGRES_URL")`, with nine committed PostgreSQL migrations and no repository Vercel configuration, Node-version declaration, CI migration job, or Prisma migration command in `pnpm build`. The current build already runs `prisma generate && next build`, but it does not migrate data. The linked Vercel project previously had no environment variables and was configured for Node 20.x; `package.json` has no `engines` field, so a Vercel project setting can control Node 24.x without a repository edit.

Auth.js uses one stable secret across the Node login instance and Edge middleware; missing or inconsistent `AUTH_SECRET` would invalidate the Preview login acceptance. The existing auth split is locally complete but explicitly awaits a Preview database/auth smoke test. A fresh database can apply the migration history despite the historical data-loss warnings, because those warnings apply only to populated predecessor tables. Registration creates a smoke-test user, while the optional `pnpm seed` command supplies muscle groups but is destructive and must only be approved for an empty database.

### Affected Areas
- `prisma/schema.prisma` — consumes the single `POSTGRES_URL` Prisma datasource; no schema change is currently required.
- `prisma/migrations/` — nine ordered PostgreSQL migrations must be applied to the new empty project exactly once.
- `package.json` — its build generates Prisma Client but intentionally does not run migrations; no `engines.node` declaration exists.
- `src/auth.ts`, `src/auth.config.ts`, `src/middleware.ts` — require one stable `AUTH_SECRET` for Node-issued sessions and Edge authorization.
- `src/actions/auth/register.ts`, `src/app/(routes)/dashboard/page.tsx`, `src/app/(routes)/exercises/page.tsx`, `src/app/(routes)/workouts/page.tsx` — provide the registration and protected-flow smoke paths.
- `src/seed/index.ts` — optionally prepares muscle groups for create-flow testing; it deletes workout/exercise data and is safe only on the new empty database.
- `openspec/changes/vercel-prisma-deploy-fix/` and `openspec/changes/edge-safe-auth-middleware/` — both retain external Vercel/Preview acceptance work that this deployment enables.

### Approaches
1. **Human-controlled migration with Vercel-scoped runtime secrets** — provision one empty Supabase Free PostgreSQL project; store the runtime transaction-pooler `POSTGRES_URL` and one generated `AUTH_SECRET` only in Vercel Preview and Production; set Vercel Node to 24.x; have the authorized human apply `prisma migrate deploy` once through a secure session-mode migration connection without persisting or disclosing it to repository tooling; then deploy Preview and run the required smoke sequence.
   - Pros: Keeps runtime secrets exclusively in Vercel, avoids repository/env-file changes, uses the existing migration history, and avoids running schema changes on every Preview build.
   - Cons: Requires an explicit human-operated secret-bearing migration step; one Supabase project means Preview and Production share the same database lifecycle.
   - Effort: Medium

2. **Run migrations from the Vercel build command** — change the project build command to run `prisma migrate deploy` before the existing build.
   - Pros: Uses Vercel-managed secrets and requires no operator-local connection step.
   - Cons: Preview deployments could mutate the shared database, concurrent deployments can race, rollback becomes unsafe, and it violates the existing build contract that limits build-time Prisma work to client generation.
   - Effort: Medium

### Recommendation
Use Approach 1. Configure Vercel at the project level: Node 24.x, then the same stable `AUTH_SECRET` and runtime `POSTGRES_URL` in Preview and Production only. Keep migrations out of the build; an authorized human must apply the existing history once with a session-mode connection that is never placed in repository files or shown to this agent. Supabase documentation distinguishes session-mode pooling for migrations from transaction-mode pooling for serverless runtime, so the single runtime secret cannot safely serve both roles without an explicit migration-operation decision. After a successful Preview deployment, register a disposable user, verify login/logout plus dashboard, exercises, and workouts in a fresh browser session, and only then assess—not merge—PR #1.

### Risks
- The mandatory secret-only-in-Vercel policy leaves no automated migration execution path: approving a human-controlled, non-persisted migration connection is required before apply.
- A single Supabase project couples Preview and Production data; Preview tests must use disposable data and must not run the destructive seed after real users exist.
- `pnpm build` proves Prisma Client generation but not schema migration or database reachability; Preview deployment and browser evidence remain mandatory.
- Different or rotated `AUTH_SECRET` values between Preview/Production, Node/Edge deployments, or deployments over time will cause the login/session loop the prior auth change was designed to prevent.

### Ready for Proposal
No — resolve the migration-operation risk first: explicitly authorize a human-only, non-persisted session-mode migration connection while retaining `POSTGRES_URL` and `AUTH_SECRET` as Vercel Preview/Production secrets only. Once approved, the proposal can scope platform configuration, one-time migration evidence, Preview smoke acceptance, and a read-only PR #1 readiness assessment without merging it.
