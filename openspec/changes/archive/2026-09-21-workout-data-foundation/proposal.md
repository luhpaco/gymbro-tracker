# Proposal: Workout Data Foundation

Source: Notion F0.1 "Cimientos: modelo de datos para sesiones y métricas" (Fase 0, Alta).
Exploration: `openspec/changes/workout-data-foundation/exploration.md` (Engram `sdd/workout-data-foundation/explore`).

## Intent

The current `Workout`/`Set` model cannot express what the next three phases need, and one of its
constraints actively prevents users from saving legitimate workouts.

1. **Sets have no order.** `Set` stores only `weight`, `reps` and its foreign keys. `getWorkoutBySlug`
   orders by `{ id: "asc" }` — a random UUID — and `getWorkouts` does not order sets at all. A nested
   `sets.create` writes every row with the same DB `now()`, so no existing column can recover the
   sequence the user entered. Set order is currently non-deterministic.
2. **The model cannot represent a session.** There is no `startedAt`/`endedAt`, no `createdAt` on
   anything but `User`, and no way to mark a warmup set. F1.x (live session, rest timers) and F2
   (progress, PRs, volume) cannot be built on this without patching the schema again mid-feature.
3. **Validation contradicts the product.** `weight.min(1)` makes bodyweight exercises unrecordable,
   and `setsSchema.max(5)` caps a workout at five sets per exercise with the message "Tómalo con calma!!".
4. **`Workout.tag` is globally unique and blocks real saves.** `tag` is derived server-side as
   `slug(name) + "-workout-" + date.toISOString()` under a global `@unique`. Two different users who
   log "Día de pierna" on the same day collide, and one of them simply cannot save. P2002 falls into the
   generic `catch` and surfaces as `{ ok: false, code: "error" }` → "Ups, ocurrió un problema […]
   Inténtalo de nuevo." — advice that can never succeed.

This change is the first Fase 0 ticket and blocks F0.2 (workout edit/delete), F1.x and F2. It does not
count against the 3-feature pre-launch cap.

**Success looks like**: a workout's sets read back in the exact order they were entered, warmup sets are
distinguishable from working sets, bodyweight sets are recordable, no set cap exists, a session can carry
start/end timestamps when F1.1 needs them, and no user is ever blocked from saving a workout because
another workout shares its name and date.

## Scope

### In Scope

- **Schema + one migration** (`prisma migrate dev`, schema and migration folder in the same commit):
  - `Set`: `order Int`, `createdAt DateTime @default(now())`, `isWarmup Boolean @default(false)`, plus a
    non-unique `@@index([workoutId, order])`.
  - `Workout`: `startedAt DateTime?`, `endedAt DateTime?`, `createdAt DateTime @default(now())`,
    `updatedAt DateTime @default(now()) @updatedAt`.
  - `Exercise`: `createdAt`/`updatedAt` with the same defaults.
  - `Workout.tag`: global `@unique` → `@@unique([userId, tag])`.
- **Validation** (`src/lib/schemas/workout.ts`, `workout-set.ts`): `weight` min 0 (bodyweight), `reps`
  min 1, no upper set cap, still ≥1 set per exercise and ≥1 exercise per workout, `isWarmup` defaulting
  to `false`. Deduplicate the two copies of `setSchema`.
- **Write path** (`createWorkout`): assign `order` server-side from the flattened exercise-major
  position, persist `isWarmup`, and resolve tag collisions without ever rejecting the save.
- **Read path** (`getWorkouts`, `getWorkoutBySlug`): explicit, deterministic set ordering.
- **UI adjustments forced by the above**: remove the 5-set cap in `WorkoutCreationForm`, default
  `isWarmup: false` on new sets, fix the now-stale "Debes agregar el peso…" message.
- **Vitest coverage** (strict TDD) for the Zod rules, the pure ordering/tag helpers, and `createWorkout`'s
  `order`/`isWarmup` persistence and collision handling.

### Out of Scope

- lb/kg unit switching (weight is always stored in kg, `Set.weight` stays `Float`).
- RPE, per-set notes, duration/distance.
- Workout edit/delete — F0.2.
- Live session, rest timers, wiring `startedAt`/`endedAt` into the creation form — F1.1 owns that.
  The columns land nullable and unwritten here; `Workout.date` stays authoritative for list, sort and display.
- A warmup toggle in the UI, and any change to how "series" are counted in the dashboard,
  `WorkoutsSection` or "Serie N" labels — deferred to F1.1/F2 (settled decision, gap 2).
- `Set.updatedAt` (settled decision, gap 5).
- Routing workouts by `id` instead of `tag`, and cosmetic cleanup of the tag format — see
  "Deferred: route by id" below.
- Exercise-ownership verification in `createWorkout` and the server-timezone `toDateString()` rendering —
  both pre-existing and untouched here.

## Capabilities

> Contract between this proposal and `sdd-spec`. Researched against `openspec/specs/`.

### New Capabilities

- `workout-set-ordering`: deterministic per-workout set order — server-side assignment on create,
  storage, and ordered read-back; set insertion timestamps; warmup-flag persistence.
- `workout-set-validation`: weight ≥ 0, reps ≥ 1, no upper bound on sets, ≥1 set per exercise,
  ≥1 exercise per workout, `isWarmup` default.
- `workout-tag-uniqueness`: owner-scoped `Workout.tag` uniqueness plus non-blocking collision
  resolution and error-code mapping. Deliberately parallels the existing `exercise-tag-uniqueness` spec.
- `workout-session-timestamps`: `Workout.startedAt`/`endedAt` (nullable, not written in this change),
  `createdAt`/`updatedAt` on `Workout` and `Exercise`, and the rule that `Workout.date` — not
  `Set.createdAt` — is the authoritative performance date for F2 progress metrics.

### Modified Capabilities

- `workout-creation-form`: the "Server contract is unchanged" scenario no longer holds — the
  `CreateWorkoutFormData` payload gains `isWarmup` per set, and the 5-set-per-exercise limit is removed
  from both validation and the UI.

`workout-draft-persistence` is **not** modified: `isWarmup: z.boolean().default(false)` keeps drafts
written under the existing `gymbro:workout-draft:v1` key loadable, so no version bump and no spec change.

## Approach

### Set ordering — per-workout integer `order` (exploration approach A)

`createWorkout` already flattens `listExercises` into an exercise-major array. The server assigns each
element its index in that flat array as `order`, in one nested `sets.create`. Reads sort by
`(order, createdAt, id)` so the sort is total even if two rows ever share an `order`. The index is
non-unique and gaps are tolerated, so a future delete never forces re-sequencing.

"Serie N" in the UI stays the index *within* its exercise group, not the stored `order` — the stored
value is a workout-wide sequence, which is what lets an interleaved session (bench, squat, bench)
round-trip correctly once F1.1 allows it.

Rejected: per-exercise `setNumber` plus a separate exercise-ordering key (two ordering keys, renumbering
on delete, cannot express interleaving); `createdAt` as the order key (a nested create gives every row an
identical timestamp); adding `@@unique([workoutId, order])` (a non-deferrable unique makes any future
reorder or shift brittle for no benefit here).

**Naming note for design**: `order` is the ticket's term but is a reserved word in SQL — Prisma quotes
every identifier it generates, so this is safe through the client, and only hand-written raw SQL or
`psql` sessions would need `"order"`. `position` avoids that entirely. Design settles it; this proposal
assumes `order`.

### `Workout.tag` — owner-scoped uniqueness + non-blocking collision suffix

**Evidence gathered for this decision** (the open product decision the orchestrator routed here):

- `dateWorkout` has no default in the form (`defaultValues` omits it) and no text input. Its only source
  is `<Calendar mode='single' onSelect={…}>` — shadcn's wrapper over `react-day-picker` v9
  (`src/components/ui/calendar.tsx`). v9 hands `onSelect` the `CalendarDay` date for the clicked cell,
  normalized to the start of that day in the browser's timezone, i.e. local midnight with no time-of-day.
  *Caveat*: `node_modules` is not installed in this worktree and this agent has no shell, so this is the
  library's documented behavior, not a byte-level read of its source — see Risk 3.
- The draft round-trip preserves the instant exactly (`JSON.stringify` → ISO string → `new Date(iso)`),
  so it introduces no jitter.
- Therefore `dateWorkout.toISOString()` is a pure function of (calendar day, browser UTC offset), and
  `tag` is a pure function of (workout name, calendar day). Same user + same name + same day produces a
  **byte-identical tag every time**: the collision is deterministic and 100% reproducible, not rare.
- Independent of the library detail, the product models *days*, never instants: the picker renders
  `format(value, "PPPP")` and every list/detail surface renders `date.toDateString()`. There is no
  time-of-day input or display anywhere. The ISO instant in the tag is therefore not meaningful data —
  it is an accidental uniqueness salt.

**Why not block.** Two sessions named "Día de pierna" on one day is legitimate, not user error — F1.x
explicitly anticipates several sessions per day. This is the decisive difference from
`exercise-tag-uniqueness`, where blocking a duplicate *is* correct because two exercises with the same
name are genuinely redundant. That precedent supplies the *mechanism* (composite per-user unique +
targeted P2002 mapping), not the blocking behavior.

**Chosen: (a) deterministic base tag + disambiguating suffix on collision, resolved by retry.**

1. `Workout.tag` moves from global `@unique` to `@@unique([userId, tag])`. This alone fixes the
   cross-user collision: two users may now hold the same tag. Reads are unaffected — `getWorkoutBySlug`
   already filters by `userId`, and can be tightened from `findFirst` to `findUnique` on the composite.
2. Same-user collisions are resolved by attempting the insert with the base tag and, on a P2002 whose
   target is exactly the `(userId, tag)` constraint, retrying with `-2`, `-3`, … up to a bounded
   constant (suggest 10; design settles the number). No pre-check query, so there is no check-to-create
   race — the database constraint is the single source of truth. A failed `prisma.workout.create` with
   its nested `sets.create` rolls back entirely, so each retry is clean.
3. Exhausting the bound maps to a **new, specific** result code (e.g. `duplicate_tag`) with an honest
   message, replacing today's misleading generic `error`. This residual path is reachable only after N
   same-name sessions in one day.
4. The base tag formula is **unchanged**. The workout's `name` is never modified — only the URL slug
   disambiguates. Tags are stored, never recomputed, so existing rows and URLs are untouched.

Rejected alternatives:

| Option | Why not |
|---|---|
| (b) Always-suffixed opaque slug (random suffix on every workout) | Slightly less code than (a) — no retry — but adds noise to every URL for the ~95% no-conflict case, and a random suffix must be injected to stay testable under strict TDD. (a) keeps the common case deterministic and trivially unit-testable. |
| (c) Route by `id`, demote `tag` to a display label | The right eventual destination — it dissolves this whole problem class and survives a rename. But the blast radius is `/workouts/[slug]`, `WorkoutsSection`, `getWorkoutBySlug`, `src/lib/breadcrumbs.ts`, `src/lib/breadcrumb-trails.ts` and their tests, plus `revalidatePath` — and the breadcrumb trail resolution was just hardened in PR #41. Against an already Medium-High 400-line budget this would blow the slice and put a fresh fix at risk. Deferred to F0.2, which needs it anyway (a renamed workout must keep its URL). |
| (d) Block with a clear message | Rejected on product grounds: it refuses a legitimate workout. Its mechanism survives only as the bounded last-resort `duplicate_tag` path in step 3. |

**Constraint this hands to F0.2**: the tag must stay immutable after creation. If F0.2 lets a user rename
a workout, the tag must *not* be recomputed, or every existing URL breaks — which is precisely why F0.2
should adopt (c).

### Validation and timestamps

`weight` becomes `min(0)` and `reps` stays `min(1)`. `setsSchema` keeps `.min(1)` and drops `.max(5)`;
no technical upper bound is introduced (settled decision, gap 4). The two duplicate `setSchema`
definitions collapse to one, re-exported from `workout-set.ts`.

Timestamps use `@default(now())`, and `updatedAt` is `@default(now()) @updatedAt` so the migration
applies to non-empty tables without hand-editing SQL. `Set.order` is the one column with no default; the
dev database is reset instead of adding a `@default(0)` fallback (settled decision, gap 3 — no deployed
data exists).

### Settled decisions carried in from the orchestrator

Gaps 2–6 from the exploration are settled and are **not** revisited by this proposal: no warmup UI toggle
and no "series"-count change (2); reset the dev DB, no `@default(0)` on `Set.order` (3); no upper bound
on sets (4); no `Set.updatedAt` (5); `startedAt`/`endedAt` stay nullable and unwired, `Workout.date`
stays authoritative (6).

## Affected Areas

| Area | Impact | Description |
|---|---|---|
| `prisma/schema.prisma` | Modified | `Set.order`/`createdAt`/`isWarmup` + `@@index([workoutId, order])`; `Workout.startedAt`/`endedAt`/`createdAt`/`updatedAt`; `Exercise.createdAt`/`updatedAt`; `Workout.tag` `@unique` → `@@unique([userId, tag])` |
| `prisma/migrations/<ts>_<name>/` | New | Exactly one generated migration; never hand-edited |
| `src/lib/schemas/workout.ts` | Modified | `weight` min 0, drop `.max(5)`, add `isWarmup`, re-export the shared `setSchema` |
| `src/lib/schemas/workout-set.ts` | Modified | Single source of truth for `setSchema`; `weight` min 0, `isWarmup` |
| `src/lib/workout-sets.ts` | New | Pure helpers: `buildSetsForCreate`, `sortSets`, `groupSetsByExercise` |
| `src/lib/workout-tag.ts` | New | Pure helper: base tag + `nextTagCandidate(base, attempt)`; P2002 target matcher for `(userId, tag)` |
| `src/actions/workout/create-workout.ts` | Modified | Persist `order`/`isWarmup`; bounded collision retry; new `duplicate_tag` result code |
| `src/actions/workout/get-workouts.ts` | Modified | Explicit `orderBy` on sets |
| `src/actions/workout/get-workout-by-slug.ts` | Modified | Explicit `orderBy` on sets; optional `findFirst` → `findUnique` on the composite |
| `src/interfaces/actions/workout.interfaces.ts` | Modified | `DataItem` gains `order`, `isWarmup`, `createdAt` |
| `src/components/workout/WorkoutCreationForm.tsx` | Modified | Remove `disabled={setFields.length >= 5}` (line 193); default `isWarmup: false`; handle `duplicate_tag` in the result-code message map |
| `src/components/workout/WorkoutDetailSets.tsx` | Modified | Stale weight message; set numbering sourced from the group index |
| `src/lib/schemas/workout.test.ts`, `workout-set.test.ts`, `src/lib/workout-draft.test.ts` | Modified | weight 0 accepted, 6 sets accepted, `toEqual` gains `isWarmup: false` |
| `src/lib/workout-sets.test.ts`, `src/lib/workout-tag.test.ts`, `src/actions/workout/create-workout.test.ts` | New | Pure-helper tests + mocked-Prisma action tests (pattern from `create-exercise.test.ts`) |

Unaffected and deliberately untouched: `/api/seed`, `src/seed/index.ts`, `src/lib/breadcrumbs.ts`,
`src/lib/breadcrumb-trails.ts`, `src/lib/workout-draft.ts`.

## Risks

| Risk | Likelihood | Mitigation |
|---|---|---|
| 1. `Set.order` is required with no default → any code path creating a `Set` without it fails, and older code cannot run against the new schema | High if split badly | Ship schema + the `createWorkout` write in the same slice and the same commit; `updateSet` only updates existing rows. Reset the dev DB rather than backfilling. |
| 2. Relaxing `Workout.tag` to `@@unique([userId, tag])` is a practical one-way door: once two users hold the same tag, restoring the global unique fails until the duplicates are de-duplicated | Medium | Accepted. It is a relaxation, so nothing is lost going forward; the rollback plan documents the de-dup requirement explicitly. No deployed data today. |
| 3. The "local midnight, no time-of-day" property of the date picker is documented behavior, not verified here (`node_modules` unavailable, no shell) | Medium | It changes collision *frequency*, not the design: the chosen approach is correct whether collisions are deterministic or rare. Pin it with an assertion in the apply phase. |
| 4. `z.coerce.number().min(0)` turns `""` and `null` into `0`, which the relaxed rule now accepts — blank weight fields would silently persist as 0 kg | High if unhandled | Explicitly reject blank/null weight before coercion and add `.finite()` on weight / `.int()` on reps. This is a genuine regression introduced by the min-0 change and must be covered by a test. |
| 5. A P2002 retry loop could mask an unrelated unique violation | Low | Match the exact constraint target before retrying, mirroring `isCanonicalUniquenessViolation` in `src/lib/exercises.ts`. |
| 6. Estimated size exceeds the 400-line review budget | High | Split into two stacked slices — see Delivery. |
| 7. Removing the set cap removes the only guard against a runaway nested create | Low | Accepted per settled decision (gap 4); `sets.create` is a single transaction and the form is manual entry. |

## Rollback Plan

**Before merge**: discard the branch. Restore the local database with
`pnpm exec prisma migrate reset` followed by `pnpm seed` — all data is test data, so nothing is lost.

**After merge**: the generated migration must never be hand-edited (project hard rule #6). Roll forward
with a new `pnpm exec prisma migrate dev --name revert_workout_data_foundation` that:

1. Drops `Set.order`, `Set.createdAt`, `Set.isWarmup` and `@@index([workoutId, order])`. Set ordering
   data is lost — acceptable, since it only exists for test data.
2. Drops the `Workout` and `Exercise` timestamp columns.
3. Only if the global tag constraint must genuinely be restored: de-duplicate any cross-user `tag`
   collisions **first**, then `DROP INDEX "Workout_userId_tag_key"` and recreate `Workout_tag_key`.
   Without the de-dup step this statement fails. In practice the tag relaxation should be kept.

**Code and schema roll back together.** The timestamp and `isWarmup` columns are backward-compatible
(defaults / nullable), but `Set.order` is required with no default, so reverting the application code
alone would break every set insert. Revert both, or add a temporary `@default(0)` in the reverting
migration.

## Dependencies

- A running local PostgreSQL (`podman compose up -d`) to generate and apply the migration.
- No new npm packages. No external service, API or Prisma version change.
- Blocks F0.2 (workout edit/delete), F1.1 (live session, rest timers) and F2 (progress metrics).

## Delivery

Exploration estimated ~400–470 authored changed lines; the tag work adds roughly another 60–90
(helpers, tests, the new result code and its message), landing at **~460–560**. That is over the 400-line
budget, and the session strategy is `ask-on-risk`, so **a split decision is required before apply** —
`sdd-tasks` owns the formal forecast.

Recommended two stacked slices, chosen so each leaves the build and tests green:

- **Slice 1 — schema foundation**: `prisma/schema.prisma`, the single migration, `src/lib/workout-sets.ts`
  and its tests, the minimal `createWorkout` change that supplies `order`/`isWarmup`, and
  `workout.interfaces.ts`. This boundary is forced: `Set.order` is required with no default, so the
  migration cannot land without the write that populates it or `pnpm build` breaks.
- **Slice 2 — behavior**: Zod changes and their tests, the tag collision resolver and `duplicate_tag`
  code, explicit set ordering in both read paths, and the UI adjustments (cap removal, stale message,
  numbering).

## Success Criteria

- [ ] Exactly one new migration folder exists, generated by `prisma migrate dev`, committed together with `prisma/schema.prisma`, and not hand-edited.
- [ ] `Set` carries `order`, `createdAt` and `isWarmup` (default `false`), with a non-unique `@@index([workoutId, order])`.
- [ ] `Workout` carries nullable `startedAt`/`endedAt` plus `createdAt`/`updatedAt`; `Exercise` carries `createdAt`/`updatedAt`.
- [ ] `createWorkout` persists a server-assigned `order` matching the submitted exercise-major position, and persists `isWarmup`.
- [ ] `getWorkouts` and `getWorkoutBySlug` return sets in that stored order, deterministically.
- [ ] A set with `weight: 0` and `reps: 1` validates and persists; `reps: 0` is rejected.
- [ ] More than five sets validate and persist; zero sets and zero exercises are still rejected.
- [ ] A blank or null weight field is rejected rather than silently coerced to 0.
- [ ] Two different users can each save a workout with the same name on the same date.
- [ ] One user can save two workouts with the same name on the same date; both are retrievable at distinct URLs, both keep the name the user typed, and neither save is refused.
- [ ] `pnpm test` passes, including new tests for the Zod rules, the ordering helper, the tag helper, and `createWorkout`'s ordering and collision behavior.
- [ ] `pnpm build`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit` and `pnpm exec prisma validate` all pass.
