# Tasks: Audit Dark Form Surface Contrast

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated authored changed lines | 20–80 |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Remediate the five named surfaces and close out with authenticated screenshots | Single PR | `pnpm lint && pnpm exec tsc --noEmit && pnpm build` | Authenticated `/workouts/create` at mobile and desktop viewports | Revert only the five in-scope files; exclude the separated files below |

## Phase 1: Scope Reconciliation

- [x] 1.1 Limit audit evidence to `src/app/globals.css`, `src/components/ui/button.tsx`, `src/components/ui/calendar.tsx`, `src/components/workout/SummaryWorkout.tsx`, and `src/components/workout/SummaryWorkoutForm.tsx`.
- [x] 1.2 Assign the out-of-scope changes in `src/components/exercise/{CreateExerciseForm,UpdateExerciseForm}.tsx`, `src/components/ui/{command,input,select,textarea}.tsx`, and `src/components/workout/AddExerciseForm.tsx` exclusively to `shared-form-state-contrast`; do not treat them as completed audit work.

## Phase 2: Named Surface Remediation

- [x] 2.1 Source diff shows only semantic token and pending-boundary presentation changes in `src/app/globals.css`.
- [x] 2.2 Source diff shows presentation-only class changes in `src/components/ui/button.tsx` and `src/components/ui/calendar.tsx`; no variant, event, navigation, or selection logic diff is present.
- [x] 2.3 Source diff shows presentation-only metadata/pending-reservation and selected-date value/icon changes in `SummaryWorkout.tsx` and `SummaryWorkoutForm.tsx`; no prop or form-value logic diff is present.

## Phase 3: Screenshot and Behavior Closeout

- [x] 3.1 Supplied authenticated mobile screenshots cover the initial page, open calendar, selected date/icon, and exercise-added metadata/pending reservation; the named states are legible.
- [x] 3.2 Supplied authenticated desktop screenshots cover the same named states; no exhaustive inventory or computed-ratio claim is added.
- [x] 3.3 Confirm the protected logic-path diff is empty for server/data/Prisma/middleware/route boundaries. This is source-diff evidence only and does not claim runtime interaction verification.
- [x] 3.4 `git diff --check`, `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` exited 0; exact outcomes are recorded in `contrast-evidence.md`. Threat matrix is N/A, so no RED tasks are required.

## Phase 4: Cleanup

- [x] 4.1 Record the two-viewport screenshot closeout and five-file rollback boundary; leave the seven separated shared form-state files to their own change.
