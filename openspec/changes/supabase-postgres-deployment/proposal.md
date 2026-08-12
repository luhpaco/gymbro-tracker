# Proposal: Supabase PostgreSQL Deployment

## Intent

Establish Supabase PostgreSQL deployment for Vercel without exposing secrets or coupling migration to builds.

## Proposal Question Round

Approved decisions resolve the exploration gate: shared data, human-only migration, secret custody, Node.js 24.x, and assessment-only handling of PR #1. The original assessment was read-only and did not mutate PR #1; PR #1 was merged later outside that assessment. No assumptions remain open.

## Scope

### In Scope
- Provision one Supabase Free database shared by Preview and Production; Preview data is disposable.
- Store `POSTGRES_URL` and one stable `AUTH_SECRET` only in Vercel secret management.
- Configure Vercel Node.js 24.x and add `engines.node` to `package.json`.
- Gate acceptance on the user's one-time `prisma migrate deploy`, Preview smoke tests with a disposable registered account, a deterministic local migration-failure harness, and reconciliation of the historical read-only PR #1 assessment.

### Out of Scope
- Secrets, migration connection strings, repository environment files, or `.gitignore` changes.
- Prisma schema changes, new/edited migrations, seeding, or automatic build-time migrations.
- Production launch, mutation of PR #1 by this corrective delivery, or separate Preview/Production databases.

## Capabilities

### New Capabilities
- `supabase-postgres-deployment`: Hosted database, migration checkpoint, secret policy, Preview acceptance, and merge-readiness evidence.

### Modified Capabilities
- None; no archived capability currently defines this behavior.

## Approach

Use Supabase transaction pooling at runtime. The user alone applies committed migrations once through an undisclosed, non-persisted session-mode connection. Keep `pnpm build` migration-free. A local zero-I/O harness simulates one migration failure and proves that acceptance, smoke, retry, seed, migration rewrite, rollback, and connection handling do not continue. PR #1 is already merged; retain the historical fact that no agent mutated it during the original assessment.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `package.json` | Modified | Declare Node.js `24.x`; preserve build. |
| Vercel settings | Modified | Set Node.js and scoped secrets. |
| Supabase project | New | Host the shared database. |
| `prisma/migrations/` | Unchanged | User applies existing history once. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Preview damages shared data | Medium | Use disposable records; prohibit seeding. |
| Migration or secret mismatch blocks auth | Medium | Require checkpoint and fresh-session evidence. |

## Rollback Plan

Stop deployment, disable Vercel runtime secrets, revert Node configuration, and redeploy the prior commit. Migration failure halts acceptance; existing migrations remain forward-only and are never rewritten or automatically rolled back.

## Dependencies

- User access to Supabase, Vercel, a private migration session, and PR #1 metadata.

## Success Criteria

- [ ] Node.js 24.x is effective in Vercel and declared in `package.json`.
- [ ] Preview/Production use only Vercel-managed runtime secrets.
- [ ] The migration checkpoint succeeds without persisting its connection.
- [ ] Fresh Preview smoke tests pass with disposable account/data.
- [ ] The historical PR #1 assessment records zero agent mutation; its later merged state is reconciled without claiming archive or verification success.
- [ ] No schema, migration, build-migration, `.gitignore`, or secret-value change occurs.
