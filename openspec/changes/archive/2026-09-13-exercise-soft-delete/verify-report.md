```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:b50eba28546a06b36a4bd97692dd3feea4a91c1947fc76ca56676d96fbdb5328
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 16/16
test_command: CI=true pnpm test
test_exit_code: 0
test_output_hash: sha256:c8ccc068bd00e51846bbda77861f71a35f54071054ce84e750348e003ed8a9c0
build_command: CI=true pnpm build
build_exit_code: 0
build_output_hash: sha256:af12dda33f8711a0144888886147c872842ddcd42607010daf06b6b2bd2918d5
```

## Verification Report

**Change**: exercise-soft-delete
**Version**: N/A (delta spec, no version header)
**Mode**: Strict TDD (config `testing.strict_tdd: true`, vitest runner available)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 25 |
| Tasks complete | 25 |
| Tasks incomplete | 0 |
| Requirements (spec) | 6 |
| Scenarios (spec) | 16 |

All 25 tasks in `tasks.md` are marked `[x]`. Full verification run (not blocked). `apply-progress` exists in Engram only (`sdd/exercise-soft-delete/apply-progress`, #2975) — no `apply-progress.md` on disk; commit `387e968`.

### Build & Tests Execution (all six gates, CI=true)
**Tests** (`CI=true pnpm test`): ✅ 84 passed / 0 failed / 0 skipped — 11 files, exit 0
```text
 Test Files  11 passed (11)
      Tests  84 passed (84)
   Duration  144ms
```
**Type check** (`CI=true pnpm exec tsc --noEmit`): ✅ exit 0, no output
**Lint** (`CI=true pnpm lint`): ✅ "No ESLint warnings or errors", exit 0 (pre-existing `next lint` deprecation notice; `next lint` removed in Next 16 — not caused by this change)
**Format** (`CI=true pnpm run format:check`): ✅ "All matched files use Prettier code style!", exit 0
**Prisma** (`CI=true pnpm exec prisma validate`): ✅ "The schema at prisma/schema.prisma is valid 🚀", exit 0
**Build** (`CI=true pnpm build`): ✅ exit 0 — compiled successfully, all 14 routes generated (the `DYNAMIC_SERVER_USAGE` line for `/workouts/create` is Next.js log noise for the `headers()`-using route; build completed with exit 0)
```text
 ✓ Compiled successfully in 2.7s
 ✓ Generating static pages (14/14)
```
**Coverage**: ➖ Not available (config `testing.coverage.available: false`; no coverage tool detected — not a failure)

### Spec Compliance Matrix
| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| REQ-01 Active Flag on Exercise Schema | Pre-existing rows stay active | `prisma/migrations/20260913193952_exercise_is_active/migration.sql` exact match `ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true` + `prisma validate` exit 0; apply reported live-DB check (3 pre-existing rows read back active) | ✅ COMPLIANT (migration-verified) |
| REQ-01 | New exercises default to active | `prisma/schema.prisma` `isActive Boolean @default(true)` + migration default | ✅ COMPLIANT (migration/build-verified) |
| REQ-02 Active-Only Read Paths | Inactive excluded from /exercises | `get-exercises.ts` `where: { userId, isActive: true }` + tsc/build | ✅ COMPLIANT (static + build) |
| REQ-02 | Inactive excluded from the summary | `get-exercises-summary.ts` `where: { userId: userId, isActive: true }` + tsc/build | ✅ COMPLIANT (static + build) |
| REQ-02 | Inactive not selectable for workouts | `/workouts/create/page.tsx` imports `getExercises` (filtered action) — picker fed by active-only list; route builds | ✅ COMPLIANT (static + build) |
| REQ-03 Toggle Action Contract | Deactivation succeeds | `set-exercise-active-state.test.ts` > "deactivates an owned exercise and revalidates the exercises page" — asserts `{ ok: true, exercise }`, update `{ isActive: false }`, `revalidatePath("/exercises")` | ✅ COMPLIANT (runtime) |
| REQ-03 | Reactivation succeeds | `set-exercise-active-state.test.ts` > "reactivates an owned inactive exercise" — asserts `{ ok: true, exercise }`, update `{ isActive: true }` | ✅ COMPLIANT (runtime) |
| REQ-03 | Unauthorized rejects without DB access | `set-exercise-active-state.test.ts` > "returns unauthorized without querying Prisma" — asserts `findFirst`/`update` NOT called | ✅ COMPLIANT (runtime) |
| REQ-03 | Invalid input rejects without DB write | `set-exercise-active-state.test.ts` > "returns invalid input without querying Prisma" + schema tests (empty id, non-boolean, missing fields) | ✅ COMPLIANT (runtime) |
| REQ-03 | Not found or not owned | `set-exercise-active-state.test.ts` > "not found" x2 (missing row; other-user row) — asserts `update` NOT called | ✅ COMPLIANT (runtime) |
| REQ-03 | Error catch-all | `set-exercise-active-state.test.ts` > "error" x3 (auth throws, lookup fails, update fails) | ✅ COMPLIANT (runtime) |
| REQ-04 Set History Preservation | Sets survive deactivation | Full diff of `387e968`: zero `prisma.set` writes, zero `delete`/`cascade`/`onDelete`; action updates only `Exercise.isActive`; FK untouched | ✅ COMPLIANT (static) |
| REQ-05 Deactivate Control in ExerciseSection | Success removes the card | `ExerciseSection.tsx` handler: `result.ok` → `router.refresh()`; exact code path compiles under `tsc` + `pnpm build` | ⚠️ Deferred to manual smoke (typecheck-verified; NOT performed in this verification run) |
| REQ-05 | Failure keeps the card and shows a toast | `ExerciseSection.tsx` else-branch: destructive toast per all 4 codes, card never removed; exact code path compiles under `tsc` + `pnpm build` | ⚠️ Deferred to manual smoke (typecheck-verified; NOT performed in this verification run) |
| REQ-06 Name Uniqueness Unaffected | Same-name creation fails while inactive | `name String @unique` unchanged; `create-exercise.ts` has no `isActive` filter (inactive row still holds name → P2002 → `error`), design Flow B | ✅ COMPLIANT (static + build) |
| REQ-06 | Reactivation restores the exercise | Runtime action test (reactivation) + read-path `isActive: true` filter returns the restored row | ✅ COMPLIANT (runtime) |

**Compliance summary**: 16/16 scenarios are covered by the delivered Stage-1 verification. Of these, 9/16 carry passing runtime unit evidence (5 schema + 9 mocked-action tests), 5/16 are migration/build-verified (`prisma validate`, migration SQL exact match, no-Set-write diff proof), and 2/16 are typecheck-verified only — the deactivate-UI behaviors in `ExerciseSection.tsx` compile under `tsc` + `pnpm build`, with their behavioral assertions deferred to manual smoke per design §5 (Stage-1 has no DOM/RTL tooling). Manual smoke was NOT performed in this verification run — those two scenarios are NOT yet runtime-confirmed. No scenario is failing; none is unverified.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Active Flag on Exercise Schema | ✅ Implemented | Schema + migration exact (`BOOLEAN NOT NULL DEFAULT true`) |
| Active-Only Read Paths | ✅ Implemented | `isActive: true` present in BOTH `getExercises` and `getExercisesSummary`; filter in server actions, not store |
| Toggle Action Contract | ✅ Implemented | Order auth (inside try) → Zod → `findFirst({ id, userId })` → update; union codes exactly `unauthorized \| invalid_input \| not_found \| error`; `revalidatePath("/exercises")` success-only; `exerciseActiveStateSchema` exported with inferred input type |
| Set History Preservation | ✅ Implemented | No Set write, delete, or cascade in the diff |
| Deactivate Control in ExerciseSection | ✅ Implemented (code) | Destructive button per card; refresh-on-ok; toast-on-err (Spanish messages); runtime evidence deferred |
| Name Uniqueness Unaffected | ✅ Implemented | `@unique` untouched; reactivation path server-side |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 `isActive Boolean @default(true)` + `migrate dev --name exercise_is_active` | ✅ Yes | Field present; migration folder `20260913193952_exercise_is_active`, SQL exact |
| D2 Active-only filtering in server actions, not store | ✅ Yes | Both read actions; store logic untouched (fixture only); picker covered via `getExercises` |
| D3 `not_found` code string; union `unauthorized \| invalid_input \| not_found \| error` | ✅ Yes | `type ErrorCode` matches exactly |
| D4 Ownership `findFirst({ id, userId })` then update; auth inside try, parse before DB | ✅ Yes | Mirrors `update-set.ts`; tests assert zero Prisma calls on auth/parse failure |
| D5 Destructive deactivate button; refresh-on-ok, toast-on-err; Spanish messages; reactivation UI deferred | ✅ Yes | Handler matches design; no reactivation button |
| D6 Store fixture gains `isActive: true` | ✅ Yes | `makeExercise` includes `isActive: true` |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress (Engram #2975) has full TDD Cycle Evidence table |
| All tasks have tests | ✅ | 25/25 tasks; test-bearing phases 2–3 have test files; infra/read/UI phases verified per tasks.md via gates |
| RED confirmed (tests exist) | ✅ | 2/2 test files exist: `exercise.test.ts`, `set-exercise-active-state.test.ts` |
| GREEN confirmed (tests pass) | ✅ | 84/84 pass on execution (14 new: 5 schema + 9 action) |
| Triangulation adequate | ✅ | Schema 5 cases (both directions + empty id + non-boolean + missing fields); action 9 cases (all 4 codes, success x2, error x3) |
| Safety Net for modified files | ✅ | Baseline 5/5 schema, 12/12 store suite, 84/84 full suite reported; new files this change |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 84 (14 new) | 11 (2 new) | vitest |
| Integration | 0 | 0 | not installed (Stage 1: no jsdom/RTL) |
| E2E | 0 | 0 | not installed |
| **Total** | **84** | **11** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (config `testing.coverage.available: false`).

### Assertion Quality
Audit of both new/updated test files: every test invokes production code (`safeParse` / `setExerciseActiveState`), asserts union values, and asserts the spec's no-DB-access and revalidate contract via mock call assertions (`not.toHaveBeenCalled()`, `toHaveBeenCalledWith`). No tautologies, no ghost loops, no orphan empty checks, no type-only-only assertions, no smoke tests. Mock count (3 `vi.mock`) is below 2× the assertion count.
**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics
**Linter**: ✅ No errors (exit 0)
**Type Checker**: ✅ No errors (exit 0)
**Formatter**: ✅ Clean (exit 0)

### Issues Found
**CRITICAL**: None
**WARNING**:
1. REQ-05 UI scenarios (Success removes the card / Failure keeps the card and shows a toast) are typecheck-verified only — **manual smoke was NOT performed in this verification run**, so card-removal and toast behavior lack runtime confirmation. Stage-1 has no DOM/RTL tooling; per design §5 they are designated manual smoke. Must be manually smoked (or covered by Stage 2 component tests) before archive.
**SUGGESTION**:
1. Pre-existing environment noise: `pnpm` wants Node 24.x, running 22.22.2; `next lint` is deprecated (removed in Next 16). Not caused by this change.
2. Direct `/exercises/update/[id]` can still edit inactive rows — accepted edge per design risk table; consider guarding later.
3. `revalidatePath("/exercises")` is called on every successful toggle including reactivation; fine today, but a future "show inactive" view should revalidate its own path too.

### Verdict
PASS WITH WARNINGS — all six CI gates green (test 84/84, tsc, lint, format:check, prisma validate, build), 25/25 tasks complete, no design deviation, no CRITICAL finding. 14/16 scenarios carry passing runtime or migration/build evidence; the remaining 2 REQ-05 UI scenarios are typecheck-verified only, with manual smoke deferred and NOT performed in this run (Stage-1 has no DOM tooling). The only substantive gap is honest and pre-agreed: those two deactivate-UI behaviors need manual smoke or Stage 2 component tests before archive.