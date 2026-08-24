# Tasks: Radix UI React 19 Peer Bump

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~15–30 (6 package.json ranges + regenerated lockfile) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | auto-chain |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Bump six `@radix-ui/*` ranges, regenerate lockfile, pass gates + smoke | PR 1 | `pnpm exec tsc --noEmit && pnpm lint && pnpm build` | `pnpm dev` manual smoke checklist (7 steps) — runtime harness required because behavior/warning absence is only observable in a running browser (no test runner per `openspec/config.yaml`) | `git revert` of `package.json` + `pnpm-lock.yaml`, then `pnpm install` |

## Phase 1: Dependency Edits

- [x] 1.1 Edit `package.json` line 18: `@radix-ui/react-dialog` `^1.0.5` → `^1.1.23`
- [x] 1.2 Edit `package.json` line 19: `@radix-ui/react-label` `^2.0.2` → `^2.1.15`
- [x] 1.3 Edit `package.json` line 20: `@radix-ui/react-popover` `^1.0.7` → `^1.1.23`
- [x] 1.4 Edit `package.json` line 21: `@radix-ui/react-select` `^2.0.0` → `^2.3.7`
- [x] 1.5 Edit `package.json` line 22: `@radix-ui/react-slot` `^1.0.2` → `^1.3.3`
- [x] 1.6 Edit `package.json` line 23: `@radix-ui/react-toast` `^1.2.1` → `^1.2.23`
- [x] 1.7 Run `pnpm install` to regenerate `pnpm-lock.yaml`; confirm only dependency key changes

## Phase 2: Verification

- [x] 2.1 Audit `pnpm-lock.yaml`: one app-level copy each of `react-primitive@2.1.10` and `react-slot@1.3.3`; old `1.0.3`/`1.0.2` line only under `cmdk@1.0.0`
- [x] 2.2 Confirm `cmdk@1.0.0` and its pinned old Radix subtree remain untouched (out of scope)
- [x] 2.3 Run `pnpm exec tsc --noEmit` — must pass
- [x] 2.4 Run `pnpm lint` — must pass
- [x] 2.5 Run `pnpm build` — must pass

## Phase 3: Manual Smoke (no test runner)

- [x] 3.1 `pnpm dev`; Forms `/login`, `/register`, `/exercises` — focus inputs, submit empty/invalid; expect no `Accessing element.ref` console warning
- [x] 3.2 Dialog: `/workouts/create` → open/close `DialogAddExercise` via overlay and `X` — no warning
- [x] 3.3 Popovers: `SummaryWorkoutForm` (workout-create) and `AddExerciseForm` (exercise-add) — no warning
- [x] 3.4 Select + Icon asChild: `/exercises` muscle-group Select — no warning
- [x] 3.5 Button asChild: `/exercises` exercise-row action button — no warning
- [x] 3.6 Toasts: trigger success/error toast from `LoginForm`, `RegisterForm`, `SummaryWorkoutForm`, `CreateExerciseForm`, `UpdateExerciseForm` — no warning
- [x] 3.7 Command palette (cmdk subtree): exercise-add command palette — no warning (proves old subtree stays dormant)

## Phase 4: Cleanup / Documentation

- [x] 4.1 Verify `git diff` touches only `package.json` + `pnpm-lock.yaml`; no `src/components/ui/*` changes
- [x] 4.2 Commit as single dependency-only bump (conventional commit); note `cmdk` follow-up in message
