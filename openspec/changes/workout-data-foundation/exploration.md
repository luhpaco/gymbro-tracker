# Exploration: workout-data-foundation

Source: Notion F0.1 "Cimientos: modelo de datos para sesiones y métricas". Engram: `sdd/workout-data-foundation/explore`.

## Current State

- **Schema** (`prisma/schema.prisma`): `Workout.tag` is `@unique` globally (migration `20240801173706_add_unique_to_tag_workout`). `Set` has only `id` (uuid), `weight` (Float), `reps` (Int), `workoutId`, `exerciseId`. Only `User` has `createdAt`.
- **`createWorkout`** (`src/actions/workout/create-workout.ts`):
  - `tag = name.toLowerCase().replace(/\s/g,"-") + "-workout-" + date.toISOString()`; the client-sent `tagWorkout` is ignored (dead field).
  - Sets are written with a nested `sets.create` from a flattened, exercise-major array, with no order field.
  - All rows of one nested create share the same DB `now()`, so `createdAt` can never be an ordering key.
  - `exerciseId` ownership is not checked (pre-existing, out of scope). No `create-workout` test exists.
- **Reads**: `getWorkoutBySlug` orders sets by `{ id: "asc" }` (random uuid). `getWorkouts` has no `orderBy` on sets at all (feeds `/workouts` and the dashboard). Both group sets by exercise name into a plain object.
- **Zod**: `setSchema` is duplicated in `src/lib/schemas/workout.ts` and `workout-set.ts` (`weight.min(1)`, `reps.min(1)`, coerce). `setsSchema.max(5, "Tómalo con calma!!")` lives only in `workout.ts`. `update-set.ts` reuses `workout-set.ts` via `setSchema.shape.*`.
- **UI**: the 5-set cap is `WorkoutCreationForm.tsx:193` (`disabled={setFields.length >= 5}`). `WorkoutCreationForm` and `WorkoutDetailSets` build validators from `setSchema.shape.weight/reps`, so they inherit the min-0 change; the message "Debes agregar el peso…" becomes stale.
- **Draft** (`src/lib/workout-draft.ts`, key `gymbro:workout-draft:v1`): the draft schema embeds `AddExerciseFormSchema`. `isWarmup: z.boolean().default(false)` keeps old drafts loadable, so no version bump. `order` is server-derived and never enters the form/draft.
- **Seed / CI**: `/api/seed` and `src/seed/index.ts` unaffected. CI runs only `prisma validate`, not migrations.
- **Migration precedent**: `20260913205125_exercise_user_tag_unique` (`@@unique([userId, tag])` on `Exercise`).

## Affected Areas

- `prisma/schema.prisma` + one new migration folder.
- `src/lib/schemas/workout.ts`, `workout-set.ts` (+ tests).
- `src/actions/workout/create-workout.ts` (persist `order`/`isWarmup`, handle P2002), `get-workouts.ts`, `get-workout-by-slug.ts` (explicit set ordering).
- `src/interfaces/actions/workout.interfaces.ts` (`DataItem`: `order`, `isWarmup`, `createdAt`).
- `WorkoutCreationForm.tsx` (remove cap, `isWarmup: false` defaults), `WorkoutDetailSets.tsx` (weight message, numbering).
- Tests to change: `workout.test.ts` (weight 0 rejected, 6 sets rejected, `toEqual` gains `isWarmup:false`), `workout-set.test.ts`, `workout-draft.test.ts`.
- New: `src/lib/workout-sets.ts` (pure helpers `buildSetsForCreate`, `sortSets`, `groupSetsByExercise`) + test; `create-workout.test.ts` (mocked-prisma pattern from `create-exercise.test.ts`).
- Warmup counting touches `get-exercises-summary.ts`, the dashboard and `WorkoutsSection` (uses `.length`) — product gap.

## Approaches: set order

| Approach | Pros | Cons | Effort |
| --- | --- | --- | --- |
| **A (recommended)**: per-workout integer `order`, `@@index([workoutId, order])`, tie-break `(order, createdAt, id)`, gaps tolerated | Handles interleaved exercises, one sort key, no re-sequencing on delete, matches ticket | Exercise group order is derived (first appearance); mid-insert later needs shifting | Low |
| A2: A + `@@unique([workoutId, order])` | Guards double-submit duplicates | Non-deferrable unique makes shifting/reordering brittle | Low |
| B: per-exercise `setNumber` + separate exercise ordering | Matches current exercise-block UI | Two ordering keys, renumber on delete, no interleaving | High |
| C: `createdAt` as order | — | Rejected: nested create gives identical timestamps | n/a |

Assignment is server-side from flat position (exercise-major, as today). "Serie N" is the index within the group, not the stored value. `order` needs quoting in raw SQL; `position` is a safer name for design to consider.

## Approaches: `Workout.tag`

Confirmed: global unique + formula (lowercased-dashed name + ISO date) → cross-user collision; P2002 is caught as a generic error so the second user cannot save. Same-user/same-name/same-day also collides (worse with multiple sessions per day in F1.x). Reads already filter by `userId`.

| Option | Assessment |
| --- | --- |
| **1 (recommended)**: `@@unique([userId, tag])` replacing `@unique` | Follows the Exercise precedent; `DROP INDEX "Workout_tag_key"` + `CREATE UNIQUE INDEX`; loosens the constraint so it cannot fail on data; add a dedicated P2002 error code |
| 2: keep global unique | Leaves the bug |
| 3: random/counter suffix on tag | Also fixes same-user same-day; needs a product call |
| 4: route by `id` instead of `tag` | Cleanest, but changes URLs/breadcrumbs/`revalidatePath`; follow-up |

## Other design notes

- Timestamps: `createdAt @default(now())`; `updatedAt @default(now()) @updatedAt` so the migration applies on non-empty tables without hand-editing SQL.
- `Set.order` (no default) is the only column that fails on a non-empty `Set` table (`migrate dev` reports an unexecutable step) → reset dev DB, or fallback `@default(0)`.
- `Set.createdAt` is insertion time, not performance time; F2 progress must use `Workout.date`.
- `date` stays authoritative for list/sort/display; `startedAt`/`endedAt` nullable and not wired into `createWorkout`/form in F0.1 (F1.1 owns that). Zod refine `endedAt >= startedAt` only where accepted. No CHECK constraint (needs hand-written SQL).
- Optional Zod hardening: `z.coerce.number()` turns `""`/`null` into 0, which `min(0)` now accepts → reject blank/null weight; `.finite()` on weight; `.int()` on reps; re-export `setSchema` from `workout-set.ts` in `workout.ts` to remove duplication.
- Pre-existing, out of scope: `workout.date.toDateString()` in RSC uses server timezone; `createWorkout` does not verify exercise ownership or `isActive`.

## Recommendation

Order approach A + tag option 1, in a single migration. Strict TDD: Vitest for weight 0, >5 sets, `isWarmup` default, `buildSetsForCreate`/`sortSets`, `createWorkout` order + `isWarmup` persistence, P2002 mapping.

## Estimate

~400–470 authored changed lines incl. tests (~350 excluding generated migration SQL). 400-line budget risk: Medium-High. Suggested slices: (1) schema + migration + Zod + tests; (2) helper + actions + queries + UI + tests.

## Product decision gaps (returned, not decided)

1. Same user, same name, same day: allowed (needs suffix) or blocked with a clear message?
2. Are warmup sets counted in "series" displays (dashboard, `WorkoutsSection`, "Serie N")? Does F0.1 include a UI warmup toggle or is it deferred to F1.1?
3. Does any deployed DB hold `Set` rows? If so, fallback `@default(0)` on `order`.
4. Technical upper bound on sets/reps/weight?
5. `Set.updatedAt` not in ticket though `updateSet` exists — skip? Should `updateSet` touch `Workout.updatedAt`?
6. Wire `startedAt`/`endedAt` into `createWorkout` now, or leave to F1.1?

## Ready for Proposal

Yes, with gaps 1–3 resolved or defaulted explicitly in the proposal.
