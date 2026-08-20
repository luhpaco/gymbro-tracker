# Proposal: Request-Time Delivery of Muscle-Group Reference Data

## Intent

In production, `/exercises/create` renders an empty muscle-group `<Select>`, blocking exercise creation — the app's primary write path. The database holds all 14 canonical `MuscleGroup` rows (verified by direct query), so this is a rendering defect, not a data defect.

`CreateExercisePage` uses zero dynamic APIs (no `auth()`, since reference data is not user-scoped), so Next.js 15 statically prerenders it at `next build`. `getMuscleGroups()` silently catches any error and returns `[]`; that build-time empty array is baked into the served HTML and cannot self-heal without a redeploy. Success means the selector reflects live database state on every request.

## Scope

### In Scope

- Force per-request freshness for `getMuscleGroups()` so its result is never baked into a static build.
- Restore a populated muscle-group selector on `/exercises/create`.
- Verify via `pnpm build` route-type output that the route reports dynamic (`ƒ`), not static (`●`).

### Out of Scope

- Hardening the identical silent-catch-to-`[]` pattern in `getExercises()` / `getWorkouts()` — **deliberate narrow scope**: those callers are already dynamic via `auth()`, so they cannot produce this build-frozen bug; changing error semantics across three actions is a refactor with no test runner to catch regressions. File as separate Housekeeping (CLAUDE.md rule 5).
- Caching strategy (`unstable_cache`, ISR, PPR) — solves a scale problem this app does not have.
- Any change to muscle-group provisioning, schema, or migrations.

## Capabilities

### New Capabilities

- `reference-data-delivery`: how global (non-user-scoped) reference data reaches render surfaces with request-time freshness guarantees.

### Modified Capabilities

- None. `reference-data-provisioning` governs write-side migration behavior and its Migration-Only Delivery Boundary explicitly excludes runtime; its requirements are unchanged.

## Approach

Call `await connection()` (Next 15's documented replacement for the deprecated `unstable_noStore()`) inside `getMuscleGroups()`, before the Prisma query. Chosen at the **data layer**, not the page layer, so any future caller inherits the guarantee without remembering a page directive — the primary mitigation for this bug class recurring.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/actions/muscle/get-muscle-groups.ts` | Modified | Add `await connection()` before the Prisma query |
| `src/app/(routes)/exercises/create/page.tsx` | Unchanged | Becomes dynamic transitively |
| `src/app/(routes)/exercises/update/[id]/page.tsx`, `exercises/page.tsx` | Unchanged | Already dynamic via `auth()` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Route stays static after fix | Low | Inspect `pnpm build` route-type legend before merge |
| Per-request DB hit added | Low | 14-row table, single query; page fetched nothing else |
| Bug class recurs elsewhere | Med | Data-layer placement; follow-up ticket for silent-catch |
| DB outage now yields empty selector at runtime | Low | Pre-existing behavior, unchanged by this fix |

## Rollback Plan

Revert the single commit touching `get-muscle-groups.ts`. The page returns to static prerendering — i.e. the current broken state, with no data, schema, or migration side effects to undo.

## Dependencies

- None. No new packages; `connection` ships with the installed Next.js 15.

## Success Criteria

- [ ] `pnpm build` lists `/exercises/create` as dynamic (`ƒ`), not static (`●`)
- [ ] `/exercises/create` in production shows all 14 muscle groups
- [ ] An exercise can be created end-to-end in production
- [ ] `pnpm lint` and `pnpm exec tsc --noEmit` pass
- [ ] Follow-up Housekeeping ticket filed for the silent-catch pattern
