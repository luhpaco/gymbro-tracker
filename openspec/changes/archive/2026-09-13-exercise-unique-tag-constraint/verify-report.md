```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:8327f20991a5c132982403774aeaae5418b4cdfe5276ccc50bf88f57f98e8669
verdict: pass_with_warnings
blockers: 0
critical_findings: 0
requirements: 5/5
scenarios: 13/13
test_command: CI=true pnpm test
test_exit_code: 0
test_output_hash: sha256:3f1e97af3d83673cdad979bef087988bb2814072fbf60d0eefc4f5286a2683a8
build_command: CI=true pnpm build
build_exit_code: 0
build_output_hash: sha256:495d3cf1e4da2b4f95572895bf65c6aecbe576e71f36950a85c0d13a50d836b5
```

## Verification Report

**Change**: exercise-unique-tag-constraint
**Version**: N/A (delta specs)
**Mode**: Strict TDD (config `testing.strict_tdd: true`; vitest runner)

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 17 |
| Tasks complete | 17 (all `[x]`) |
| Tasks incomplete | 0 |

All tasks complete → full verification executed. Apply evidence retrieved from Engram #2996 (`sdd/exercise-unique-tag-constraint/apply-progress`; no `apply-progress.md` on disk — Engram-only persistence).

### Gates (all executed with `CI=true`)
| # | Gate | Command | Exit | Result |
|---|------|---------|------|--------|
| 1 | Tests | `CI=true pnpm test` | 0 | 86/86 passed (11 files) |
| 2 | Typecheck | `CI=true pnpm exec tsc --noEmit` | 0 | clean |
| 3 | Lint | `CI=true pnpm lint` | 0 | no warnings/errors |
| 4 | Format | `CI=true pnpm run format:check` | 0 | all matched files formatted |
| 5 | Schema | `CI=true pnpm exec prisma validate` | 0 | valid |
| 6 | Build | `CI=true pnpm build` | 0 | compiled; static pages 14/14 |

### Build & Tests Execution
**Build**: ✅ Passed
```text
CI=true pnpm build → prisma generate ✅ (v5.18.0) + Next.js 15.5.23 optimized build
✓ Compiled successfully in 2.8s; static pages 14/14; exit 0
(Informational log only: "Dynamic server usage: Route /workouts/create" — route renders dynamically, build completes.)
```

**Tests**: ✅ 86 passed / 0 failed / 0 skipped (11 files, 174ms)
```text
CI=true pnpm test → vitest run: Test Files 11 passed (11); Tests 86 passed (86); exit 0
```

**Coverage**: ➖ Not available — no coverage tool detected (`testing.coverage.available: false` in `openspec/config.yaml`)

### Spec Compliance Matrix
| # | Requirement | Scenario | Covering Test / Evidence | Result |
|---|-------------|----------|--------------------------|--------|
| 1 | Composite per-user tag uniqueness constraint | Constraint declared and migrated | `prisma/schema.prisma` L55 `@@unique([userId, tag])` (L43 `name @unique` intact) + `prisma validate` exit 0 + `migrations/20260913205125_exercise_user_tag_unique/migration.sql` exact: `CREATE UNIQUE INDEX "Exercise_userId_tag_key" ON "Exercise"("userId", "tag")` | ✅ COMPLIANT |
| 2 | Composite per-user tag uniqueness constraint | Database rejects duplicate tag rows | Apply-time live-DB probe (Engram #2996): duplicate `(userId, tag)` INSERT rejected with `violates unique constraint "Exercise_userId_tag_key"`, rolled back (count stayed 3) | ✅ COMPLIANT |
| 3 | Atomic backstop under concurrent creates | Concurrent same-tag inserts | `create-exercise.test.ts` > "returns duplicate tag when create throws P2002 with composite array target" + "…constraint-name string target" | ✅ COMPLIANT (no true-concurrency harness under Stage-1; DB constraint is the atomic proof — stated gap) |
| 4 | P2002 target normalization | Array target maps to duplicate_tag | `create-exercise.test.ts` L167 > "returns duplicate tag when create throws P2002 with composite array target" | ✅ COMPLIANT |
| 5 | P2002 target normalization | Constraint-name target maps to duplicate_tag | `create-exercise.test.ts` L180 > "returns duplicate tag when create throws P2002 with constraint-name string target" | ✅ COMPLIANT |
| 6 | P2002 target normalization | Other target maps to error | `create-exercise.test.ts` L154 > "returns error when global unique validation rejects exercise creation" (P2002, no meta → error) | ✅ COMPLIANT (identical not-composite branch; exact `["name"]` fixture not separately pinned — SUGGESTION) |
| 7 | Pre-check fast path retained | Pre-check short-circuits without exception | `create-exercise.test.ts` L88 > "returns duplicate tag without creating an exercise" (asserts `create` NOT called) | ✅ COMPLIANT |
| 8 | Per-user tag uniqueness pre-check (delta) | No collision creates | `create-exercise.test.ts` L102 > "creates an exercise with its derived tag and revalidates the exercises page" | ✅ COMPLIANT |
| 9 | Per-user tag uniqueness pre-check (delta) | Collision short-circuits | same as #7 | ✅ COMPLIANT |
| 10 | Per-user tag uniqueness pre-check (delta) | Concurrent insert races past the pre-check | same as #3 | ✅ COMPLIANT (stated gap as #3) |
| 11 | Per-user tag uniqueness pre-check (delta) | Composite P2002 target maps to duplicate_tag | same as #4 + #5 | ✅ COMPLIANT |
| 12 | Per-user tag uniqueness pre-check (delta) | Cross-user name collision maps to error | same as #6 (name P2002 → `error`, pre-existing regression test) | ✅ COMPLIANT |
| 13 | Per-user tag uniqueness pre-check (delta) | Non-composite P2002 target maps to error | same as #6 | ✅ COMPLIANT (note as #6) |

**Compliance summary**: 13/13 scenarios compliant

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| Composite per-user tag uniqueness constraint | ✅ Implemented | `@@unique([userId, tag])` on `Exercise`; `name @unique` unchanged; migration creates `Exercise_userId_tag_key` |
| Atomic backstop under concurrent creates | ✅ Implemented | Catch-all maps composite P2002 → `duplicate_tag` (L92–94); no exception escapes the union |
| P2002 target normalization | ✅ Implemented | `isCompositeTagViolation` (L25–45): array length-2 order-insensitive `userId`+`tag`, or string `Exercise_userId_tag_key`; unknown shapes → false |
| Pre-check fast path retained | ✅ Implemented | `findFirst` pre-check untouched (L73–78), short-circuits `duplicate_tag` before `create` |
| Per-user tag uniqueness pre-check (delta) | ✅ Implemented | Tag derived server-side (L71); catch-all order: composite → `duplicate_tag`, else `error` (D4) |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 `@@unique([userId, tag])`, global `name @unique` stays | ✅ Yes | schema L55 + L43; 0 violating rows verified at apply |
| D2 Normalize both P2002 `meta.target` shapes defensively | ✅ Yes | helper accepts array + string; defaults false |
| D3 Keep `findFirst` fast path unchanged | ✅ Yes | pre-check block untouched |
| D4 Catch-all ordering: composite check first, then `error` | ✅ Yes | L92–95 |
| D5 No `meta` type widening beyond the helper | ✅ Yes | `err: unknown`, runtime guards only, no casts |

### TDD Compliance
| Check | Result | Details |
|-------|--------|---------|
| TDD Evidence reported | ✅ | Engram #2996 has "TDD Cycle Evidence" table (tasks 3.1, 3.2, 3.4–3.5) |
| All tasks have tests | ✅ | 2 new tests + regression guards in `create-exercise.test.ts` cover the test-bearing tasks |
| RED confirmed (tests exist) | ✅ | Both new tests exist (L167, L180); apply reports they failed as `error` before impl — consistent with the pre-change catch-all |
| GREEN confirmed (tests pass) | ✅ | 86/86 pass on execution (focused file 11/11) |
| Triangulation adequate | ✅ | Both composite shapes → `duplicate_tag`; name/no-meta P2002 → `error`; fast-path asserts no `create` |
| Safety Net for modified files | ✅ | Apply reports 84/84 before edits; suite now 86/86 |

**TDD Compliance**: 6/6 checks passed

### Test Layer Distribution
| Layer | Tests | Files | Tools |
|-------|-------|-------|-------|
| Unit (mocked) | 86 | 11 | vitest 4.1.11 (no DOM) |
| Integration | 0 | 0 | not installed (Stage-1 scope) |
| E2E | 0 | 0 | not installed |
| **Total** | **86** | **11** | |

Layers match cached capabilities (`unit: true`, `integration: false`, `e2e: false`) — no tool mismatch.

### Changed File Coverage
Coverage analysis skipped — no coverage tool detected (informational, not a failure).

### Assertion Quality
**Assertion quality**: ✅ All assertions verify real behavior — 21 expects across 11 tests; no tautologies, no ghost loops, no smoke tests, no type-only-only assertions; `expect(mocks.*).not.toHaveBeenCalled()` (L52–54, 69–70, 84–85, 99, 131–133) are behavioral short-circuit proofs (no DB write/query occurred), not count-based coupling; mock ratio 3 module mocks vs 21 assertions — not mock-heavy.

### Quality Metrics
**Linter**: ✅ No errors or warnings (`CI=true pnpm lint`, exit 0)
**Type Checker**: ✅ No errors (`CI=true pnpm exec tsc --noEmit`, exit 0)
**Formatter**: ✅ All matched files use Prettier code style (`CI=true pnpm run format:check`, exit 0)
**Prisma**: ✅ Schema valid (`CI=true pnpm exec prisma validate`, exit 0)

### Issues Found
**CRITICAL**: None
**WARNING**:
- True-concurrency insert race not exercised at runtime — accepted Stage-1 limitation; the DB constraint itself is the atomic proof (migration apply + apply-time live-DB probe).
- Live-DB index/duplicate-probe not re-run this session (local Postgres container down) — evidence chain stands: `prisma validate` exit 0 + exact migration SQL + apply-time probe (`\d "Exercise"` showed both `Exercise_name_key` and `Exercise_userId_tag_key`).
**SUGGESTION**:
- `create-exercise.test.ts` — the spec's `["name"]` fixture example for "other target" is not separately pinned; the no-meta P2002 test (L154) exercises the identical not-composite → `error` branch, but a `meta.target: ["name"]` fixture would pin the exact spec example.

### Gaps & Limitations (stated honestly)
1. **True-concurrency**: no parallel-insert harness — not reproducible under Stage-1 Vitest (mocked) testing. Constraint is the proof: migration apply + apply-time live-DB duplicate probe. Accepted by design §5.
2. **Live-DB re-check**: not re-run this session (Postgres container down); `prisma validate` + exact SQL + apply probe provide the evidence chain.
3. Apply-progress persisted in Engram only (#2996); no `apply-progress.md` on disk.

### Verdict
**PASS WITH WARNINGS**
13/13 scenarios compliant, 17/17 tasks complete, all six CI gates green (tests 86/86; tsc; lint; format:check; prisma validate; build). Warnings are the stated, accepted Stage-1 limitations above — no unmet requirement, no CRITICAL finding.