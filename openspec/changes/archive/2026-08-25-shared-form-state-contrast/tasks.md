# Tasks: Shared Form State Contrast

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 130–230 lines; below the session 800-line budget |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | One local PR-sized work unit; do not push or create a PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Commit the audit prerequisite, transfer the shared slice, correct Tailwind ESM loading, validate, and retain recovery until green | One local unit; no push/PR | `pnpm run format:check && pnpm test && pnpm lint && pnpm exec tsc --noEmit && pnpm exec prisma validate && pnpm build` | Production build compiles `/workouts/create` with Tailwind configuration loaded as ESM | Revert only `tailwind.config.ts` import correction and the isolated seven-file commit; keep the audit commit and retained stash intact |

## Phase 1: Audit Base and Transfer Guards

- [x] 1.1 RED: verify preflight rejects wrong repository roots, unexpected branches, or mismatched absolute paths before any mutation; test with the primary and target roots swapped.
- [x] 1.2 RED: verify guards abort on a missing audit ancestor, dirty target index/worktree, empty named stash, or one extra stashed path; no files may change on failure.
- [x] 1.3 Create a named path-limited stash containing exactly the seven source files and `openspec/changes/shared-form-state-contrast/`; record its ref and retain it.
- [x] 1.4 From the now isolated primary worktree, stage only the five audit files (`globals.css`, `button.tsx`, `calendar.tsx`, `SummaryWorkout.tsx`, `SummaryWorkoutForm.tsx`), commit the audit prerequisite, record its SHA, and verify a clean audit commit.

## Phase 2: Dedicated Worktree and Seven-File Slice

- [x] 2.1 Create `/home/luhpaco/projects/gymbro-tracker-worktrees/shared-form-state-contrast` from the audit SHA; verify the audit commit is an ancestor and the target index/worktree is clean.
- [x] 2.2 Apply the named stash without popping it; verify status contains only the seven source paths plus the OpenSpec folder, with no audit file or unrelated path.
- [x] 2.3 Commit only the seven product files: `command.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `CreateExerciseForm.tsx`, `UpdateExerciseForm.tsx`, and `AddExerciseForm.tsx`; preserve presentation-only scope and exclude `button.tsx`.

## Phase 3: Verification and Manual Validation

- [x] 3.1 Verify the diff is presentation-only: no handlers, props, `aria-*`, schemas, actions, stores, routes, persistence, or Radix/cmdk behavior changed; run quality commands.
- [x] 3.2 Manually validate `/auth/login` and register, `/exercises/create`, `/exercises/update/[id]`, `/exercises`, and `/workouts/create` for placeholder, icon, invalid, mixed, focus, disabled, selection, submission, navigation, and Zustand behavior (maintainer-attested).
- [x] 3.3 Keep the named stash until the shared commit and all checks pass; only then remove it if desired, and record exact command results. Do not push or compose PR commands.

## Phase 4: Rollback

- [x] 4.1 N/A — not triggered: no transfer or check failure occurred, so no dedicated worktree removal or rollback execution was needed. The named stash remains retained; the audit commit and unrelated files were not changed.
- [x] 4.2 N/A — not triggered: no delivery rollback occurred, so the isolated seven-file shared commit was not reverted. The audit prerequisite and unrelated changes remain intact.

## Phase 5: Tailwind ESM Runtime Configuration

- [x] 5.1 Include the existing import-only `tailwind.config.ts` correction: replace CommonJS `require(...)` loads for `tailwindcss/defaultTheme` and `tailwindcss-animate` with typed ESM imports, preserve the existing font-family extension and animation plugin, and validate that Next compiles `/workouts/create` without `ReferenceError: require is not defined`. Evidence: the native ESM attempt before correction failed with that exact error; the post-correction production build exited 0 and lists `/workouts/create` as a dynamic route.
