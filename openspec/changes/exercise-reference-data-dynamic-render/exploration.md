# Exploration: Empty muscle-group `<Select>` on `/exercises/create` in production

## Current State

`CreateExercisePage` (`src/app/(routes)/exercises/create/page.tsx`) is an `async` Server Component that calls only `getMuscleGroups()` — no `cookies()`, `headers()`, `searchParams`, and critically **no `auth()` call**, since muscle-group data isn't user-scoped. `getMuscleGroups()` (`src/actions/muscle/get-muscle-groups.ts`) wraps `prisma.muscleGroup.findMany()` in a silent `try/catch` returning `[]`. `next.config.mjs` has nothing relevant (no `output`, no `experimental` block — PPR/dynamicIO both off). `middleware.ts` runs independently of a route's static/dynamic classification, so it has no bearing here.

Verified directly in the installed package (`node_modules/.../next-auth/src/lib/index.ts`, `actions.ts`): next-auth v5's `auth()` imports from `next/headers`, a dynamic API. Since this project has no `experimental.ppr` flag, any dynamic-API use anywhere in a route's tree opts the **whole route** into dynamic rendering (the "cookies/headers in nested components don't opt in the whole route" behavior from vercel/next.js discussion #49708 requires PPR, which isn't enabled here). Next 15's App Router still statically prerenders zero-dynamic-API routes at build time — unchanged from earlier versions. Next 15's "nothing cached by default" headline change is about the `fetch()` Data Cache; it doesn't touch Prisma calls or Full Route Cache/static-prerendering eligibility, which is the actual mechanism at fault.

## Affected Areas

- `src/app/(routes)/exercises/create/page.tsx` — confirmed vulnerable: only calls `getMuscleGroups()`, zero dynamic API in tree → build-time static prerender candidate.
- `src/actions/muscle/get-muscle-groups.ts` — root-cause data layer: silent catch-to-`[]`, no per-request freshness signal.
- `src/components/exercise/CreateExerciseForm.tsx` — verified NOT buggy; correctly renders whatever `listMuscleGroups` it's given.
- `src/app/(routes)/exercises/update/[id]/page.tsx` — also calls `getMuscleGroups()`, but also calls `auth()` directly (verified: line 15) → forced dynamic → **not affected**.
- `src/app/(routes)/exercises/page.tsx` — calls `getExercises()` first, which internally calls `auth()` (verified: `get-exercises.ts` line 8) → forced dynamic → **not affected**.
- `src/app/(routes)/workouts/create/page.tsx`, `workouts/page.tsx`, `dashboard/page.tsx` — all call `auth()` directly or transitively → not affected. `MuscleGroup` is the only global reference-data table in the schema (`User`, `MuscleGroup`, `Exercise`, `Workout`, `Set`), so no other page shares this exact "zero-dynamic-API + reference-data" shape.
- `get-exercises.ts` / `get-workouts.ts` share the same silent-catch-to-`[]` pattern, but those pages are already dynamic via `auth()`, so it's only a transient-outage risk there, not a build-time-frozen-empty bug — a lesser, separate concern.

## Approaches

1. **`await connection()` inside `getMuscleGroups()`** (Next 15's documented replacement for `unstable_noStore()`). Pros: colocated with the risky operation, protects any future caller automatically, most idiomatic/granular. Cons: still forces the whole calling page dynamic (no partial-static win without PPR) — same runtime cost as option 2 for this page. Effort: Low.
2. **`export const dynamic = "force-dynamic"` on `CreateExercisePage`**. Pros: simplest one-liner. Cons: page-level, not data-level — doesn't protect a future caller of `getMuscleGroups()` added elsewhere without its own dynamic signal. Effort: Low.
3. **`unstable_cache`-wrapped `getMuscleGroups()` with TTL + `revalidateTag`**. Pros: avoids per-request DB hit for near-immutable data. Cons: over-engineered for current scale, no mutation path exists to test invalidation against, and still masks a transient-outage-during-TTL scenario returning `[]`. Effort: Medium.

## Recommendation

Option 1 (`await connection()` in `getMuscleGroups()`) — most idiomatic Next 15 API, scoped to the data layer where the risk actually lives, zero extra cost for this page. Option 2 is an acceptable fallback if page-level explicitness is preferred. Option 3 is not recommended — solves a scale problem the app doesn't have and doesn't fix the silent-catch root cause.

Secondary/optional: the silent-catch-to-`[]` pattern in `getMuscleGroups()`, `getExercises()`, `getWorkouts()` is a real observability gap (it's why the build didn't fail loudly) but touches 3+ files and changes error-handling semantics — recommend scoping it as a separate follow-up rather than bundling into this fix, unless `sdd-propose` explicitly wants both.

## Risks

- No test runner; verifying the fix requires `pnpm build` route-type inspection (static ● vs dynamic ƒ) or manual production smoke-check — no automated regression test exists for "this route must render fresh."
- The identical silent-catch pattern remains live in `get-exercises.ts`/`get-workouts.ts`, currently safe only incidentally (via `auth()`); a future refactor removing that incidental dynamic trigger would silently reintroduce this bug class.
- CI cannot currently detect "route got silently statically prerendered with empty data" — `pnpm build` exits 0 either way.

## Ready for Proposal

Yes.

## Key Learnings

1. Next.js 15's Full Route Cache still statically prerenders any route with zero dynamic-API usage at build time, unchanged from earlier Next.js versions.
2. Next-auth v5's `auth()` helper internally imports from `next/headers`, so it forces the entire route dynamic wherever it's called without Partial Prerendering enabled.
3. `CreateExercisePage` is uniquely vulnerable because muscle-group reference data has no user scope, so no developer ever added an `auth()` call there.
4. Next.js 15's "nothing cached by default" change applies to the `fetch()` Data Cache only, not to Prisma calls or Full Route Cache static-prerendering eligibility.
5. The idiomatic Next 15 fix for per-request freshness at data-layer granularity is `await connection()`, replacing the deprecated `unstable_noStore()`.

## Verification Note (orchestrator, post-exploration)

Independently re-checked the two "not affected" claims against current source:
- `UpdateExercisePage` (`src/app/(routes)/exercises/update/[id]/page.tsx:15`) calls `auth()` directly — confirmed.
- `getExercises()` (`src/actions/exercise/get-exercises.ts:8`) calls `auth()` internally — confirmed.
No hallucination found; exploration findings accepted as-is.
