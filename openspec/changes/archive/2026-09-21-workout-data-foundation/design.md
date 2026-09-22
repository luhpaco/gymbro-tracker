# Design: Workout Data Foundation

Change: `workout-data-foundation` (Notion F0.1). Inputs: `proposal.md`, `exploration.md`, and the delta
specs under `specs/` (`workout-set-ordering`, `workout-set-validation`, being written in parallel).
Everything below was checked against the current code (`create-workout.ts`, `get-workouts.ts`,
`get-workout-by-slug.ts`, `schemas/workout*.ts`, `exercises.ts`, `WorkoutCreationForm.tsx`,
`WorkoutDetailSets.tsx`, `workout-draft.ts`, `schema.prisma`).

## Technical Approach

One migration, one new pure helper module per concern, and thin edits to the existing actions. The
change is layered so that every decision that can be a pure function is one, which keeps Strict TDD
cheap (Vitest runs pure units and mocked-Prisma actions only — no DB integration exists).

1. **Schema** — `Set` gains `order`/`isWarmup`/`createdAt` and an index; `Workout` and `Exercise` gain
   timestamps; `Workout.tag` moves from global `@unique` to `@@unique([userId, tag])`. One generated
   migration, never hand-edited.
2. **Ordering** (`src/lib/workout-sets.ts`, pure) — `buildSetsForCreate` assigns the workout-wide
   zero-based flat position; `sortSets` is the single in-memory definition of the read order;
   `groupSetsByExercise` sorts, then groups; `SET_ORDER_BY` mirrors the comparator for Prisma.
3. **Tag** (`src/lib/workout-tag.ts`, pure) — unchanged base-tag formula, `nextTagCandidate`, the exact
   `(userId, tag)` P2002 matcher, and the attempt bound. The retry loop itself lives in `createWorkout`.
4. **Validation** — one `setSchema` (in `workout-set.ts`), re-exported from `workout.ts`; explicit
   numeric parsing that rejects blank/`null` before coercion; `isWarmup` defaulting to `false`; the
   `.max(5)` cap removed.
5. **Reads** — `getWorkouts` and `getWorkoutBySlug` request sets with `SET_ORDER_BY` and group them with
   `groupSetsByExercise`, replacing two hand-rolled `reduce` blocks.
6. **UI** — remove the 5-set button cap, default `isWarmup: false` on new sets, map the new
   `duplicate_tag` result code to a message.

Query placement follows the repo's real convention: Prisma calls stay in `src/actions/**` (as
`createExercise` does) and `src/lib/**`; components never query. Server actions validate with
`AddWorkoutFormSchema.safeParse` before touching the DB, as today.

## Architecture Decisions

### Decision: Column name is `order`, not `position`

**Choice**: `Set.order Int`, index `@@index([workoutId, order])`.
**Alternatives considered**: `position` (avoids the SQL reserved word).
**Rationale**: Prisma quotes every identifier it emits (`"order"` in generated DDL and DML), and there is
no `$queryRaw`/`$executeRaw` anywhere in `src/` (verified by grep), so the reserved word cannot bite
through the client. `order` matches the Notion ticket, the proposal, and the delta specs that are being
written in parallel (`workout-set-ordering` already speaks of "order value"), so renaming would create
spec/code drift for a purely hypothetical benefit. Cost accepted: any future hand-written SQL or `psql`
session must write `"order"`. `prisma format` is not affected. `orderBy: { order: "asc" }` is
unambiguous in the Prisma client.

### Decision: Order is workout-wide, zero-based, server-assigned; read order is `(order, createdAt, id)`

**Choice**: `order` = index in the exercise-major flattened array (0-based, matching the spec's
scenarios). Non-unique, gaps tolerated. Total read order `(order asc, createdAt asc, id asc)`.
**Alternatives considered**: `@@unique([workoutId, order])` (rejected: brittle for shift/reorder in
F0.2/F1.1, guards nothing that matters here); per-exercise `setNumber` + exercise-order key (two keys,
cannot express interleaving); `createdAt` as key (a nested create gives every row an identical
timestamp).
**Rationale**: One sort key, no re-sequencing on delete, interleaved sessions round-trip, and the
tie-break makes the sort total even if a future writer produces a duplicate `order`. The client never
supplies `order`: `AddWorkoutFormSchema` is a non-strict `z.object` (unknown keys are stripped) and
`buildSetsForCreate` reads only `exerciseValue`, `reps`, `weight`, `isWarmup`, so a forged `order` is
dropped twice over. "Serie N" in the UI stays the index inside the exercise group (see UI decision).

### Decision: The read order is defined once in JS (`sortSets`) and mirrored once for Prisma (`SET_ORDER_BY`); `groupSetsByExercise` always sorts

**Choice**: `groupSetsByExercise` calls `sortSets` before grouping, and both read actions also pass
`orderBy: SET_ORDER_BY` in the nested `sets` include.
**Alternatives considered**: DB `orderBy` only (the bug today is precisely a query that forgot its
`orderBy` — `getWorkouts` has none — and nothing type-level stops the next one from forgetting it);
JS sort only (drops the explicit-sort requirement in the spec and any index benefit).
**Rationale**: Mock-based Vitest cannot exercise a real `ORDER BY`, so a pure, exhaustively tested
comparator is the only place the tie-break semantics can be verified. `id` is only a determinism
tie-breaker: the DB may collate uuid text differently from JS code-unit order, which is harmless
because the JS sort runs last and is therefore the authoritative order of the grouped result. The
duplication is two lines of keys, guarded by a test that pins `SET_ORDER_BY`. Cost of the extra sort is
negligible (tens of rows per workout).

### Decision: Timestamps use `@default(now())`; `updatedAt` is `@default(now()) @updatedAt`

**Choice**: `Workout.createdAt/updatedAt`, `Exercise.createdAt/updatedAt`, `Set.createdAt` (no
`Set.updatedAt`), `Workout.startedAt/endedAt` nullable and unwritten.
**Alternatives considered**: `updatedAt` without a default (the migration would demand a value for
existing rows and force a hand-edit or a reset).
**Rationale**: The default lets `prisma migrate dev` emit `ADD COLUMN ... NOT NULL DEFAULT
CURRENT_TIMESTAMP` with no manual SQL, on empty or populated tables. `@updatedAt` is applied by the
Prisma client on `update` calls only, so `Exercise.updatedAt` bumps automatically through the existing
`updateExercise` / `setExerciseActiveState`, while `updateSet` does **not** bump `Workout.updatedAt`
(it updates `Set`, which has no `updatedAt` — settled). That is documented, not changed.
`Set.createdAt` is insertion time; `Workout.date` stays the authoritative performance date for F2.
`startedAt`/`endedAt` get no CHECK constraint (would need hand-written SQL); an
`endedAt >= startedAt` refine belongs to F1.1 where the fields are first accepted.

### Decision: `Workout.tag` — composite unique plus bounded suffix retry, resolved by the constraint

**Choice**: `@@unique([userId, tag])` (constraint/index name `Workout_userId_tag_key`).
`createWorkout` derives the unchanged base tag, then inserts with candidate tag
`nextTagCandidate(base, attempt)` for `attempt = 1..MAX_TAG_ATTEMPTS` (`MAX_TAG_ATTEMPTS = 10`):
attempt 1 is the base tag, attempt `n >= 2` is `${base}-${n}`. Only a P2002 whose target is exactly
that constraint triggers the next attempt. Exhaustion returns the new code `duplicate_tag`. The
workout `name` is never altered.
**Alternatives considered**: pre-check `findFirst` then insert (check-to-create race, two queries);
always-suffixed random slug (noisy URLs, needs injected randomness for testability); route by `id`
(right destination, deferred to F0.2); block with an error (refuses a legitimate second session).
**Rationale**: The database constraint is the single source of truth, so there is no race and no extra
query on the ~95% no-collision path. A failed `workout.create` with nested `sets.create` is one
implicit transaction and rolls back completely, so each retry starts clean, and a unique violation on
the parent row aborts before any child row is written. Bound of 10 covers ten same-name sessions in
one day (F1.x anticipates a few) while keeping the worst case at 10 cheap failing inserts.
**Suffix unambiguity**: a base tag always ends in the ISO instant, i.e. the letter `Z`
(`...T00:00:00.000Z`), and a suffixed tag always ends in `-<digits>`. A suffixed tag can therefore never
equal some other workout's base tag, so suffixing cannot manufacture a new collision with a base tag.
Existing rows and URLs are untouched (tags are stored, never recomputed).
**Interim behavior between slices**: after Slice 1 the constraint is already per-user (cross-user
collision fixed) but same-user collisions still surface as the generic `error` until Slice 2 lands the
retry. That is a strict improvement over today, not a regression.

### Decision: The P2002 matcher is local to `workout-tag.ts`, mirroring `isCanonicalUniquenessViolation`

**Choice**: `isWorkoutTagCollision(err)` in `src/lib/workout-tag.ts`. It returns true only for
`code === "P2002"` and either an array `meta.target` of length 2 containing `userId` and `tag` (either
order) or the string `"Workout_userId_tag_key"`. Anything else — `["id"]`, a missing `meta`, a
different code, a non-object — is false and is rethrown untouched.
**Alternatives considered**: extract a shared `isUniqueViolationOn(err, {fields, constraint})` and make
`isCanonicalUniquenessViolation` delegate (better DRY, but edits the shipped `exercise-name-uniqueness`
code and adds about 45 lines to a change already at the review budget); match on `code` alone (would
mask any unrelated unique violation — Risk 5 of the proposal).
**Rationale**: Follows the existing pattern instead of refactoring across capabilities inside an
unrelated PR. Both target shapes are handled because the precedent already proves both occur (array of
field names for the native PostgreSQL connector, constraint name otherwise). The duplication is about
15 lines and is recorded as follow-up debt (unify both matchers), not silently accepted. On Workout the
only unique constraints are `id` and `(userId, tag)`, so an exact-target match is unambiguous.

### Decision: The retry loop lives in the action, not in `src/lib`

**Choice**: the loop is inline in `createWorkout`; `src/lib/workout-tag.ts` holds only pure pieces.
**Alternatives considered**: a generic `withUniqueSuffixRetry(fn, opts)` in `src/lib`.
**Rationale**: One call site; the action test with a mocked `prisma.workout.create` exercises the loop
end to end (attempt count, tag sequence, exhaustion) without another abstraction. Constants must not be
exported from the `"use server"` file — Next.js permits only async-function exports there — which is
also why `MAX_TAG_ATTEMPTS` and `SET_ORDER_BY` live in `src/lib`.

### Decision: Validation — explicit numeric parsing instead of `z.coerce`

**Choice**: a private `parseNumericInput` preprocess feeding `z.number(...)`:
strings are trimmed; a blank string becomes `undefined`; other strings become `Number(value)`;
everything else (including `null`, booleans, arrays) passes through untouched so `z.number` rejects it.
Weight is `.finite().min(0)`; reps is `.int().min(1)`.
**Alternatives considered**: keep `z.coerce.number().min(0)` plus a `refine` (`Number("")`, `Number(" ")`,
`Number(null)` and `Number([])` are all `0`, and `0` is now valid weight, so blank input would silently
persist as 0 kg; a refine after coercion cannot tell `""` from `0`); `z.union([z.number(),
z.string().min(1)]).pipe(z.coerce.number())` (correct but harder to read and to give one message to).
**Rationale**: This is a genuine regression introduced by relaxing to `min(0)` (Risk 4), so it must be
closed in the same change. Rejecting before coercion also stops `true` and `[5]` from being coerced to
numbers, which `z.coerce` would have accepted. Blank reps are rejected too (they became `0`, which
`min(1)` already caught; the explicit path just makes the message consistent).
Messages (Spanish, matching the app; the weight message must not say "add weight" because `0` is valid):
weight (any failure) `"El peso debe ser un número igual o mayor a 0"`; reps required/blank/`< 1`
`"Debes agregar tus repeticiones"` (unchanged, existing tests keep passing); reps fractional
`"Las repeticiones deben ser un número entero"`.
`setSchema.shape.weight` / `.shape.reps` stay usable: they are now `ZodEffects` and still expose
`safeParse`/`optional()`, which is all `updateSet` and both form validators use. `.optional()` on the
effect short-circuits `undefined` before the preprocess, so `updateSet`'s "omit weight" path is intact,
while `weight: null` is still rejected.

### Decision: One `setSchema`, defined in `workout-set.ts`, re-exported by `workout.ts`

**Choice**: delete the duplicate in `workout.ts`; add `import { setSchema } from "./workout-set"; export
{ setSchema };`. `isWarmup: z.boolean().default(false)` is added to the single definition.
**Rationale**: `workout.test.ts` and `WorkoutCreationForm.tsx` import `setSchema` from `./workout` /
`@/lib/schemas/workout`; the re-export keeps both working with no import churn. `setsSchema` keeps
`.min(1, "Debes agregar al menos un set")` and drops `.max(5)`; no technical upper bound (settled).

### Decision: Draft compatibility through the default, no version bump

**Choice**: `workout-draft.ts` is not edited. It embeds `AddExerciseFormSchema`, so a draft saved under
`gymbro:workout-draft:v1` without `isWarmup` parses and gains `isWarmup: false`.
**Rationale**: settled. The `WorkoutDraft` output type now requires `isWarmup`, so type-checked
fixtures (`workout-draft.test.ts`) must include it. Observation, out of scope: a draft holding a
just-added, untouched set (`reps: 0` from `emptySets`) already fails `min(1)` on load today and is
discarded; unchanged by this change.

### Decision: Read actions — `findUnique` on the new composite, and a workout tie-break

**Choice**: `getWorkoutBySlug` uses `findUnique({ where: { userId_tag: { userId, tag: slug } } })`.
`getWorkouts` orders workouts by `[{ date }, { createdAt }]` (both in the caller's direction).
**Rationale**: `findFirst` on `(tag, userId)` implied "first of possibly many"; the DB now guarantees at
most one, so `findUnique` states the invariant and uses the unique index. Same-day sessions are exactly
what this change legitimizes, and `date` is local midnight, so `orderBy: date` alone gives unstable
`skip/take` pagination between same-day workouts; `createdAt` is a free, correct tie-break. This
tie-break goes slightly beyond the proposal text and is the first thing to drop if Slice 2 must shrink.

### Decision: `WorkoutDetailSets.tsx` needs no change (proposal delta)

**Choice**: no edit. Numbering already uses `index + 1` over the per-exercise `sets` array it receives,
which is the group-relative numbering the spec requires; the stale weight message is sourced from
`setSchema.shape.weight`, so it changes with the schema. The proposal's Affected Areas row for this
file is superseded.
**Rationale**: verified in the file; touching it would add lines and risk for no behavior. The
group-relative guarantee is covered by the `groupSetsByExercise` test (a group's array index is the
displayed number).

### Decision: `DataItem` gains the new columns

`DataItem` adds `order: number`, `isWarmup: boolean`, `createdAt: Date`. Required for `sortSets`
typing and satisfied by the Prisma row after migration. `Date` crosses the RSC boundary to the
client component `WorkoutDetailSets` (React 19 Flight serializes `Date`); no component reads it.

## Data Flow

### Write path

```
WorkoutCreationForm ──(CreateWorkoutFormData + isWarmup per set)──▶ createWorkout (server action)
      │                                                                   │
      │ Zod (client)                          auth() ─▶ AddWorkoutFormSchema.safeParse
      ▼                                                                   │
 toast(result.code)  ◀──────────── {ok:false,code} ───────────────────────┤
                                                                          ▼
                                     buildSetsForCreate(listExercises)  → [{exerciseId, order, reps, weight, isWarmup}]
                                     buildWorkoutTag(name, date)        → base tag (unchanged formula)
                                                                          ▼
                                     prisma.workout.create (nested sets.create)   ── retry loop, see below
```

### Tag-collision retry

```mermaid
sequenceDiagram
    participant F as WorkoutCreationForm
    participant A as createWorkout
    participant T as workout-tag.ts
    participant P as prisma.workout.create
    participant D as PostgreSQL

    F->>A: createWorkout(formData)
    A->>A: auth(); safeParse (invalid -> invalid_input)
    A->>T: buildWorkoutTag(name, date) = base
    A->>A: sets = buildSetsForCreate(listExercises)
    loop attempt = 1 .. MAX_TAG_ATTEMPTS (10)
        A->>T: nextTagCandidate(base, attempt)
        Note right of T: 1 -> base, n>=2 -> base-n
        A->>P: create({ userId, name, date, tag, sets: { create: sets } })
        P->>D: INSERT Workout (+ Sets) in one implicit transaction
        alt insert succeeds
            D-->>P: row
            P-->>A: workout
            A-->>F: { ok: true, workout }
        else P2002 and isWorkoutTagCollision(err) (target is userId+tag)
            D-->>P: unique violation, nothing persisted
            P-->>A: throws
            Note over A: swallow, continue with attempt + 1
        else any other error (other P2002 target, connection, ...)
            P-->>A: throws
            A-->>F: { ok: false, code: "error" } (console.error)
        end
    end
    A-->>F: { ok: false, code: "duplicate_tag" } (bound exhausted)
```

Properties: each attempt is atomic (a rolled-back attempt leaves no orphan rows); the constraint, not a
pre-check, decides the winner, so two concurrent creates of the same name/day never both take the same
tag; every attempt reuses the identical validated `sets` payload; an unrelated failure never retries.

### Read path

```
getWorkouts / getWorkoutBySlug
   └─ prisma.findMany / findUnique { include: { sets: { orderBy: SET_ORDER_BY, include: { exercise: { select: { name } } } } } }
        └─ groupSetsByExercise(workout.sets)  = sortSets (order, createdAt, id) then group by exercise.name
             └─ Record<exerciseName, DataItem[]>   (key order = first appearance in stored order)
```

## File Changes

Line estimates are authored additions + deletions. The generated migration SQL is excluded from the
budget (per the review guard) but listed. Ranges are roughly plus or minus 20% because test files in this
repo are verbose (`create-exercise.test.ts` is 290 lines).

| File | Action | Slice | Est. | Description |
|------|--------|-------|-----:|-------------|
| `prisma/schema.prisma` | Modify | 1 | 20 | `Set.order/isWarmup/createdAt` + `@@index([workoutId, order])`; `Workout.startedAt/endedAt/createdAt/updatedAt`, `tag` unique -> `@@unique([userId, tag])`; `Exercise.createdAt/updatedAt`. Do not run `prisma format` (it would re-align the whole `Exercise` block and add churn). |
| `prisma/migrations/<ts>_workout_data_foundation/migration.sql` | Create (generated) | 1 | ~35 (excluded) | Produced by `prisma migrate dev --name workout_data_foundation`; never hand-edited. |
| `src/lib/workout-sets.ts` | Create | 1 | 60 | Whole module in S1: `buildSetsForCreate` (used by S1), plus `sortSets`, `groupSetsByExercise`, `SET_ORDER_BY` (exported and tested in S1, consumed by the S2 read actions). |
| `src/lib/workout-sets.test.ts` | Create | 1 | 115 | See Testing Strategy. |
| `src/lib/workout-tag.ts` | Create | 2 | 40 | `MAX_TAG_ATTEMPTS`, `buildWorkoutTag`, `nextTagCandidate`, `isWorkoutTagCollision`. |
| `src/lib/workout-tag.test.ts` | Create | 2 | 70 | Formula, candidate sequence, matcher cases. |
| `src/actions/workout/create-workout.ts` | Modify | 1 (+2) | 55 | S1: use `buildSetsForCreate`, persist `order`/`isWarmup`. S2: retry loop, `duplicate_tag`. |
| `src/actions/workout/create-workout.test.ts` | Create | 1 (+2) | 155 | Mocked-prisma pattern from `create-exercise.test.ts`; S1 ~95, S2 ~60. |
| `src/actions/workout/get-workouts.ts` | Modify | 2 | 21 | `SET_ORDER_BY`, `groupSetsByExercise`, workout tie-break; drop `WorkoutWithSets` and the `reduce`. |
| `src/actions/workout/get-workout-by-slug.ts` | Modify | 2 | 20 | `findUnique` on `userId_tag`, `SET_ORDER_BY`, `groupSetsByExercise`. |
| `src/actions/workout/get-workouts.test.ts` | Create | 2 | 30 | Asserts `findMany` args and grouped/sorted output. |
| `src/actions/workout/get-workout-by-slug.test.ts` | Create | 2 | 30 | Asserts `findUnique` args, sort, null on missing/error. |
| `src/interfaces/actions/workout.interfaces.ts` | Modify | 1 | 3 | `DataItem` gains `order`, `isWarmup`, `createdAt`. |
| `src/lib/schemas/workout-set.ts` | Modify | 1 (+2) | 36 | S1: `isWarmup`. S2: `parseNumericInput`, weight/reps rules, messages. |
| `src/lib/schemas/workout.ts` | Modify | 1 (+2) | 14 | S1: delete duplicate `setSchema`, re-export. S2: drop `.max(5)`. |
| `src/lib/schemas/workout-set.test.ts` | Modify | 1 (+2) | 73 | S1: `toEqual` gains `isWarmup`, warmup cases. S2: weight/reps tables. |
| `src/lib/schemas/workout.test.ts` | Modify | 1 (+2) | 63 | S1: `toEqual`, identity check for the re-exported schema. S2: replace the "rejects 6 sets" case with 6- and 20-set acceptance, drop the duplicated set-rule cases. |
| `src/lib/workout-draft.test.ts` | Modify | 1 | 20 | Fixture gains `isWarmup: false`; new legacy-draft (no `isWarmup`) load test. |
| `src/components/workout/WorkoutCreationForm.tsx` | Modify | 1 (+2) | 9 | S1: `isWarmup: false` in `emptySets` and `appendSet`. S2: remove `disabled={setFields.length >= 5}`, add `duplicate_tag` message. |
| `src/components/workout/WorkoutDetailSets.tsx` | No change | — | 0 | Verified: numbering already group-relative; message flows from the schema. |

Untouched on purpose: `workout-draft.ts`, `update-set.ts` (uses `setSchema.shape.*`, still valid),
`src/lib/exercises.ts`, `src/seed/index.ts` (only deletes), `/api/seed`, breadcrumbs, `get-exercises-summary.ts`.

## Interfaces / Contracts

### Prisma schema (target state; existing fields and alignment preserved)

```prisma
model Exercise {
  // ...existing fields...
  createdAt DateTime @default(now())
  updatedAt DateTime @default(now()) @updatedAt

  @@unique([userId, canonicalName])
}

model Workout {
  id        String    @id @default(uuid())
  name      String
  tag       String
  date      DateTime
  startedAt DateTime?
  endedAt   DateTime?
  createdAt DateTime  @default(now())
  updatedAt DateTime  @default(now()) @updatedAt
  sets      Set[]

  user   User   @relation(fields: [userId], references: [id])
  userId String

  @@unique([userId, tag])
}

model Set {
  id        String   @id @default(uuid())
  order     Int
  weight    Float
  reps      Int
  isWarmup  Boolean  @default(false)
  createdAt DateTime @default(now())

  workout   Workout @relation(fields: [workoutId], references: [id])
  workoutId String

  exercise   Exercise @relation(fields: [exerciseId], references: [id])
  exerciseId String

  @@index([workoutId, order])
}
```

Expected generated migration (to be read back, not authored): `DROP INDEX "Workout_tag_key"`;
`ALTER TABLE` adding the `Exercise`, `Set` (`"order" INTEGER NOT NULL`, `"isWarmup" BOOLEAN NOT NULL
DEFAULT false`) and `Workout` columns with `DEFAULT CURRENT_TIMESTAMP` on the timestamps;
`CREATE INDEX "Set_workoutId_order_idx"`; `CREATE UNIQUE INDEX "Workout_userId_tag_key"`. `Set.order` has
no default on purpose (settled), so Prisma emits its "required column without a default" warning and
`migrate dev` will offer to reset a non-empty dev database. That reset is the intended path.

### `src/lib/workout-sets.ts`

```ts
import type { Prisma } from "@prisma/client"; // type-only, erased at runtime

export interface SetCreateRow {
	exerciseId: string;
	order: number;
	reps: number;
	weight: number;
	isWarmup: boolean;
}

interface ExerciseEntry {
	exerciseValue: string;
	sets: ReadonlyArray<{ reps: number; weight: number; isWarmup: boolean }>;
}

export interface SortableSet {
	id: string;
	order: number;
	createdAt: Date;
}

/** Flat exercise-major position becomes `order` (0-based, workout-wide). Never reads a client `order`. */
export const buildSetsForCreate = (
	listExercises: readonly ExerciseEntry[],
): SetCreateRow[] => /* flatMap sets, then map((row, order) => ({ ...row, order })) */;

/** The one in-memory definition of read order: order, then createdAt, then id. Non-mutating. */
export const sortSets = <T extends SortableSet>(sets: readonly T[]): T[] => /* [...sets].sort(cmp) */;

/** Sorts, then groups by exercise name; key order is first appearance in stored order. */
export const groupSetsByExercise = <T extends SortableSet & { exercise: { name: string } }>(
	sets: readonly T[],
): Record<string, T[]> => /* ... */;

/** Prisma mirror of sortSets. */
export const SET_ORDER_BY: Prisma.SetOrderByWithRelationInput[] = [
	{ order: "asc" },
	{ createdAt: "asc" },
	{ id: "asc" },
];
```

### `src/lib/workout-tag.ts`

```ts
export const MAX_TAG_ATTEMPTS = 10;
export const WORKOUT_TAG_CONSTRAINT_KEY = "Workout_userId_tag_key";

/** Byte-identical to today's formula so existing tags/URLs remain valid. */
export const buildWorkoutTag = (name: string, date: Date): string =>
	name.toLowerCase().replace(/\s/g, "-") + "-workout-" + date.toISOString();

/** attempt 1 (or lower) -> base; attempt n >= 2 -> `${base}-${n}`. */
export const nextTagCandidate = (baseTag: string, attempt: number): string =>
	attempt <= 1 ? baseTag : `${baseTag}-${attempt}`;

export const isWorkoutTagCollision = (err: unknown): boolean => /* exact userId+tag P2002, both shapes */;
```

### `createWorkout` (shape after Slice 2)

```ts
type CreateWorkoutResult =
	| { ok: true; workout: Workout }
	| { ok: false; code: "unauthorized" | "invalid_input" | "duplicate_tag" | "error" };

// inside try:
const { listExercises, nameWorkout, dateWorkout } = parsed.data;
const baseTag = buildWorkoutTag(nameWorkout, dateWorkout);
const sets = buildSetsForCreate(listExercises);
for (let attempt = 1; attempt <= MAX_TAG_ATTEMPTS; attempt++) {
	try {
		const workout = await prisma.workout.create({
			data: {
				userId: session.user.id,
				name: nameWorkout,
				date: dateWorkout,
				tag: nextTagCandidate(baseTag, attempt),
				sets: { create: sets },
			},
		});
		return { ok: true, workout };
	} catch (error) {
		if (!isWorkoutTagCollision(error)) throw error;
	}
}
return { ok: false, code: "duplicate_tag" };
// outer catch: console.error(error); return { ok: false, code: "error" };
```

`WorkoutCreationForm`'s `messages: Record<typeof result.code, string>` makes `duplicate_tag` a compile
error until it is mapped, which is the desired enforcement. New copy (Spanish, the app's language):
`duplicate_tag`: "Ya tienes varios entrenamientos con ese nombre en esa fecha. Cambia el nombre o la
fecha e inténtalo de nuevo."

### `src/lib/schemas/workout-set.ts` (target)

```ts
const parseNumericInput = (value: unknown): unknown => {
	if (typeof value !== "string") return value;
	return value.trim() === "" ? undefined : Number(value);
};

export const setSchema = z.object({
	reps: z.preprocess(
		parseNumericInput,
		z
			.number({ required_error: REPS_MESSAGE, invalid_type_error: REPS_MESSAGE })
			.int({ message: REPS_INTEGER_MESSAGE })
			.min(1, { message: REPS_MESSAGE }),
	),
	weight: z.preprocess(
		parseNumericInput,
		z
			.number({ required_error: WEIGHT_MESSAGE, invalid_type_error: WEIGHT_MESSAGE })
			.finite({ message: WEIGHT_MESSAGE })
			.min(0, { message: WEIGHT_MESSAGE }),
	),
	isWarmup: z.boolean().default(false),
});
```

`z.infer` output stays `{ reps: number; weight: number; isWarmup: boolean }`; `z.input` for reps/weight
becomes `unknown`. `@hookform/resolvers` is generic over the form-values type and the form already types
`useForm<FormValues>` with the output type, so this should compile unchanged; `pnpm exec tsc --noEmit`
is the gate that proves it (see Open Questions).

## Testing Strategy

Strict TDD, `pnpm test` (Vitest, `environment: "node"`), co-located `*.test.ts`. Vitest does not
type-check, so RED tests can be written and run before the Prisma client is regenerated; `tsc` and
`pnpm build` need `prisma migrate dev` + generate first. No DOM/component tests and no DB-integration
tests exist (Stage 3 is roadmap), so real `ORDER BY` and real P2002 shapes are verified once manually
(see Migration / Rollout) and otherwise by the mocked contracts.

| Layer | What to test | Approach |
|-------|--------------|----------|
| Unit (pure) `workout-sets.test.ts` | `buildSetsForCreate`: single exercise -> orders `0,1,2`; two exercises continuous `0..3`; interleaved same exercise (A,B,A) -> `0,1,2` with repeated `exerciseId`; `isWarmup` passthrough; a forged extra `order` on input is not copied; empty list -> `[]`. `sortSets`: order wins over reverse-sorted ids; equal order -> `createdAt`; equal both -> `id`; gapped `0,1,3`; input array not mutated. `groupSetsByExercise`: bench/squat/bench -> bench group holds both bench sets in stored order and key order is first appearance; unsorted input is still sorted within groups; `SET_ORDER_BY` pinned to `[order, createdAt, id]` asc. | Table-driven `it.each` where cases differ only by data. |
| Unit (pure) `workout-tag.test.ts` | `buildWorkoutTag` reproduces `"dia-de-pierna-workout-2026-01-15T00:00:00.000Z"` and converts every whitespace char; `nextTagCandidate` attempt 1 -> base, 2 -> `-2`, 10 -> `-10`; `isWorkoutTagCollision` true for `["userId","tag"]` and `["tag","userId"]` and `"Workout_userId_tag_key"`; false for `["id"]`, `["name"]`, `["userId","canonicalName"]`, missing `meta`, `P2025`, `null`, plain object. | Pattern lifted from `exercises.test.ts`. |
| Unit (schema) `workout-set.test.ts` | weight: `0`, `42.5`, `"20"` accepted; `""`, `"  "`, `null`, `undefined`, `-1`, `Infinity`, `NaN`, `"abc"`, `[]`, `true` rejected with the weight message. reps: `1`, `"12"` accepted; `0`, `-3`, `1.5`, `""`, `null` rejected. `isWarmup`: omitted -> `false`, `true` kept, `"yes"` rejected. Existing weight-below-minimum case is rewritten (weight `0` is now valid; assert `-1` message). | Assert on `issues[0].message` as the current tests do. |
| Unit (schema) `workout.test.ts` | `setSchema` from `./workout` is the same object as from `./workout-set`; `setsSchema` accepts 6 and 20 sets and still rejects `[]` with "Debes agregar al menos un set"; `AddWorkoutFormSchema` still rejects zero exercises; the `"Tómalo con calma!!"` case is deleted. | Replaces the duplicated set-rule cases with one identity assertion. |
| Unit `workout-draft.test.ts` | Round-trip `toEqual` fixture carries `isWarmup: false`; a raw v1 JSON draft whose sets lack `isWarmup` loads with `isWarmup: false`; key still `gymbro:workout-draft:v1`. | Existing mock-storage helper. |
| Unit (mocked Prisma) `create-workout.test.ts` | S1: unauthorized and invalid input never call `create`; persists `order`/`isWarmup` exactly (`data.sets.create` deep-equals the expected rows, base tag asserted); interleaved payload; client-supplied `order` ignored. S2: success on first try calls `create` once; P2002 (array target) then success -> second call tag ends `-2` and result `ok`; two collisions -> `-3`; constraint-name string target also retries; 10 consecutive collisions -> `{ ok:false, code:"duplicate_tag" }` with exactly 10 calls; unrelated P2002 (`["id"]`) and a plain `Error` -> `error` after one call; every attempt receives the identical `sets` array. | `vi.hoisted` mocks for `@/auth` and `@/lib/prisma` (`workout.create`), same shape as `create-exercise.test.ts`. |
| Unit (mocked Prisma) `get-workouts.test.ts`, `get-workout-by-slug.test.ts` | `findMany` receives `orderBy: [{date}, {createdAt}]` and `sets.orderBy` equal to `SET_ORDER_BY`; `findUnique` receives `where: { userId_tag: { userId, tag } }` and the same `sets.orderBy`; rows returned out of order come back grouped and sorted; missing workout -> `null`; thrown error -> `[]` / `null`. | Guards the "no read path may omit an explicit sort" requirement. |
| Integration | Not available in CI. | One manual smoke during apply: `migrate dev`, create the same-name workout twice in a browser, confirm `-2` URL, confirm P2002 `meta.target` shape in a `console.error` probe or Prisma logs, confirm set order on `/workouts/[slug]`. |
| E2E | None. | Out of stack scope. |

### RED -> GREEN order per slice

- **Slice 1**: (1) `workout-sets.test.ts` (all four exports) RED -> helper module GREEN; (2) `workout-set.test.ts`
  / `workout.test.ts` / `workout-draft.test.ts` isWarmup and identity cases RED -> schema dedupe GREEN;
  (3) `create-workout.test.ts` order/isWarmup RED -> action GREEN (mocks need no regenerated client);
  (4) edit `schema.prisma`, run `migrate dev`, read the SQL back, `prisma generate`; (5) form/`DataItem`
  edits, then `tsc`, `lint`, `format:check`, `build`, `prisma validate`, `test`.
- **Slice 2** (2a items then 2b items if split): (1) hardened schema tests RED -> `parseNumericInput`;
  (2) 6/20-set acceptance RED -> `.max(5)` removal; (3) read-action tests RED -> actions; (4) UI cap
  removal, then the full gate. **2b**: (5) `workout-tag.test.ts` RED -> helper; (6) `create-workout.test.ts`
  retry cases RED -> loop GREEN; (7) form `duplicate_tag` message, then the full gate.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or
process-integration boundary. (Input hardening that does apply — blank/`null` weight, forged `order`,
unrelated P2002 masking — is covered by the RED tests above.)

## Migration / Rollout

**Forward only, one generated migration.** Apply with
`pnpm exec prisma migrate dev --name workout_data_foundation`; read `migration.sql` back; commit
`schema.prisma` and the migration folder together; never hand-edit it (hard rule 6).

- `Set.order` is `NOT NULL` with no default. Any database that already holds `Set` rows makes
  `migrate dev` ask for a reset and makes `migrate deploy` fail on that statement. No deployed data
  exists (settled); every developer with local sets runs `pnpm exec prisma migrate reset` then
  `pnpm seed`. Fresh worktrees (`worktree-provision.sh` runs `migrate deploy` on an empty DB) are fine.
- CI runs only `prisma validate` and never applies migrations, so migration correctness is proven
  locally in apply and is not covered by the `verify` check. Record the read-back in the apply notes.
- Timestamp columns and `isWarmup` are backward-compatible (defaults), but `Set.order` is not: **code and
  schema roll back together** (proposal rollback plan). Old code cannot insert a `Set` against the new
  schema.
- Rollback after merge is a new forward migration `revert_workout_data_foundation` dropping the new
  columns and `Set_workoutId_order_idx`. Restoring the global `Workout_tag_key` additionally requires
  de-duplicating cross-user tag collisions first; same-user duplicates cannot exist under the composite
  constraint. In practice keep the relaxation.
- Deploy ordering between slices: merge Slice 1 (migration + write path) as one unit; developers reset
  their DB once. Slice 2 has no schema change.

### PR slicing (two stacked slices; chain strategy is the orchestrator's call under `ask-on-risk`)

The boundary is forced by `Set.order` (no default): the migration and the `createWorkout` write that
populates it must land together, or `pnpm build`/inserts break.

Total forecast is about 830 authored lines (File Changes table; generated SQL excluded), so a
two-slice plan cannot have both slices under 400. The two-slice split below is the requested baseline;
it is balanced so that Slice 1 is safe and only Slice 2 overshoots.

| Slice | Contents (file estimates from the File Changes table) | Authored lines | vs 400 |
|-------|-------------------------------------------------------|---------------:|--------|
| **1 — schema foundation + write path** | `schema.prisma` (20); migration (generated, excluded); whole `workout-sets.ts` (60) + tests (115); `createWorkout` order/`isWarmup` (25) + its tests (95); `DataItem` (3); `isWarmup` in `workout-set.ts` and dedupe in `workout.ts` (14); `isWarmup` updates to the schema/draft tests (46); form `isWarmup` defaults (4) | **~380** | Within budget, thin margin (about 5%) |
| **2 — behavior** | Zod hardening (`workout-set.ts` 33, `.max(5)` removal 3) + schema tests (110); tag helper (40) + tests (70); retry loop + `duplicate_tag` (30) + collision tests (60); read actions (41) + their tests (60); form cap removal + message (5) | **~450** | **Over budget by about 12%** |

Slice 1 is a correct stopping point on its own: the build is green, sets are stored with an order and a
warmup flag, and the constraint is already per-user (interim behavior described under the tag
decision). It includes the sort/group helpers even though only Slice 2 consumes them, because moving them
would push Slice 2 to about 555 while Slice 1 fell to about 280; the exports are pure, fully tested, and
carry no runtime coupling.

**Recommended contingency (pre-cut, for `sdd-tasks` and the user to choose under `ask-on-risk`)**:
split Slice 2 in two so every slice has real headroom.

- **Slice 1** (about 380): unchanged.
- **Slice 2a — validation, reads, UI** (about 250): Zod hardening and `.max(5)` removal with their tests,
  read actions with their tests (including `findUnique` and the `createdAt` tie-break), cap removal.
- **Slice 2b — tag collision** (about 200): `workout-tag.ts` + tests, retry loop, `duplicate_tag`, its
  form message, collision tests. Independent of 2a (either order works) and the natural seam: it touches
  only `create-workout.*`, `workout-tag.*` and one form line.

If the user insists on exactly two slices, the trims are, in order: drop the `getWorkouts` `createdAt`
tie-break and its assertion; fold the two read-action test files into the `SET_ORDER_BY` pin plus the
pure grouping tests; or accept an explicit `size:exception` for Slice 2. Do not delete blank lines or
comments, omit tests, or separate a helper from its test to hit the number.

## Open Questions

- [ ] **Budget**: the two-slice plan leaves Slice 2 at roughly 450 authored lines (Slice 1 about 380).
      Confirm three slices (1 / 2a / 2b) or a `size:exception` before `sdd-apply`. Estimates carry about
      plus or minus 20%, so Slice 1 could also cross 400.
- [ ] `tsc` risk from `z.preprocess` changing `z.input` of reps/weight to `unknown`. Expected to compile
      (`zodResolver` is generic over the form type, `useForm<FormValues>` uses the output type), but it
      could not be run while designing. If it errors, type the form with `z.input`/`z.output` generics
      rather than reverting to `z.coerce`.
- [ ] Prisma `meta.target` shape for the composite index on this connector is assumed to be
      `["userId","tag"]` (precedent handles the constraint-name string too). Confirm once against local
      Postgres in the apply smoke test; if it differs, only `isWorkoutTagCollision` changes.
- [ ] Follow-up debt (not in this change): unify `isCanonicalUniquenessViolation` and
      `isWorkoutTagCollision` into one shared `isUniqueViolationOn`.
- [ ] F0.2 constraints carried forward: the tag must stay immutable after creation (do not recompute on
      rename) and F0.2 should route by `id`. `updateSet` still does not bump `Workout.updatedAt`.
- [ ] Pre-existing and out of scope: `createWorkout` does not verify that submitted `exerciseId`s belong
      to the user or are active; drafts containing an untouched default set (`reps: 0`) are discarded on
      load; `toDateString()` renders in server timezone.
