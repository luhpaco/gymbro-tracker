# Tasks: Atomic Per-User Exercise Tag Uniqueness

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~120–160 (schema +1, migration SQL ~3, action ~20, tests ~60, generated client excluded) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Schema + migration + action mapping + mocked tests | PR 1 | `pnpm test -- --run src/actions/exercise/create-exercise.test.ts` | N/A — Stage 1 Vitest mocked tests; true-concurrency not reproducible under Stage 1 harness, constraint itself is the proof | `prisma/schema.prisma`, `prisma/migrations/*_exercise_user_tag_unique/`, `src/actions/exercise/create-exercise.ts`, `src/actions/exercise/create-exercise.test.ts` — all revertable together; rollback migration = new `DROP INDEX` via `prisma migrate dev` |

## Phase 1: Pre-migration Data Check

- [x] 1.1 Run duplicate-row query against local DB: `SELECT "userId", tag, COUNT(*) FROM "Exercise" GROUP BY "userId", tag HAVING COUNT(*) > 1;` — STOP and report if any rows returned; do not proceed to Phase 2 until data is clean. (spec: `exercise-tag-uniqueness` → "Constraint declared and migrated")

## Phase 2: Schema Migration

- [x] 2.1 Add `@@unique([userId, tag])` to `model Exercise` in `prisma/schema.prisma` (keep existing `name @unique` unchanged).
- [x] 2.2 Run `pnpm exec prisma validate` — confirm zero errors.
- [x] 2.3 Run `pnpm exec prisma migrate dev --name exercise_user_tag_unique` — confirm migration applies cleanly and generates `CREATE UNIQUE INDEX "Exercise_userId_tag_key"` in the migration SQL.
- [x] 2.4 Verify the generated migration file `prisma/migrations/<timestamp>_exercise_user_tag_unique/migration.sql` contains the exact index name `Exercise_userId_tag_key` on `("userId", "tag")`. (spec: "Constraint declared and migrated")

## Phase 3: Mapping + Tests (RED → GREEN)

- [x] 3.1 **RED** — In `src/actions/exercise/create-exercise.test.ts`, add test: "returns duplicate_tag when create throws P2002 with composite array target `['userId','tag']`" — mock `create` to reject with P2002 error carrying `meta: { target: ["userId", "tag"] }`; expect `{ ok: false, code: "duplicate_tag" }`. (spec: "Array target maps to duplicate_tag")
- [x] 3.2 **RED** — Add test: "returns duplicate_tag when create throws P2002 with constraint-name string target `'Exercise_userId_tag_key'`" — mock `create` to reject with P2002 error carrying `meta: { target: "Exercise_userId_tag_key" }`; expect `{ ok: false, code: "duplicate_tag" }`. (spec: "Constraint-name target maps to duplicate_tag")
- [x] 3.3 Run `pnpm test -- --run src/actions/exercise/create-exercise.test.ts` — confirm both new tests FAIL (RED) and the existing name-P2002 → `error` test still PASSES.
- [x] 3.4 **GREEN** — In `src/actions/exercise/create-exercise.ts`, add a module-private helper `isCompositeTagViolation(err: unknown): boolean` that returns `true` when `err.code === "P2002"` and `err.meta.target` is either: (a) an array containing exactly `userId` + `tag` (order-insensitive), or (b) the string `"Exercise_userId_tag_key"`. Defaults to `false` for any other shape.
- [x] 3.5 **GREEN** — Reorder the catch-all in `createExercise`: change `catch { return { ok: false, code: "error" } }` to `catch (err) { if (isCompositeTagViolation(err)) return { ok: false, code: "duplicate_tag" }; return { ok: false, code: "error" }; }`. (spec: "Other target maps to error" — existing name-P2002 test must keep passing)
- [x] 3.6 Run `pnpm test -- --run src/actions/exercise/create-exercise.test.ts` — confirm ALL tests PASS (GREEN), including: the 2 new composite-target tests, the pre-existing name-P2002 → `error` regression test, the fast-path short-circuit test, and the no-collision create test.

## Phase 4: Final Gates

- [x] 4.1 Run `pnpm test` — all suites green.
- [x] 4.2 Run `pnpm exec tsc --noEmit` — zero type errors.
- [x] 4.3 Run `pnpm lint` — zero lint errors.
- [x] 4.4 Run `pnpm run format:check` — formatting clean.
- [x] 4.5 Run `pnpm exec prisma validate` — schema valid.
- [x] 4.6 Run `pnpm build` — production build succeeds (CI gate).
