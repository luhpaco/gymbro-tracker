```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:d9f94b29e004446d72af1ca35cf22c19203cc16de8954907b6a706fef000e1c4
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 12/12
scenarios: 35/35
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:a216373084ad5a27f83b22ae92b89f78f32463829f566c01aa9db32ada2c6f3e
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:02f56b2f8a145e6e5e7102576c5d9b3620ea9a6f255354f85923d12bddb1a6f5
```

## Verification Report

**Change**: exercise-name-uniqueness
**Version**: N/A (delta specs, no version headers)
**Mode**: Strict TDD (config `testing.strict_tdd: true`, `rules.verify.test_command: "pnpm test"`, `build_command: "pnpm build"`, coverage not configured)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 13 |
| Tasks complete | 13 |
| Tasks incomplete | 0 |
| Requirements (specs) | 12 |
| Scenarios (specs) | 35 |

All 13 tasks in `tasks.md` are marked `[x]`; full verification run (not blocked). Artifact store: hybrid — proposal/specs/design/tasks read from `openspec/changes/exercise-name-uniqueness/`; apply-progress read from Engram topic `sdd/exercise-name-uniqueness/apply-progress` (observation #3115, now includes the per-task TDD Cycle Evidence table). Implementation lives uncommitted in the working tree on `master` (11 modified + 16 untracked paths, including both generated migrations).

**Scenario-count correction**: the authoritative count of `#### Scenario:` headings across the four delta specs is 35 (7 + 18 + 7 + 3), not the 32 carried by the prior envelope. The prior report's own compliance matrix already listed 35 rows; this report uses the corrected, heading-verified totals (12 requirements / 35 scenarios).

### Build & Tests Execution (all gates re-run independently in this verification run)
**Tests** (`pnpm test`): ✅ 143 passed / 0 failed / 0 skipped — 16 files, exit 0
```text
 Test Files  16 passed (16)
      Tests  143 passed (143)
```
**Integration** (`RUN_EXERCISE_NAME_INTEGRATION=1 pnpm exec vitest run --config vitest.integration.config.ts`): ✅ 8 passed / 0 failed — exit 0. Re-run against the live PostgreSQL on `localhost:5432` (`prisma migrate status`: 14/14 migrations applied, schema up to date — includes `20260915194822_exercise_name_expand` and `20260915195222_exercise_name_contract`). These 8 tests are opt-in (`describe.skipIf(!RUN_EXERCISE_NAME_INTEGRATION)`); CI has no database, matching design §Testing Strategy.
```text
 Test Files  1 passed (1)
      Tests  8 passed (8)
```
**Lint** (`pnpm lint`): ✅ "No ESLint warnings or errors", exit 0 (pre-existing `next lint` deprecation notice; not caused by this change)
**Format** (`pnpm run format:check`): ✅ "All matched files use Prettier code style!", exit 0
**Type check** (`pnpm exec tsc --noEmit`): ✅ exit 0, no output
**Prisma** (`pnpm exec prisma validate`): ✅ "The schema at prisma/schema.prisma is valid 🚀", exit 0
**Build** (`pnpm build`): ✅ exit 0 — compiled successfully, all 14 routes generated
**Coverage**: ➖ Not available (config `testing.coverage.available: false`; no coverage tool detected — not a failure)

### Spec Compliance Matrix
| Requirement | Scenario | Test / Evidence | Result |
|-------------|----------|-----------------|--------|
| REQ-01 Normalized name identity | Equivalent spellings normalize identically | `src/lib/exercise-name.test.ts` — trim, whitespace collapse, NBSP, NFC composed/decomposed, case-fold, sharp-S, sigma (7 cases) | ✅ COMPLIANT (runtime) |
| REQ-01 | Distinct names remain distinct | `exercise-name.test.ts` — accents preserved, hyphens vs spaces differ | ✅ COMPLIANT (runtime) |
| REQ-02 Safe canonical-identity migration | Legacy collision blocks migration | `exercise-name-backfill.test.ts` — same-owner collision detected; `runExerciseNameBackfill` returns `collision` before any write | ✅ COMPLIANT (runtime) |
| REQ-02 | Safe backfill preserves history | `exercise-name-backfill.test.ts` — cross-owner reuse passes audit, in-place `update({ where: { id } })` only (IDs/owner/history untouched), interrupted-run retry updates exactly the pending row | ✅ COMPLIANT (runtime) |
| REQ-03 Owner-scoped identity | Same-owner duplicate is rejected | create action tests (pre-check + both P2002 shapes → `duplicate_name`); integration: same-owner duplicate rejects with P2002 | ✅ COMPLIANT (runtime) |
| REQ-03 | Cross-owner reuse succeeds | backfill audit test (no collision) + integration test (owner B creates same identity successfully) | ✅ COMPLIANT (runtime) |
| REQ-03 | Self-rename succeeds | `update-exercise.test.ts` "succeeds on self-rename"; integration self-rename test (raw update, identity unchanged) | ✅ COMPLIANT (runtime) |
| REQ-01 Composite per-user tag uniqueness constraint | Scoped constraint is migrated | Integration "enforces the scoped contract migration": asserts `Exercise_userId_canonicalName_key` present, `Exercise_name_key` and `Exercise_userId_tag_key` absent in `pg_indexes`; migration SQL verified (expand adds nullable column; contract drops both old indexes, sets NOT NULL, creates scoped unique index) | ✅ COMPLIANT (runtime + migration) |
| REQ-01 | Database rejects only same-owner duplicates | Integration test — same-owner write P2002, cross-owner write succeeds | ✅ COMPLIANT (runtime) |
| REQ-02 Atomic backstop under concurrent creates | Concurrent mutations conflict | Integration: synchronized create/create (via action), raw create/create, create/rename, rename/rename — exactly one winner each, loser `duplicate_name`/P2002 classified canonical | ✅ COMPLIANT (runtime, 4 race pairs) |
| REQ-03 P2002 target normalization | Canonical target maps to duplicate_name | `exercises.test.ts` classifier (array either order + constraint-name key); create action tests (both target shapes); update action test | ✅ COMPLIANT (runtime) |
| REQ-03 | Other target maps to error | Classifier (legacy `(userId, tag)`, `name`, malformed, wrong code → false); create and update action tests (unrelated P2002 → `error`) | ✅ COMPLIANT (runtime) |
| REQ-04 Pre-check fast path retained | Pre-check short-circuits without write | Create/update action tests — `duplicate_name` with `create`/`update` and `revalidatePath` NOT called | ✅ COMPLIANT (runtime) |
| REQ-04 | Rename excludes itself | `update-exercise.test.ts` asserts pre-check `where: { canonicalName, id: { not }, userId }`; `exercises.test.ts` "excludes the renamed row" | ✅ COMPLIANT (runtime) |
| REQ-01 Validated and authorized rename | Valid owner rename succeeds | `update-exercise.test.ts` — asserts `{ ok: true, exercise }`, update payload persists `name` + `canonicalName` + legacy `tag` atomically, `revalidatePath("/exercises")` | ✅ COMPLIANT (runtime) |
| REQ-01 | Invalid or unauthorized rename does not write | `update-exercise.test.ts` — unauthorized (zero Prisma calls), invalid input (short/tampered, no write), not_found (missing/non-owned, no update, no revalidate) | ✅ COMPLIANT (runtime) |
| REQ-02 Per-user tag uniqueness pre-check | No collision creates | Create action success test | ✅ COMPLIANT (runtime) |
| REQ-02 | Owned collision short-circuits | Create action test — pre-check `where: { canonicalName, userId }` with no `isActive` filter (inactive rows included), no create, no revalidate | ✅ COMPLIANT (runtime) |
| REQ-02 | Concurrent insert races past pre-check | Create action P2002 → `duplicate_name`; integration synchronized create/create race | ✅ COMPLIANT (runtime) |
| REQ-02 | Canonical P2002 maps to duplicate_name | Create action tests (array + constraint-name targets) | ✅ COMPLIANT (runtime) |
| REQ-02 | Cross-owner name reuse proceeds | Integration cross-owner create succeeds | ✅ COMPLIANT (runtime) |
| REQ-02 | Other P2002 maps to error | Create action test — `name` target → `error` | ✅ COMPLIANT (runtime) |
| REQ-03 Discriminated-union return | Success | Create action test — `{ ok: true, exercise }` | ✅ COMPLIANT (runtime) |
| REQ-03 | Unauthorized | Create action test — `unauthorized`, no Prisma calls | ✅ COMPLIANT (runtime) |
| REQ-03 | Invalid input | Create action test — `invalid_input`, no Prisma calls | ✅ COMPLIANT (runtime) |
| REQ-03 | Unknown muscle group | Create action test — `unknown_muscle_group`, no create | ✅ COMPLIANT (runtime) |
| REQ-03 | Duplicate name | Create action tests (pre-check + P2002) | ✅ COMPLIANT (runtime) |
| REQ-03 | Error catch-all | Create action tests — auth throws, muscle lookup fails, pre-check fails, unrelated P2002 → `error` | ✅ COMPLIANT (runtime) |
| REQ-04 Form handles the discriminated union | Success branch | `CreateExerciseForm.tsx`/`UpdateExerciseForm.tsx`: `result.ok` → success toast + `form.reset()` + `router.push("/exercises")`; compiles under tsc + build | ⚠️ PARTIAL (typecheck-verified; manual smoke not independently confirmed) |
| REQ-04 | Error branch per code | Both forms: destructive toast per code, no reset/navigation on failure; compiles under tsc + build | ⚠️ PARTIAL (typecheck-verified; manual smoke not independently confirmed) |
| REQ-04 | Field mapping on create | `CreateExerciseForm` submits `{ name, description, muscleGroupTag }` — exactly `createExerciseSchema` fields; schema runtime test "accepts valid input"; action receives and persists them | ✅ COMPLIANT (runtime + static) |
| REQ-04 | Rename duplicate feedback | `UpdateExerciseForm`: `duplicate_name` → destructive toast "Ya tienes un ejercicio con ese nombre…", no success flow; compiles under tsc + build | ⚠️ PARTIAL (typecheck-verified; manual smoke not independently confirmed) |
| REQ-01 Name Uniqueness Unaffected | Same-owner creation fails while inactive | Create action pre-check query has no `isActive` filter (`exercises.test.ts` asserts owner-scope-only where); inactive row therefore still collides → `duplicate_name` | ✅ COMPLIANT (runtime) |
| REQ-01 | Another owner may reuse the name | Integration cross-owner reuse test | ✅ COMPLIANT (runtime) |
| REQ-01 | Reactivation restores the exercise | Reactivation path (`set-exercise-active-state`) untouched by this diff; baseline soft-delete runtime tests green in this run (143 suite); backfill updates rows in place preserving lifecycle state | ✅ COMPLIANT (runtime + static) |

**Compliance summary**: 35/35 scenarios covered. 32/35 carry passing runtime evidence (unit and/or opt-in PostgreSQL integration, independently re-run this verification); 3/35 form-behavior scenarios are typecheck/build-verified only — manual browser smoke was claimed by task 4.3 but no evidence is recorded in apply-progress and it cannot be independently confirmed in this run (Stage-1 has no DOM/RTL tooling; design assigns these to the manual layer). No scenario is failing; none is unverified.

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Normalized name identity | ✅ Implemented | `normalizeExerciseName`: NFC → trim → collapse ECMAScript `\s+` to ASCII space; identity `caseFold(name).normalize("NFC")` via pinned `unicode-case-folding@1.1.1` (exact-match package.json); display case preserved |
| Safe canonical-identity migration | ✅ Implemented | `findCanonicalCollisions` groups by `userId::canonicalName`; `runExerciseNameBackfill` refuses without `authorizedConnection`+`allowWrite`, blocks on collisions, dry-run default, in-place id-keyed updates; runner script never logs credentials; expand/contract migrations generated by Prisma (not hand-edited) |
| Owner-scoped identity | ✅ Implemented | `@@unique([userId, canonicalName])`, `name @unique` and `@@unique([userId, tag])` removed; inactive rows included (no `isActive` filter anywhere in collision paths); rename self-exclusion via `id: { not }` |
| Composite per-user tag uniqueness constraint | ✅ Implemented | Schema + contract migration exact; legacy `tag` kept as derived non-unique value (`deriveExerciseTag`) |
| Atomic backstop under concurrent creates | ✅ Implemented | DB constraint is the backstop; 4 synchronized race pairs proven in integration |
| P2002 target normalization | ✅ Implemented | `isCanonicalUniquenessViolation`: P2002 + exactly `[userId, canonicalName]` (either order) or `Exercise_userId_canonicalName_key` → `duplicate_name`; everything else `error` |
| Pre-check fast path retained | ✅ Implemented | Both actions pre-check before write; update self-excludes |
| Validated and authorized rename | ✅ Implemented | auth → strict Zod (rejects supplied `userId`/`tag`/`canonicalName`, requires nonempty `id`) → ownership `findFirst({ id, userId })` → muscle group → self-excluding pre-check → atomic update; P2025 → `not_found`; success-only revalidate |
| Discriminated-union return | ✅ Implemented | Exact code unions per design: create `unauthorized \| invalid_input \| unknown_muscle_group \| duplicate_name \| error`; update adds `not_found`; no `undefined`/swallowed errors |
| Form handles the discriminated union | ✅ Implemented (code) | Code-specific destructive Spanish toasts, retained failure values (no reset), success-only reset/navigation; runtime evidence deferred to manual layer |
| Name Uniqueness Unaffected | ✅ Implemented | Scoped reservation covers inactive rows; reactivation/history preserved (no row deletion anywhere in diff) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 Dedicated `canonicalName` column; `@@unique([userId, canonicalName])`; remove `name @unique` + `@@unique([userId, tag])` | ✅ Yes | Schema exact; contract migration drops both old indexes, sets NOT NULL, creates scoped index |
| D2 Full case-folding identity (not lowercase/slug) | ✅ Yes | `caseFold` + NFC; accents/hyphens preserved — tests assert `Café ≠ Cafe`, `Bench-Press ≠ Bench Press` |
| D3 Pre-check + database backstop | ✅ Yes | Both implemented; races proven |
| D4 Paused cutover / separate expand + contract migrations | ✅ Yes | `20260915194822_exercise_name_expand` (add nullable) then `20260915195222_exercise_name_contract` (require + unique + drop old) — applied 14/14 on live DB; backfill runner separate idempotent DML |
| D5 Normalization contract NFC → trim → collapse `\s+` | ✅ Yes | `normalizeExerciseName` matches exactly; shared by schemas, actions, backfill |
| D6 Shared Zod schemas; ≥4 chars after display normalization; reject `userId`/`tag`/`canonicalName`; update requires `id` | ✅ Yes | `exerciseNameField` superRefine on normalized length; `.strict()` rejects extras |
| D7 Discriminated codes incl. `duplicate_name`; only scoped P2002 maps | ✅ Yes | Exact unions; classifier exact |
| D8 Rename ownership via id+userId, P2025 → `not_found` | ✅ Yes | findFirst-then-update-by-id pattern (apply learned Prisma rejects compound `where: { id, userId }`) |
| D9 Tag compatibility: preserve tags, derive legacy-format tags atomically; store filters `muscleGroupTag`; sets reference `exerciseId` | ✅ Yes | `deriveExerciseTag` on create/rename; `exercises-store.ts` still filters `muscleGroupTag`; no FK/cascade change |
| D10 Backfill: authorized opt-in, dry-run default, zero credential logging, audit blocks | ✅ Yes | Script + lib match; tests assert zero writes on refusal/dry-run |
| D11 Success-only revalidation; forms retain values on failure | ✅ Yes | Both actions; both forms (no reset on failure) |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | apply-progress (Engram #3115) now contains the per-task "TDD Cycle Evidence" table (Task / Test File / Layer / Safety Net / RED / GREEN / TRIANGULATE / REFACTOR) covering every test-bearing task — prior CRITICAL is CLOSED |
| All tasks have tests | ✅ | 13/13; RED-phase test files exist for tasks 1.1–1.3; phases 2–4 verified via gates + integration suite (tasks 3.1/4.2/4.3 are migration/gates/manual — covered by the integration "migrations applied" safety-net row, the gate suite, and the design-assigned manual layer) |
| RED confirmed (tests exist) | ✅ | All 8 table test files verified present in the working tree: `exercise-name.test.ts` (11), `schemas/exercise.test.ts` (16), `exercises.test.ts` (5), `create-exercise.test.ts` (16), `update-exercise.test.ts` (9), `exercise-name-backfill.test.ts` (6), `exercises-store.test.ts` (7), integration (8); RED entries (module-missing / N failed / type gap) describe observed failing-first states |
| GREEN confirmed (tests pass) | ✅ | 143/143 unit + 8/8 integration pass on independent execution; per-file case counts in the table match the actual `it()` counts in each file |
| Triangulation adequate | ✅ | Multi-case per behavior with differing expectations (equal vs not-equal identities; every action code; both P2002 target shapes; 4 race pairs); the single-case row (4.1 store fixture key) has no multi-scenario spec counterpart |
| Safety Net for modified files | ✅ | Full baseline suite green in run (143 total, 16 files incl. pre-existing soft-delete/schema/store tests); files marked "N/A (new)" are genuinely new (untracked): `update-exercise.test.ts`, `exercise-name-backfill.test.ts`, `exercise-name.test.ts`, `exercises.test.ts`, integration suite; modified files (`schemas/exercise.test.ts`, `create-exercise.test.ts`, `exercises-store.test.ts`) carry prior-green safety-net entries |

**TDD Compliance**: 6/6 checks passed — the previously failing "TDD Evidence reported" check now passes; every underlying TDD fact was independently re-verified green in this run.

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit | 143 (71 new for this change) | 16 (7 new/modified) | vitest 4.1.11, mocked `@/auth`, `@/lib/prisma`, `next/cache` |
| Integration | 8 (opt-in) | 1 | vitest + real PostgreSQL 15 (`RUN_EXERCISE_NAME_INTEGRATION=1`) |
| E2E | 0 | 0 | not installed |
| **Total** | **151** | **17** | |

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (config `testing.coverage.available: false`).

### Assertion Quality
Audit of all 7 change test files plus the modified store test: every test invokes production code (`normalizeExerciseName`, `safeParse`, actions, `findCanonicalCollisions`, `runExerciseNameBackfill`, classifier, store actions, or live Prisma), asserts union values and exact persisted payloads, and asserts the no-write/no-revalidate contracts via mock call assertions. No tautologies, no ghost loops (the `for...of` loops iterate fixed non-empty extra-field arrays), no orphan empty checks (the `toHaveLength(0)` collision expectation has a companion non-empty test in the same file), no type-only-only assertions, no smoke tests, no implementation-detail coupling. Mock counts (~3–5 `vi.mock` per action test file) are below 2× assertion counts.
**Assertion quality**: ✅ All assertions verify real behavior

### Quality Metrics
**Linter**: ✅ No errors (exit 0)
**Type Checker**: ✅ No errors (exit 0)
**Formatter**: ✅ Clean (exit 0)

### Issues Found
**CRITICAL**: None — the single prior CRITICAL (apply-progress lacking the TDD Cycle Evidence table) is closed: observation #3115 now includes the mandated per-task table with test files, layer, safety net, RED/GREEN/TRIANGULATE/REFACTOR columns and case counts, and this run independently confirmed every test file exists and passes.

**WARNING**:
1. Three REQ-04 form scenarios (Success branch, Error branch per code, Rename duplicate feedback) are typecheck/build-verified only — no runtime confirmation. Task 4.3 claims manual browser verification, but no evidence is recorded in apply-progress and it cannot be independently confirmed in this run (Stage-1 has no DOM/RTL tooling; design assigns these to the manual layer). Must be manually smoked (or covered by Stage-2 component tests) before archive.

**SUGGESTION**:
1. `tasks.md` still shows `Chain strategy: pending` although a single-PR `size:exception` was executed (preflight: non-blocking note; forecast was High/650–950 lines) — update the header when the delivery decision is recorded.
2. Proposal Success Criteria checkboxes remain unchecked until this phase — expected per preflight; archive should reflect them.
3. The prior envelope's scenario total (32) undercounted the actual spec headings (35); this report carries the corrected 12/35 counts — orchestrator status totals should be updated to match.
4. Pre-existing environment noise: `pnpm` wants Node 24.x, running 22.22.2; `next lint` is deprecated (removed in Next 16). Not caused by this change; all gates green under current runtime.
5. Integration tests are opt-in (`RUN_EXERCISE_NAME_INTEGRATION=1`) and CI has no database — the recorded integration evidence is the rollout gate; keep it with the PR.

### Verdict
PASS WITH WARNINGS — the prior CRITICAL protocol finding is closed: apply-progress now reports the per-task TDD Cycle Evidence table, and this independent re-run reconfirmed every underlying fact (RED test files exist and pass, triangulation adequate, safety nets green). All six CI gates green on independent re-run (143/143 unit, 8/8 opt-in PostgreSQL integration incl. all four synchronized race pairs, lint, format:check, tsc, prisma validate, build), 13/13 tasks complete, 35/35 spec scenarios covered (32 with runtime evidence, 3 typecheck-verified manual-layer scenarios pending recorded browser smoke), zero design deviations, zero assertion-quality findings. Report is persistable and archive-ready; the remaining warnings (manual smoke evidence for the three form scenarios) should be recorded before archive.