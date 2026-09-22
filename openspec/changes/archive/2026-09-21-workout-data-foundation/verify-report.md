# Verify Report: Workout Data Foundation

## Scope

- **Change**: `workout-data-foundation` (Notion F0.1)
- **Revision inspected**: `e6665756654a86df3be842c907104582cb0d0dd4` (`origin/master`)
- **Mode**: Strict TDD (`pnpm test`, Vitest)
- **Artifacts inspected**: proposal, design, tasks, five delta specs, Engram apply-progress observation `#3241`, implementation, migration, and all nine test files created or modified by the change
- **Historical delivery evidence supplied to verification**: feature-branch chain PRs #43 -> #44 -> #45 -> tracker #42; CI `verify` run `35678441438`; browser smokes for tasks 1.18, 2.10, and 3.9; child-diff/rollback review; Notion F0.1 completion

The browser smokes were not repeated, as explicitly instructed. Remote CI and PR metadata were treated as supplied historical evidence and were not re-queried.

## Executive Summary

**PASS WITH ONE PROCESS-EVIDENCE WARNING.** The merged implementation satisfies the 29 requirements and covers all 89 scenarios across the five delta specs through current automated tests, static inspection, generated SQL inspection, and the supplied database/browser smoke evidence. All six requested local gates passed on the inspected revision. No CRITICAL implementation, specification, migration, or assertion-quality finding was found.

The only WARNING is historical Strict-TDD provenance: Engram apply-progress `#3241` records RED/GREEN evidence for all five work units, but the earlier PR1/PR2 rows omit explicit Safety Net and Triangulate columns. Current GREEN and assertion quality were independently verified; omitted historical metadata cannot be reconstructed.

## Observed Progress

- `tasks.md`: **45/47 checked**. The two unchecked boxes are 4.2 and 4.3 (`tasks.md:181-182`). Supplied final-state evidence says both were executed; the checkboxes are stale bookkeeping, not unfinished implementation.
- Git: `HEAD` equals `origin/master` at `e666575`; `git diff --exit-code origin/master HEAD` passed.
- Before this report was written, the only worktree modification was the documented four-line route-reference rewrite in `tasks.md` (`/workouts` -> `workouts`) used to avoid dispatcher path parsing.
- Delivery guard: PR1 had an approved `size:exception` at 588 authored lines; PR2 was 383 and PR3 was 335. The supplied clean-child-diff and rollback-note review closes task 4.2.

## Practical Checks Executed

| Command | Exit | Result |
|---|---:|---|
| `pnpm test` | 0 | 23 files, **256/256 tests passed** |
| Focused nine changed test files | 0 | 9 files, **130/130 tests passed** |
| `pnpm build` | 0 | Prisma client generated; Next.js 15.5.23 compiled; 14/14 pages generated |
| `pnpm lint` | 0 | No ESLint warnings or errors |
| `pnpm run format:check` | 0 | All matched files use Prettier style |
| `pnpm exec tsc --noEmit` | 0 | No type errors |
| `pnpm exec prisma validate` | 0 | Prisma schema valid |
| `git diff --check` | 0 | No whitespace errors |

Non-blocking environment output:

- `pnpm` reported Node `22.22.2` while `package.json` requests `24.x`.
- `next lint` reported its existing Next.js 16 deprecation notice.
- `pnpm build` logged the expected dynamic-server-usage diagnostic for `/workouts/create` using `headers`, then correctly classified the route as dynamic and exited 0.

Coverage analysis was skipped because `openspec/config.yaml` records `testing.coverage.available: false`.

## Spec Compliance Summary

| Capability | Requirements | Scenarios | Evidence summary | Result |
|---|---:|---:|---|---|
| `workout-creation-form` | 4/4 | 12/12 | Form defaults and uncapped add control (`WorkoutCreationForm.tsx:49,190-195`), shared validators (`:51-58`), exhaustive failure-code map and retained form state (`:299-318`), automated schema/action tests, supplied browser smoke at 6 and 10 sets | PASS |
| `workout-session-timestamps` | 5/5 | 12/12 | Prisma columns/defaults (`schema.prisma:56-70`), generated SQL (`migration.sql:12-24`), boundaries absent from production `src/` reads/writes, `Workout.date` remains the primary list order (`get-workouts.ts:26-33`), supplied DB smoke | PASS |
| `workout-set-ordering` | 6/6 | 18/18 | Server assignment and total sort (`workout-sets.ts:22-62`), both read paths use `SET_ORDER_BY` and grouping (`get-workouts.ts:34-53`; `get-workout-by-slug.ts:8-32`), non-unique index (`migration.sql:27`), group-relative labels (`WorkoutDetailSets.tsx:28-38`), automated tests and supplied browser/DB smoke | PASS |
| `workout-set-validation` | 8/8 | 28/28 | Single re-exported schema (`workout.ts:2-8`), blank-safe numeric parsing and finite/integer rules (`workout-set.ts:7-35`), no set maximum (`workout.ts:6-8`), unchanged v1 draft key (`workout-draft.ts:4`), automated tests and supplied browser smoke | PASS |
| `workout-tag-uniqueness` | 6/6 | 19/19 | Composite constraint (`schema.prisma:76`; `migration.sql:9,30`), exact P2002 matcher (`workout-tag.ts:12-30`), bounded suffix retry (`create-workout.ts:38-58`), owner-scoped lookup (`get-workout-by-slug.ts:8-11`), automated tests and supplied real-Postgres/browser smoke | PASS |
| **Total** | **29/29** | **89/89** | Automated, static, migration, and supplied manual evidence combined | **PASS** |

## Non-Vitest Scenarios

### Generated SQL inspection

- Global `Workout_tag_key` is dropped and owner-scoped `Workout_userId_tag_key` is created (`migration.sql:8-9,29-30`).
- Workout/Exercise record timestamps are `NOT NULL DEFAULT CURRENT_TIMESTAMP` (`migration.sql:12-13,21-24`).
- `startedAt` and `endedAt` are nullable and have no default (`migration.sql:22-23`).
- No `CHECK` statement exists in the migration.
- `Set_workoutId_order_idx` is a non-unique index; no `(workoutId, order)` unique constraint exists (`migration.sql:26-27`).
- Local history comparison against pre-change base `3becbf6` shows exactly one added migration folder plus the schema edit.

Historical apply evidence records `prisma migrate dev --create-only` reporting no drift/no additional migration and the generated folder remaining unchanged. That historical generation event cannot be replayed without mutating the development database, so it is cited rather than re-run.

### Manual runtime evidence

The supplied final-state evidence records PASS for tasks 1.18, 2.10, and 3.9: stored order `0..n-1`; per-group `Serie N`; uncapped add-set control through ten sets; zero weight persistence; negative-weight/fractional-reps messages; same-owner base/`-2`/`-3` tags resolving independently; cross-owner base-tag reuse; and a clean dev-server log. These smokes were deliberately not repeated.

## Design Coherence

- `order` is workout-wide, zero-based, server-generated, and never copied from client input (`workout-sets.ts:22-35`).
- Read ordering is `(order, createdAt, id)` in both the Prisma request and authoritative JS sort (`workout-sets.ts:37-62`).
- Validation rejects blank/null before numeric conversion and accepts finite weight zero (`workout-set.ts:7-35`).
- Collision handling uses the database constraint without a pre-check, retries only the exact target, and stops after ten attempts (`workout-tag.ts:1-30`; `create-workout.ts:38-58`).
- Session boundaries are nullable and unwritten; production code contains no `startedAt`/`endedAt` reference.
- `WorkoutDetailSets.tsx`, `workout-draft.ts`, exercise summaries, workout list counting, and `editable-stat.tsx` remain unchanged relative to the pre-change base, matching the declared out-of-scope boundaries.

## Strict TDD Compliance

| Check | Result | Details |
|---|---|---|
| TDD evidence reported | PASS | Engram apply-progress `#3241` contains RED/GREEN tables for U1-U5 |
| Test-bearing work units have tests | PASS | U1-U5 map to existing changed tests; nine related test files are present |
| RED evidence | PASS with provenance limitation | Apply-progress records the observed failing states; test files exist. Historical RED cannot be independently replayed after implementation |
| GREEN confirmed | PASS | Focused run: **130/130** across all nine changed test files; full suite: **256/256** |
| Triangulation adequate | PASS | Current tests exercise multiple values and failure modes for ordering, validation, collision targets, retries, read paths, and draft compatibility |
| Safety net evidence | WARNING | PR3 records a baseline; PR1/PR2 RED/GREEN rows omit an explicit Safety Net column, so complete historical baseline provenance is unavailable |

## Test Layer Distribution

| Layer | Tests | Files | Notes |
|---|---:|---:|---|
| Unit / mocked server action | 130 | 9 | Vitest node environment; mocked auth/Prisma for actions |
| Automated integration | 0 | 0 | Not available in configured capabilities |
| Automated E2E | 0 | 0 | Not installed |

Real-Postgres and browser evidence exists as the supplied apply/final-state smoke record, not as committed automated tests.

## Assertion Quality

All nine changed test files were inspected. Tests call production code and assert concrete values, persisted payloads, ordering, exact error codes/messages, retry bounds, owner scoping, or draft behavior. No tautologies, assertion-free production paths, orphan empty checks, type-only-only assertions, smoke-only assertions, or unsafe ghost loops were found. The fixed 42-cell calendar loop first asserts length 42 (`workout-tag.test.ts:119-129`). Mock call-count assertions express specified behavioral bounds/no-retry contracts.

**Assertion quality**: PASS — 0 CRITICAL, 0 WARNING.

## Findings

### CRITICAL

None.

### WARNING

1. **Incomplete historical Safety Net metadata for PR1/PR2** — Engram apply-progress `#3241` records RED and GREEN counts but its earlier tables omit explicit Safety Net and Triangulate columns. Current correctness and triangulation are independently green; only the historical provenance is incomplete.

### SUGGESTION

1. **Synchronize stale task bookkeeping before archive if desired** — tasks 4.2 and 4.3 remain unchecked at `tasks.md:181-182`, while supplied final-state evidence says both were completed. Verification did not alter user-owned checkboxes.
2. **Align local verification with Node 24 when convenient** — this run passed under Node 22.22.2 despite the declared `24.x` engine. Supplied CI evidence passed on the integrated chain, so this is not a change blocker.

## Limitations

- Browser smokes were accepted as already-performed evidence and not repeated, per instruction.
- Remote PR/CI/Notion state was not re-queried; the supplied final-state facts were used.
- No coverage tool, automated integration layer, or automated E2E layer is configured.
- Migration generation/no-drift history was inspected through committed SQL and recorded apply evidence; `prisma migrate dev --create-only` was not re-run because verification should not mutate the database merely to recreate historical evidence.

## Recommendation

Proceed to **SDD archive**. Preserve the Strict-TDD provenance warning and stale task-checkbox note as historical process metadata; neither indicates an implementation defect or blocks archive.
