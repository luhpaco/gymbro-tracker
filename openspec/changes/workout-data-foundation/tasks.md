# Tasks: Workout Data Foundation

Change: `workout-data-foundation` (Notion F0.1). Inputs: `proposal.md`, `design.md`, and the five delta
specs under `specs/` (`workout-set-ordering`, `workout-set-validation`, `workout-tag-uniqueness`,
`workout-session-timestamps`, `workout-creation-form`).

Mode: Strict TDD (`pnpm test` = `vitest run`, environment `node`). Every behavior task is ordered
RED (failing test observed, for the right reason) -> GREEN (smallest implementation) -> REFACTOR (only if
the code needs it), then a verification command. Vitest does not type-check, so RED tests can run before
the Prisma client is regenerated; `tsc` and `pnpm build` need `prisma migrate dev` + generate first.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~846 authored (additions + deletions) across three slices; generated `migration.sql` (~35) excluded. Ranges are roughly plus or minus 20% |
| 400-line budget risk | High if unsliced. Per slice: PR 1 about 382 (Medium, thin margin), PR 2 about 249 (Low), PR 3 about 215 (Low) |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (schema + write path) -> PR 2 (validation, reads, UI) -> PR 3 (tag collision retry) |
| Delivery strategy | ask-on-risk |
| Chain strategy | feature-branch-chain |

Decision needed before apply: No
Chained PRs recommended: Yes
Chain strategy: feature-branch-chain
400-line budget risk: High

`Decision needed before apply: No` because the `ask-on-risk` question was already answered during the SDD
preflight: the user approved the three-slice plan and `feature-branch-chain`. Two confirmations remain
mechanical (branch names in "Delivery Plan", and the Slice 1 measurement gate in task 1.19); they do not
reopen the chain decision. If the orchestrator's guard requires the literal `ask-on-risk => Yes` value,
override it and re-confirm; nothing else in this document changes.

### Line estimates by slice (from the design's File Changes table)

| Slice / PR | Authored lines | Composition |
|------------|---------------:|-------------|
| PR 1 - schema foundation + write path | ~382 | `schema.prisma` 20; `workout-sets.ts` 60 + test 115; `create-workout.ts` 25 + test 95; `DataItem` 3; `workout-set.ts`/`workout.ts` 14; isWarmup schema/draft test updates 46; form isWarmup defaults 4 (migration ~35 excluded) |
| PR 2 - validation hardening, reads, UI | ~249 | `workout-set.ts` 33 + `workout.ts` 3 + schema tests 110; read actions 41 + tests 60; form cap removal 2 |
| PR 3 - tag collision retry | ~215 | `workout-tag.ts` 40 + test 70; retry loop + `duplicate_tag` 30 + collision tests 60; form message 3; date-picker pin ~12 |

### Delivery Plan (feature-branch-chain)

Chain Context for every PR body: PR 1 targets the tracker branch; each later PR targets the immediate
previous PR branch; only the tracker merges to `master`. If a child PR shows the previous PR's changes in
its diff, the base is wrong: retarget or rebase before requesting review.

```
master
  └─ luhpaco/feat-workout-data-foundation          (tracker, draft / no-merge PR -> master)
       └─ PR 1  feat/workout-data-foundation-s1-schema-write-path       base: tracker
            └─ PR 2  feat/workout-data-foundation-s2a-validation-reads-ui   base: PR 1 branch
                 └─ PR 3  feat/workout-data-foundation-s2b-tag-collision     base: PR 2 branch
```

| PR | Branch (proposed) | Base | Work-unit commits it holds |
|----|-------------------|------|----------------------------|
| Tracker | `luhpaco/feat-workout-data-foundation` (current worktree branch) | `master` | 0. `docs(sdd): add workout-data-foundation change artifacts` (draft, no-merge) |
| PR 1 | `feat/workout-data-foundation-s1-schema-write-path` | tracker | U1 `feat(workouts): accept an isWarmup flag on set input`; U2 `feat(workouts): persist server-assigned set order and warmup flag` |
| PR 2 | `feat/workout-data-foundation-s2a-validation-reads-ui` | PR 1 branch | U3 `feat(workouts): accept bodyweight sets and remove the set cap`; U4 `fix(workouts): read sets in stored order` |
| PR 3 | `feat/workout-data-foundation-s2b-tag-collision` | PR 2 branch | U5 `feat(workouts): resolve same-day tag collisions with a bounded suffix retry` |

Branch names are proposals following the repo's `feat/<name>` convention (`feat/exercise-name-uniqueness`);
the tracker name is the branch this worktree already has checked out. Push, PR creation and merge stay the
user's decision under ordinary repository policy.

### Suggested Work Units

Each unit is one work-unit commit (tests and docs travel with the behavior). Line counts are authored
additions + deletions.

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| U1 (~64) | Set input carries an `isWarmup` flag that defaults to `false`; one shared `setSchema`; legacy v1 drafts still load | PR 1 | `pnpm exec vitest run src/lib/schemas/workout-set.test.ts src/lib/schemas/workout.test.ts src/lib/workout-draft.test.ts` | N/A: pure schema/type change with no runtime boundary; `pnpm exec tsc --noEmit` proves the form still type-checks | `src/lib/schemas/workout-set.ts`, `src/lib/schemas/workout.ts`, the three test files, the two `isWarmup: false` defaults in `WorkoutCreationForm.tsx`. U2 reads `isWarmup` from U1, so revert U2 first or both together |
| U2 (~318) | Sets persist a server-assigned workout-wide `order` and `isWarmup`; one generated migration; per-user tag constraint | PR 1 | `pnpm exec vitest run src/lib/workout-sets.test.ts src/actions/workout/create-workout.test.ts` | Local Postgres (`podman compose`): `prisma migrate dev`, create a workout in the browser, inspect `Set`/`Workout`/`Exercise` rows (task 1.18) | `prisma/schema.prisma` + the migration folder + `workout-sets.ts` + `create-workout.ts` + `DataItem`: code and schema roll back together; post-merge rollback is a forward migration `revert_workout_data_foundation` (see design, Migration / Rollout) |
| U3 (~148) | Bodyweight (weight 0) accepted, blank/null rejected before coercion, integer reps, no `.max(5)`, add-set button uncapped | PR 2 | `pnpm exec vitest run src/lib/schemas` | Browser: add a 6th and a 10th set, submit weight `0`, leave weight blank (task 2.10) | `workout-set.ts`, `workout.ts`, the two schema test files, the `disabled={setFields.length >= 5}` removal; independent of U4 |
| U4 (~101) | Both read paths sort sets by `(order, createdAt, id)` via `SET_ORDER_BY` + `groupSetsByExercise`; `findUnique` on `userId_tag`; workout `createdAt` tie-break | PR 2 | `pnpm exec vitest run src/actions/workout/get-workouts.test.ts src/actions/workout/get-workout-by-slug.test.ts` | Browser: `/workouts` list and `/workouts/[slug]` detail show sets in entered order with group-relative "Serie N" (task 2.10) | `get-workouts.ts`, `get-workout-by-slug.ts` and their two new test files; independent of U3 |
| U5 (~215) | Same-owner collision resolved by a bounded `-2`, `-3` ... suffix retry; `duplicate_tag` code and form message; date-picker assumption pinned | PR 3 | `pnpm exec vitest run src/lib/workout-tag.test.ts src/actions/workout/create-workout.test.ts` | Browser + dev-server log: create the same-name workout twice on one date, open both URLs (task 3.9) | `workout-tag.ts` + test, the retry loop and `duplicate_tag` in `create-workout.ts` + its test additions, the form message; reverting returns to the Slice 1 interim behavior (generic `error` on same-owner collision) |

### Non-Vitest spec scenarios and how they are verified

Vitest is pure-unit plus mocked-Prisma only (no DB integration, no DOM). These scenarios are routed to
explicit verification steps, not unit-test tasks:

| Spec scenario | Verification | Task |
|---------------|--------------|------|
| workout-tag-uniqueness: Scoped constraint replaces the global one | Read generated `migration.sql`: `DROP INDEX "Workout_tag_key"` and `CREATE UNIQUE INDEX "Workout_userId_tag_key"`; `pnpm exec prisma validate` | 1.13, 1.14 |
| workout-session-timestamps: Migration applies to existing rows | Read `migration.sql`: every added timestamp on the pre-existing `Workout`/`Exercise` tables is `NOT NULL DEFAULT CURRENT_TIMESTAMP` (no hand step); live confirmation if the dev DB holds Workout/Exercise rows and no Set rows | 1.13, 1.15 |
| workout-session-timestamps: No check constraint is added | Search `migration.sql` for `CHECK`: zero matches; `startedAt`/`endedAt` are nullable with no `DEFAULT` | 1.13 |
| workout-session-timestamps: Migration is not hand-edited (and exactly one migration folder) | `pnpm exec prisma migrate dev --create-only` reports already in sync and creates no folder; `git status` shows the folder unchanged; exactly one new folder vs the tracker | 1.16 |

## Phase 0: Chain setup (tracker, environment)

- [ ] 0.1 Verify the environment before any code work. `node_modules` is absent in this worktree at planning time, so run the worktree provisioning path from `.claude/rules/worktrees.md` (read-only) if `pnpm install`, the container stack, or `prisma migrate deploy` has not run (`podman compose up -d` for Postgres). Confirm the dev server port from the worktree's `.worktree-port` file (read-only). Verify: `pnpm test` runs on the unmodified branch and is green (baseline).
- [x] 0.2 Commit the SDD artifacts on the tracker branch as its first commit: `openspec/changes/workout-data-foundation/` (proposal, specs, design, tasks; they are untracked at planning time). Message `docs(sdd): add workout-data-foundation change artifacts`. Do not commit any handoff drafts from the local design folder. Push and open the draft/no-merge tracker PR against `master` only on the user's go-ahead.
- [x] 0.3 Create the PR 1 branch `feat/workout-data-foundation-s1-schema-write-path` from the tracker branch. Sync Notion F0.1 `Status` to `En curso` with `Fase / Referencia` = `openspec/changes/workout-data-foundation/` (per `.claude/rules/notion-backlog.md` (read-only)).

## Phase 1: Slice 1 - Schema foundation and write path (PR 1, base: tracker)

Boundary is forced: `Set.order` is `NOT NULL` with no default, so the migration and the `createWorkout`
write that populates it MUST land in the same PR (and the same commit, U2). U1 goes first because U2's
`buildSetsForCreate` types read `isWarmup` from the parsed set.

### Work unit U1 - warmup flag on set input (commit 1)

- [x] 1.1 RED `src/lib/schemas/workout-set.test.ts`: `isWarmup` omitted parses to `false`; `true` is preserved; `"yes"` is rejected; existing `toEqual` expectations gain `isWarmup: false`. Spec: workout-set-validation / Warmup flag defaults to false (three scenarios). Run `pnpm exec vitest run src/lib/schemas/workout-set.test.ts` and confirm it fails because the property is missing, not because of a typo.
- [x] 1.2 RED `src/lib/schemas/workout.test.ts`: `setSchema` imported from `./workout` is the same object as the one from `./workout-set` (identity); existing `toEqual` expectations gain `isWarmup: false`. Spec: workout-set-validation / Single shared set schema (Both entry points enforce identical rules). Leave the `.max(5)` and weight-minimum cases untouched; PR 2 rewrites them.
- [x] 1.3 RED `src/lib/workout-draft.test.ts`: the round-trip `toEqual` fixture gains `isWarmup: false`; add a legacy-draft case: a raw `gymbro:workout-draft:v1` JSON whose sets carry only `reps` and `weight` loads with every set `isWarmup: false`; assert the storage key is still `gymbro:workout-draft:v1`. Spec: workout-set-validation / Previously stored drafts remain loadable (Pre-change draft restores; Draft storage key is unchanged).
- [x] 1.4 GREEN `src/lib/schemas/workout-set.ts`: add `isWarmup: z.boolean().default(false)` to the single `setSchema` (keep the current `z.coerce` reps/weight rules; PR 2 replaces them). GREEN `src/lib/schemas/workout.ts`: delete the duplicate `setSchema` and add `import { setSchema } from "./workout-set"; export { setSchema };` so `workout.test.ts` and `WorkoutCreationForm.tsx` keep importing from `@/lib/schemas/workout`. `src/lib/workout-draft.ts` stays untouched (it embeds `AddExerciseFormSchema`, so the default applies on load; no version bump).
- [x] 1.5 GREEN `src/components/workout/WorkoutCreationForm.tsx`: `emptySets` (line 49) and the `appendSet({ reps: 0, weight: 0 })` call (line 194) gain `isWarmup: false` so the form values satisfy the new output type. No warmup toggle is added (out of scope).
- [x] 1.6 Verify U1: `pnpm exec vitest run src/lib/schemas/workout-set.test.ts src/lib/schemas/workout.test.ts src/lib/workout-draft.test.ts` green, `pnpm exec tsc --noEmit` green (proves the `WorkoutDraft` output type and form defaults line up), `pnpm lint`, `pnpm run format:check`. Commit `feat(workouts): accept an isWarmup flag on set input`.

### Work unit U2 - server-assigned order, schema, migration, write path (commit 2)

- [ ] 1.7 RED `src/lib/workout-sets.test.ts` (new, table-driven `it.each` where cases differ only by data). `buildSetsForCreate`: single exercise with three sets gives orders `0,1,2`; two exercises give a continuous `0..3` with no repeat; interleaved bench, squat, bench gives `0,1,2` with a repeated `exerciseId`; `isWarmup` passes through; a forged extra `order` on the input is not copied; empty list gives `[]`; two separate calls each restart at `0` (Order restarts per workout). `sortSets`: order wins over reverse-sorted ids; equal order falls to `createdAt`; equal order and `createdAt` fall to `id`; gapped `0,1,3` stays ascending; the input array is not mutated; a repeated call returns the identical sequence (Ties resolve to a stable total order). `groupSetsByExercise`: bench/squat/bench puts both bench sets in one group in stored order with key order equal to first appearance; unsorted input is still sorted inside each group; the array index inside a group is the displayed "Serie N" (Group-relative numbering, single and interleaved). `SET_ORDER_BY` deep-equals `[{ order: "asc" }, { createdAt: "asc" }, { id: "asc" }]`. Spec: workout-set-ordering (Server-assigned per-workout order, Deterministic ordered read-back, gap-tolerant, group-relative). Run `pnpm exec vitest run src/lib/workout-sets.test.ts`: fails because the module does not exist.
- [ ] 1.8 GREEN `src/lib/workout-sets.ts` (new) per the design contract: `SetCreateRow`, `SortableSet`, `buildSetsForCreate` (flatMap exercise-major, then `map((row, order) => ({ ...row, order }))`, reading only `exerciseValue`, `reps`, `weight`, `isWarmup`), non-mutating `sortSets`, `groupSetsByExercise` (sorts first, then groups by `exercise.name`), and `SET_ORDER_BY`. `import type { Prisma }` is type-only and erased at runtime. Re-run the focused test to green. REFACTOR only if a comparator or grouping reads awkwardly; no gratuitous abstraction.
- [ ] 1.9 RED `src/actions/workout/create-workout.test.ts` (new; the `vi.hoisted` mock pattern for `@/auth` and `@/lib/prisma` (`workout.create`) from `src/actions/exercise/create-exercise.test.ts` (read-only)). Cases: unauthorized and `invalid_input` never call `create`; `data.sets.create` deep-equals the expected rows including `order` and `isWarmup`; for the ASCII name "Dia de pierna" dated 2026-01-15 at UTC midnight the persisted tag equals the literal `"dia-de-pierna-workout-2026-01-15T00:00:00.000Z"` (Base tag follows the existing formula); a client-supplied `tagWorkout` value is not persisted (Client-supplied tag is ignored); a client-supplied per-set `order` is ignored; an interleaved payload yields `0,1,2`; the `create` call carries no `startedAt`/`endedAt` (Created workout leaves both boundaries null); two sequential calls each restart at order `0`. Spec: workout-set-ordering (Client-supplied order is ignored, Order restarts per workout, Warmup flag persistence); workout-tag-uniqueness (Base tag is server-derived); workout-session-timestamps (boundaries unwritten). Run `pnpm exec vitest run src/actions/workout/create-workout.test.ts`: fails on the missing `order`/`isWarmup`.
- [ ] 1.10 GREEN `src/actions/workout/create-workout.ts`: replace the inline `setsForRecording` map with `buildSetsForCreate(listExercises)` and pass the result as `sets: { create: sets }`. Keep the inline base-tag formula and the generic `catch` unchanged in this slice (PR 3 owns the tag helper, retry loop and `duplicate_tag`). Focused test green.
- [ ] 1.11 Edit `prisma/schema.prisma` to the design's target state: `Set` gains `order Int` (no default, on purpose), `isWarmup Boolean @default(false)`, `createdAt DateTime @default(now())`, `@@index([workoutId, order])`; `Workout` gains `startedAt DateTime?`, `endedAt DateTime?`, `createdAt DateTime @default(now())`, `updatedAt DateTime @default(now()) @updatedAt`, and `tag` loses `@unique` for `@@unique([userId, tag])`; `Exercise` gains `createdAt`/`updatedAt` with the same defaults. Do NOT run `prisma format` (it would re-align the whole `Exercise` block and add churn).
- [ ] 1.12 Generate the migration with `pnpm exec prisma migrate dev --name workout_data_foundation` against the local Postgres. Prisma warns about the required `Set.order` column without a default and offers to reset a non-empty dev database: accept the reset (settled: no deployed data), then `pnpm seed` if data is needed. Never hand-edit the generated migration SQL (hard rule 6); if it is wrong, fix `schema.prisma` and roll forward. Confirm `pnpm exec prisma generate` ran (or run it).
- [ ] 1.13 Read back the generated SQL in `prisma/migrations/<timestamp>_workout_data_foundation/migration.sql` (read-only) and record the result in the PR notes. Expect: `DROP INDEX "Workout_tag_key"`; `ALTER TABLE` adding `"order" INTEGER NOT NULL`, `"isWarmup" BOOLEAN NOT NULL DEFAULT false` and `"createdAt"` on `Set`; `startedAt`/`endedAt` as nullable `TIMESTAMP(3)` with no `DEFAULT`; `createdAt`/`updatedAt` on `Workout` and `Exercise` as `NOT NULL DEFAULT CURRENT_TIMESTAMP`; `CREATE INDEX "Set_workoutId_order_idx"` (non-unique, no unique index on `(workoutId, order)`); `CREATE UNIQUE INDEX "Workout_userId_tag_key"`. Search the file for the keyword CHECK: zero matches. Spec: workout-tag-uniqueness (Scoped constraint replaces the global one); workout-session-timestamps (Columns accept null, No check constraint is added, Migration applies to existing rows); workout-set-ordering (Duplicate order values are accepted by the data layer).
- [ ] 1.14 Run `pnpm exec prisma validate` and confirm it passes (CI runs only `validate`, never applies migrations, so migration correctness is proven locally and recorded here).
- [ ] 1.15 Existing-rows proof, only if the dev DB state allows it: on a database that holds at least one `Exercise` and one `Workout` row and zero `Set` rows, applying the migration succeeds without a prompt and those rows get non-null `createdAt`/`updatedAt` (inspect with `pnpm exec prisma studio` or the container's `psql`). If the DB holds `Set` rows the reset in 1.12 makes this moot; the SQL read in 1.13 is then the deterministic proof. Record which one was observed.
- [ ] 1.16 Prove the migration is not hand-edited and is the only one: run `pnpm exec prisma migrate dev --create-only` and confirm it reports the schema and migrations already in sync and creates no new folder (delete any folder it creates and investigate the drift). Confirm exactly one new folder under `prisma/migrations` (read-only) compared with the tracker branch, and that `git status` shows it unmodified after generation.
- [ ] 1.17 GREEN `src/interfaces/actions/workout.interfaces.ts`: `DataItem` gains `order: number`, `isWarmup: boolean`, `createdAt: Date` (the Prisma row satisfies it after generate; the detail-sets component is deliberately untouched and needs no change).
- [ ] 1.18 Manual smoke (real Postgres; not automatable here): start `pnpm dev` on the worktree's dev port, create a workout with two exercises and several sets, then inspect the rows: `Set.order` is `0..n-1` in entered sequence, `isWarmup` false, `createdAt` populated; `Workout.startedAt`/`endedAt` null with `createdAt`/`updatedAt` populated; toggling or editing an `Exercise` advances its `updatedAt` while `createdAt` stays (Update advances the last-update timestamp); via `psql`, two `Workout` rows with the same `tag` and different `userId` both insert, while the same `userId` and `tag` fails with a duplicate-key error on `"Workout_userId_tag_key"` (Cross-user collision allowed, Same-owner duplicate violates the constraint). Open the workout detail and confirm "Serie N" still counts inside each exercise group.
- [ ] 1.19 Slice 1 gate, all green: `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, `pnpm exec prisma validate`. Then measure authored lines with `git diff --stat` against the tracker excluding `migration.sql`. If the measured count exceeds 400, do not delete blank lines, comments or tests: stop and return to the orchestrator (see Risks, the pre-cut option to move the sort/group helpers and their tests to PR 2).
- [ ] 1.20 Commit U2 as `feat(workouts): persist server-assigned set order and warmup flag` with `prisma/schema.prisma` and the migration folder in the same commit as the write path. Open PR 1 (base: tracker branch) only on the user's go-ahead, with Chain Context (dependency diagram marking PR 1 with the current-PR marker), the one-time developer reset note (`pnpm exec prisma migrate reset` then `pnpm seed`), and the interim-behavior note (after this PR the tag constraint is per-user but a same-owner collision still surfaces as the generic `error` until PR 3).

## Phase 2: Slice 2a - Validation hardening, reads, UI (PR 2, base: PR 1 branch)

Create `feat/workout-data-foundation-s2a-validation-reads-ui` from the PR 1 branch. Schema and read
actions have no ordering dependency between them; the two commits are independent.

### Work unit U3 - bodyweight sets and no set cap (commit 3)

- [ ] 2.1 RED `src/lib/schemas/workout-set.test.ts`, weight table asserting the message `"El peso debe ser un número igual o mayor a 0"`: accepted `0`, `42.5`, `"20"` (parses to `20`); rejected `""`, `"  "`, `null`, `undefined`/missing, `-1`, `Infinity`, `NaN`, `"abc"`, `[]`, `true`. Reps table: accepted `1`, `"12"` (parses to `12`); rejected `0` and `-3` and `""` and `null` with `"Debes agregar tus repeticiones"`, `1.5` with `"Las repeticiones deben ser un número entero"`. The message never contains an instruction to add weight or "mayor a cero". Rewrite the existing weight-below-minimum case: weight `0` is now valid, assert `-1` fails. Add: `setSchema.shape.weight.optional()` accepts `undefined` (the `updateSet` omit path stays intact) but still rejects `null`. Spec: workout-set-validation (Weight accepts zero and rejects absent or non-finite input, Repetitions must be a whole number of at least one, Weight guidance reflects the actual rule, Missing weight, Blank/Null weight not coerced to zero). Confirm RED for the right reasons (blank and `null` currently coerce to `0`).
- [ ] 2.2 GREEN `src/lib/schemas/workout-set.ts`: the private `parseNumericInput` preprocess (strings trimmed; blank string becomes `undefined`; other strings become `Number(value)`; everything else, including `null`, booleans and arrays, passes through untouched); weight `z.number(...).finite().min(0)`; reps `z.number(...).int().min(1)`; the three Spanish messages as named constants. Focused test green. Do not revert to `z.coerce`.
- [ ] 2.3 RED `src/lib/schemas/workout.test.ts`: `setsSchema` accepts 6 and 20 sets and still rejects `[]` with `"Debes agregar al menos un set"`; `AddWorkoutFormSchema` still rejects an empty `listExercises`; accepts one exercise with one valid set; delete the `"Tómalo con calma!!"` case and the set-rule cases now covered once by the identity assertion from task 1.2. Spec: workout-set-validation (No upper bound on sets per exercise, At least one exercise per workout, Both entry points enforce identical rules).
- [ ] 2.4 GREEN `src/lib/schemas/workout.ts`: remove `.max(5, { message: "Tómalo con calma!!" })` from `setsSchema`; keep `.min(1, "Debes agregar al menos un set")`. No technical upper bound (settled).
- [ ] 2.5 Resolve the open `tsc` question from the design: `pnpm exec tsc --noEmit`. `z.preprocess` changes `z.input` for reps/weight to `unknown`; `zodResolver` is generic over the form type and `useForm<FormValues>` uses the output type, so it should compile unchanged. If it errors in `src/components/workout/WorkoutCreationForm.tsx`, type the form with `z.input`/`z.output` generics; never fall back to `z.coerce`. Also confirm the validators built from `setSchema.shape.weight`/`.shape.reps` in the form (lines 52, 57), `src/components/workout/WorkoutDetailSets.tsx` (read-only) and `src/actions/workout/update-set.ts` (read-only) still compile.
- [ ] 2.6 GREEN `src/components/workout/WorkoutCreationForm.tsx`: remove `disabled={setFields.length >= 5}` from the add-set button (line 193). No DOM tests exist, so this is verified in 2.10 plus `tsc`/`lint`/`build`. Spec: workout-creation-form / No set cap in the authoring surface.
- [ ] 2.7 Verify U3: `pnpm exec vitest run src/lib/schemas` green, `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`. Commit `feat(workouts): accept bodyweight sets and remove the set cap`.

### Work unit U4 - ordered reads (commit 4)

- [ ] 2.8 RED `src/actions/workout/get-workouts.test.ts` (new; mocked `@/lib/prisma`): `findMany` receives `where: { userId }`, `orderBy` equal to `[{ date: dir }, { createdAt: dir }]` with `date` as the primary key (Sorting is unchanged by the new timestamps) and the caller's direction on both, and `include.sets.orderBy` deep-equal to `SET_ORDER_BY`; rows returned out of order come back grouped by exercise name and sorted; the same behavior for the detail read is asserted in 2.9; a thrown error returns `[]`. RED `src/actions/workout/get-workout-by-slug.test.ts` (new): `findUnique` receives `where: { userId_tag: { userId, tag: slug } }` and the same `sets.orderBy`; out-of-order rows return grouped and sorted; a missing workout returns `null`; a thrown error returns `null`; two different callers produce two different composite keys (Each owner resolves their own workout; a foreign tag resolves to `null` when the mock returns `null`). Spec: workout-set-ordering (Detail read, List read, Ordering is independent of id, Ties); workout-tag-uniqueness (Tag lookup is owner-scoped); workout-session-timestamps (Workout.date is the authoritative performance date). Confirm both files fail.
- [ ] 2.9 GREEN `src/actions/workout/get-workouts.ts`: `include.sets.orderBy: SET_ORDER_BY`, `groupSetsByExercise(workout.sets)` replacing the `reduce`, drop the `WorkoutWithSets` type and the now-unused imports, `orderBy: [{ date }, { createdAt }]`. GREEN `src/actions/workout/get-workout-by-slug.ts`: `findUnique` on `userId_tag`, `orderBy: SET_ORDER_BY` replacing `{ id: "asc" }`, `groupSetsByExercise`. Preserve the current return shapes (`WorkoutToDisplay`/`WorkoutDetail`, `[]`/`null` on error). Both focused tests green. If PR 2 must shrink, the `createdAt` workout tie-break and its assertion are the first thing to drop (design guidance); do not delete comments or blank lines to save lines.
- [ ] 2.10 Manual smoke (real app; no DOM tests exist): create a workout with two exercises where one exercise has six or more sets and one set has weight `0`; the add-set button stays enabled past five and at ten sets and submit succeeds (No set cap, Zero weight submits); leaving a weight blank blocks submission and never saves `0` (Blank weight blocks submission); the invalid-weight message does not say to add weight. Open `/workouts` and `/workouts/[slug]` and confirm the sets appear in the entered order with "Serie N" counted per exercise group. Spec: workout-creation-form (No set cap, Bodyweight sets are accepted); workout-set-ordering (Displayed set number is group-relative).
- [ ] 2.11 Slice 2a gate, all green: `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`. Measure authored lines against the PR 1 branch. Commit U4 as `fix(workouts): read sets in stored order`. Open PR 2 (base: PR 1 branch, current-PR marker in the diagram) only on the user's go-ahead.

## Phase 3: Slice 2b - Tag collision retry (PR 3, base: PR 2 branch)

Create `feat/workout-data-foundation-s2b-tag-collision` from the PR 2 branch. Neither PR 2 nor this slice
changes anything the other needs, but the chain order is fixed: PR 2's form edit (line 193) and this
slice's form message edit (lines around 305) touch different lines.

- [ ] 3.1 Manual smoke before writing the matcher (the design's open question on the P2002 `meta.target` shape). At the start of this branch `createWorkout` is still the Slice 1 version (its generic `catch` calls `console.error(error)`), so with the dev server running create the same-name workout twice on the same date and read the dev-server log: record `code`, `meta.modelName` and the exact `meta.target` (expected `["userId","tag"]`; the precedent also handles the constraint-name string `"Workout_userId_tag_key"`). Write the observed shape into the PR notes. If it differs from both shapes, only `isWorkoutTagCollision` in task 3.3 changes; re-open the design question with the orchestrator rather than guessing.
- [ ] 3.2 RED `src/lib/workout-tag.test.ts` (new; pattern lifted from `src/lib/exercises.test.ts` (read-only)). `buildWorkoutTag` reproduces `"dia-de-pierna-workout-2026-01-15T00:00:00.000Z"` for an ASCII name and converts every whitespace character. `nextTagCandidate`: attempt `1` gives the base, `2` gives `base-2`, `10` gives `base-10`, and attempt `0` gives the base. `isWorkoutTagCollision` is true for `{ code: "P2002", meta: { target: ["userId","tag"] } }`, the reversed array, and the string `"Workout_userId_tag_key"`; false for `["id"]`, `["name"]`, `["userId","canonicalName"]`, a missing `meta`, code `P2025`, `null`, and a plain object. Spec: workout-tag-uniqueness (Base tag follows the existing formula, Only the owner-scoped tag constraint is retried, suffix sequence). Run: fails because the module does not exist.
- [ ] 3.3 GREEN `src/lib/workout-tag.ts` (new) per the design: `MAX_TAG_ATTEMPTS = 10`, `WORKOUT_TAG_CONSTRAINT_KEY`, `buildWorkoutTag` (byte-identical to the current formula), `nextTagCandidate`, and `isWorkoutTagCollision` matching only P2002 with an array `meta.target` of length 2 containing `userId` and `tag` in either order, or the exact constraint-name string. Constants live in `src/lib`, not in the `"use server"` file (Next.js only permits async-function exports there). Focused test green.
- [ ] 3.4 Pin the react-day-picker local-midnight assumption (proposal Risk 3; the dependency is react-day-picker `^9` in `package.json` (read-only), and `node_modules` was not installed at planning time, so this is documented library behavior, not yet read from source). After `pnpm install`, first confirm what the installed v9 exports; then add an assertion in `src/lib/workout-tag.test.ts` that the day-normalization primitive the calendar relies on returns local midnight (hours, minutes, seconds and milliseconds all `0` in local time) so that `buildWorkoutTag` is a pure function of (name, calendar day). Vitest is `node` with no DOM, so this pins the library primitive, not what `onSelect` emits from a real click. If the installed version exposes no usable primitive or the import does not run under Vitest `node`, return that to the orchestrator instead of inventing a stand-in; the design remains correct either way (this only changes collision frequency). See the open item in the Risks section.
- [ ] 3.5 RED `src/actions/workout/create-workout.test.ts` (extend the file from task 1.9). Retry cases with the mocked `prisma.workout.create`: no collision calls `create` exactly once and issues no prior lookup (the mock exposes no `findFirst`/`findUnique`, so any lookup throws; No pre-check query is issued); a P2002 with array target then success makes the second call's tag end with `-2`, returns `ok`, and leaves `name` exactly as typed (First same-owner collision resolves with `-2`, The workout name is never modified); two collisions give `-3`; a constraint-name-string target also retries; ten consecutive collisions return `{ ok: false, code: "duplicate_tag" }` with exactly 10 `create` calls (Bound exhaustion, Attempts are bounded); an unrelated P2002 (`["id"]`) and a plain `Error` both return `{ ok: false, code: "error" }` after one call with no retry (Unrelated uniqueness violation is not swallowed, Generic database error maps to error); every attempt receives the identical `sets` array. Confirm RED.
- [ ] 3.6 GREEN `src/actions/workout/create-workout.ts`: `CreateWorkoutResult` failure codes gain `"duplicate_tag"`; derive `baseTag = buildWorkoutTag(nameWorkout, dateWorkout)` and `sets = buildSetsForCreate(listExercises)` once; loop `attempt = 1..MAX_TAG_ATTEMPTS`, `create` with `nextTagCandidate(baseTag, attempt)`, swallow only `isWorkoutTagCollision(error)` (rethrow everything else to the existing outer `catch` that logs and returns `error`); return `{ ok: false, code: "duplicate_tag" }` after the bound. The loop stays inline in the action (one call site, no generic retry abstraction). Focused test green.
- [ ] 3.7 GREEN `src/components/workout/WorkoutCreationForm.tsx`: add the `duplicate_tag` entry to the `messages: Record<typeof result.code, string>` map (line 305), copy `"Ya tienes varios entrenamientos con ese nombre en esa fecha. Cambia el nombre o la fecha e inténtalo de nuevo."`; the `Record` type makes this a compile error until it is mapped. Spec: workout-creation-form / The form handles every creation failure code.
- [ ] 3.8 Verify U5: `pnpm exec vitest run src/lib/workout-tag.test.ts src/actions/workout/create-workout.test.ts` green, then `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check`.
- [ ] 3.9 Manual smoke after the loop lands (real Postgres): create the same-name workout twice on one date, then a third time; the saves succeed with `-2` and `-3` tags, each opens at its own `/workouts/[slug]`, the names displayed are exactly what was typed, and the `Set` row count equals the sum of the submitted sets (no orphan or duplicate rows from a rolled-back attempt; Each retry starts from a clean state); a second user's same-name/same-date save also succeeds (Cross-user collision is allowed). Check the dev-server log for no new errors. Record the result.
- [ ] 3.10 Slice 2b gate, all green: `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, `pnpm exec prisma validate`. Measure authored lines against the PR 2 branch. Commit U5 as `feat(workouts): resolve same-day tag collisions with a bounded suffix retry`. Open PR 3 (base: PR 2 branch, current-PR marker in the diagram) only on the user's go-ahead.

## Phase 4: Chain close-out

- [ ] 4.1 Spec-coverage sweep (read-only searches on the tracker head, results recorded in the tracker PR notes): `startedAt`/`endedAt` are never read or written anywhere under `src/` (read-only) (only in the generated Prisma types); no consumer uses `Set.createdAt` or `Workout.createdAt` as a display or performance date; `src/components/workout/WorkoutDetailSets.tsx` (read-only), `src/lib/workout-draft.ts` (read-only) and the dashboard and workout-list series-count surfaces show no diff versus `master` (Series counts are unaffected, No surface reads the boundaries, Stored tag is never recomputed); the draft storage key constant is still `gymbro:workout-draft:v1`.
- [ ] 4.2 Tracker PR: confirm every child diff is clean (only its own work unit appears); keep the tracker draft/no-merge until PR 1, PR 2 and PR 3 are reviewed and integrated into it; only then does the tracker merge to `master`. Confirm rollback notes in the PR 1 body match the design (code and schema roll back together; a forward `revert_workout_data_foundation` migration after merge).
- [ ] 4.3 Sync Notion F0.1 `Status` to `Listo` after the tracker merges. Record the follow-ups the design left open, as Notion `Tipo: Housekeeping` items only if the user wants them: unify `isCanonicalUniquenessViolation` and `isWorkoutTagCollision` into one `isUniqueViolationOn`; F0.2 must keep the tag immutable and route by `id`; `updateSet` does not bump `Workout.updatedAt`.

## Spec Coverage Matrix

| Capability / Requirement | Task(s) |
|--------------------------|---------|
| workout-set-ordering / Server-assigned per-workout set order | 1.7, 1.8, 1.9, 1.10, 1.18 |
| workout-set-ordering / Set insertion timestamp | 1.11, 1.13, 1.18 |
| workout-set-ordering / Deterministic ordered read-back | 1.7, 1.8, 2.8, 2.9, 2.10 |
| workout-set-ordering / Order values are non-unique and gap-tolerant | 1.7, 1.13 |
| workout-set-ordering / Warmup flag persistence | 1.1, 1.9, 1.10 |
| workout-set-ordering / Displayed set number is group-relative | 1.7, 2.10, 4.1 |
| workout-set-validation / Single shared set schema | 1.2, 1.4, 2.3, 2.5 |
| workout-set-validation / Weight accepts zero and rejects absent or non-finite input | 2.1, 2.2, 2.10 |
| workout-set-validation / Repetitions must be a whole number of at least one | 2.1, 2.2 |
| workout-set-validation / No upper bound on sets per exercise | 2.3, 2.4, 2.10 |
| workout-set-validation / At least one exercise per workout | 2.3 |
| workout-set-validation / Warmup flag defaults to false | 1.1, 1.4 |
| workout-set-validation / Previously stored drafts remain loadable | 1.3, 1.4, 4.1 |
| workout-set-validation / Weight guidance reflects the actual rule | 2.1, 2.2, 2.10 |
| workout-tag-uniqueness / Owner-scoped tag uniqueness constraint | 1.11, 1.13, 1.14, 1.18 |
| workout-tag-uniqueness / Base tag is server-derived and immutable | 1.9, 3.2, 4.1 |
| workout-tag-uniqueness / Same-owner collisions resolve without refusing the save | 3.2, 3.3, 3.5, 3.6, 3.9 |
| workout-tag-uniqueness / Only the owner-scoped tag constraint is retried | 3.1, 3.2, 3.3, 3.5, 3.6 |
| workout-tag-uniqueness / Exhausting the retry bound returns a specific failure code | 3.5, 3.6, 3.7 |
| workout-tag-uniqueness / Tag lookup is owner-scoped | 2.8, 2.9 |
| workout-session-timestamps / Session boundary columns exist, nullable and unwritten | 1.9, 1.11, 1.13, 1.18, 4.1 |
| workout-session-timestamps / Record timestamps on workouts and exercises | 1.11, 1.13, 1.15, 1.18 |
| workout-session-timestamps / Workout.date is the authoritative performance date | 2.8, 2.9, 4.1 |
| workout-session-timestamps / No session boundary ordering constraint | 1.13 |
| workout-session-timestamps / Exactly one generated migration | 1.12, 1.16 |
| workout-creation-form / Single validated submission (isWarmup, no order, no cap) | 1.1, 1.5, 1.9, 2.4 |
| workout-creation-form / No set cap in the authoring surface | 2.6, 2.10 |
| workout-creation-form / Bodyweight sets are accepted by the form | 2.1, 2.2, 2.10 |
| workout-creation-form / The form handles every creation failure code | 3.6, 3.7 |

## Risks and open items returned to the orchestrator

- Slice 1 margin is about 5% (estimate ~382, plus or minus 20% could reach ~458). Task 1.19 measures it. The design's only pre-cut option is to move `sortSets`, `groupSetsByExercise`, `SET_ORDER_BY` and their tests (roughly 100 lines) from PR 1 to PR 2 (PR 1 about 280, PR 2 about 350); that reshapes the approved plan and needs the user's confirmation, so it is not pre-applied.
- Genuine gap, date-picker pin (task 3.4): the design asks for an assertion but does not name a mechanism. With no DOM test infrastructure, the achievable Vitest assertion covers the react-day-picker date primitive, not `onSelect` output from a click, and whether v9 exports a usable primitive could not be verified without `node_modules`. Open: accept a library-primitive assertion, or additionally require a one-time manual browser check.
- Genuine gap, `duplicate_tag` end to end (task 3.7): reaching it needs ten same-name saves on one date. Currently verified by the exhaustive `Record` type plus the mocked-action test. Open: whether an eleven-save manual run is also required.
- Genuine gap, existing-rows migration proof (task 1.15): a live confirmation only exists when the dev DB holds Workout/Exercise rows and no Set rows; otherwise the generated SQL read is the sole proof.
- Not tasked (not in the design's File Changes table): a note in `.claude/rules/database.md` about writing `"order"` in hand-written SQL and the one-time dev DB reset. Add it to U2 only if the user wants it; it also counts against the thin Slice 1 margin.
- Assumptions to confirm: the tracker branch is this worktree's `luhpaco/feat-workout-data-foundation`; the SDD artifacts are committed on the tracker (task 0.2); the three child branch names above.
- Dependencies that could bottleneck: U2 is the critical, non-splittable unit (migration, generated client, write path); every later task needs the regenerated Prisma client. Local Postgres must be up for 1.12 onward, and `node_modules` must be installed before 3.4.
- `Decision needed before apply: No` deviates from the literal `ask-on-risk => Yes` table value because the decision is already resolved (see the Forecast).

## Parallelism

Everything is sequential across phases (chain order fixed by `feature-branch-chain`; PR 2 needs PR 1's
generated client, PR 3 builds on PR 2). Inside a phase: U3 (tasks 2.1-2.7) and U4 (tasks 2.8-2.9) are
independent and could be worked in either order, but they share one branch and one apply session. Inside
U2, tasks 1.7-1.8 (helpers) and 1.9-1.10 (action) are RED/GREEN pairs that depend on each other only at
`buildSetsForCreate`; 1.11 onward is strictly sequential (schema, migrate, read back, generate, then types).
