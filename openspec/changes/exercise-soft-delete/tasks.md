# Tasks: Exercise Soft-Delete

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~305 (schema +1, migration generated, schema zod ~10, schema test ~40, action ~60, action test ~150, read filters +2, UI ~40, fixture +1) |
| 400-line budget risk | Medium |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Medium

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + Zod + toggle action + tests | PR 1 | `pnpm test src/lib/schemas/exercise.test.ts src/actions/exercise/set-exercise-active-state.test.ts` | Mocked action tests (mirror `create-exercise.test.ts` pattern) | Revert `schema.prisma`, drop migration folder, delete action + test files |
| 2 | Read filters + UI + fixture | PR 2 | `pnpm test src/store/exercises/exercises-store.test.ts` | Manual smoke: deactivate card → refresh → gone | Revert `where` clauses, remove button, revert fixture |

## Phase 1: Migration + Schema Flag

- [x] 1.1 Edit `prisma/schema.prisma`: add `isActive Boolean @default(true)` to `Exercise` model
- [x] 1.2 Run `pnpm exec prisma migrate dev --name exercise_is_active` (requires local PostgreSQL via `podman compose up -d`)
- [x] 1.3 Verify migration output: `ALTER TABLE "Exercise" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true`
- [x] 1.4 Run `pnpm exec prisma validate` and `pnpm exec prisma generate`
- [x] 1.5 Verify existing rows read back `isActive: true` (inspect DB or write quick script)

**Spec scenarios**: Pre-existing rows stay active, New exercises default to active

## Phase 2: Shared Schema + Tests (RED→GREEN)

- [x] 2.1 **RED**: In `src/lib/schemas/exercise.test.ts`, add test cases: accept `{id: "1", isActive: true}`, accept `{id: "1", isActive: false}`, reject empty `id`, reject non-boolean `isActive`, reject missing fields
- [x] 2.2 Run `pnpm test src/lib/schemas/exercise.test.ts` — confirm FAIL
- [x] 2.3 **GREEN**: In `src/lib/schemas/exercise.ts`, export `exerciseActiveStateSchema = z.object({ id: z.string().min(1), isActive: z.boolean() })` and inferred `ExerciseActiveStateInput`
- [x] 2.4 Run `pnpm test src/lib/schemas/exercise.test.ts` — confirm PASS

**Spec scenarios**: Invalid input rejects without DB write (schema-level validation)

## Phase 3: Toggle Action + Mock Tests (RED→GREEN)

- [x] 3.1 **RED**: Create `src/actions/exercise/set-exercise-active-state.test.ts` with mock tests mirroring `create-exercise.test.ts` pattern (mock `@/auth`, `@/lib/prisma`, `next/cache`): unauthorized (no session → no Prisma calls), invalid_input (zero Prisma calls), not_found (row missing or wrong owner), error (update throws), success with `revalidatePath` called
- [x] 3.2 Run `pnpm test src/actions/exercise/set-exercise-active-state.test.ts` — confirm FAIL
- [x] 3.3 **GREEN**: Create `src/actions/exercise/set-exercise-active-state.ts`: auth → `safeParse` → `findFirst({ id, userId })` → null maps to `not_found` → `update({ isActive })` → `revalidatePath("/exercises")` → return `{ ok: true, exercise }` or `{ ok: false, code }` where code is `unauthorized | invalid_input | not_found | error`
- [x] 3.4 Run `pnpm test src/actions/exercise/set-exercise-active-state.test.ts` — confirm PASS

**Spec scenarios**: Deactivation succeeds, Reactivation succeeds, Unauthorized rejects without DB access, Invalid input rejects without DB write, Not found or not owned, Error catch-all

## Phase 4: Read-Path Filters

- [x] 4.1 In `src/actions/exercise/get-exercises.ts`, add `isActive: true` to the `where` clause (alongside `userId`)
- [x] 4.2 In `src/actions/exercise/get-exercises-summary.ts`, add `isActive: true` to the `where` clause
- [x] 4.3 Run `pnpm exec tsc --noEmit` — confirm no type errors

**Spec scenarios**: Inactive exercises excluded from /exercises, Inactive exercises excluded from the summary, Inactive exercises not selectable for workouts

## Phase 5: Deactivate UI + Store Fixture

- [x] 5.1 In `src/store/exercises/exercises-store.test.ts`, update `makeExercise` fixture to include `isActive: true`
- [x] 5.2 In `src/app/(routes)/exercises/components/ExerciseSection.tsx`, add destructive `<Button>` per card that calls `setExerciseActiveState({ id, isActive: false })`; on `ok: true` call `router.refresh()`, on `ok: false` show destructive toast (Spanish messages matching existing form toasts)
- [x] 5.3 Run `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm run format:check` — confirm all pass

**Spec scenarios**: Success removes the card, Failure keeps the card and shows a toast

## Phase 6: Final Gates

- [x] 6.1 Run `pnpm test` — confirm all tests pass
- [x] 6.2 Run `pnpm exec tsc --noEmit` — confirm no type errors
- [x] 6.3 Run `pnpm lint` — confirm no lint errors
- [x] 6.4 Run `pnpm run format:check` — confirm formatting
- [x] 6.5 Run `pnpm exec prisma validate` — confirm schema valid
- [x] 6.6 Run `pnpm build` — confirm production build succeeds

**Spec scenarios**: All scenarios verified via unit tests, type safety, and build gates
