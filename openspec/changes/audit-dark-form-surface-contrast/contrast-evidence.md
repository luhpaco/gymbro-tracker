# Dark Form Surface Contrast Evidence

## Acceptance Boundary

- **Route:** authenticated `/workouts/create` only.
- **Viewport classes:** mobile and desktop.
- **Accepted evidence:** user-supplied authenticated screenshots for the initial page, open calendar, selected date and icon, and exercise-added metadata state at both viewport classes.
- **Result:** the supplied screenshots confirm that every named state is legible. The initial-page screenshots cover the outlined `Registrar ejercicio` trigger and primary `Guardar entrenamiento` action; the exercise-added screenshots cover the metadata and intentionally empty `PENDING` reservation.

## Screenshot Coverage

| Named state | Mobile screenshot | Desktop screenshot | Result |
|---|---|---|---|
| Initial page: outlined trigger and primary action | Supplied | Supplied | Legible |
| Open calendar | Supplied | Supplied | Legible |
| Selected date value and calendar icon | Supplied | Supplied | Legible |
| Exercise-added metadata and empty `PENDING` reservation | Supplied | Supplied | Legible |

The `PENDING` reservation is intentionally empty. The screenshots show its boundary and tag as clear; they do not indicate missing workout data.

## Source-Diff Reconciliation

The audit-owned source diff is limited to these five presentation files:

| File | Evidenced presentation change |
|---|---|
| `src/app/globals.css` | Semantic primary, destructive, and input tokens plus the dashed pending-reservation boundary token. |
| `src/components/ui/button.tsx` | Outline foreground and disabled presentation classes. |
| `src/components/ui/calendar.tsx` | Disabled navigation and day presentation classes. |
| `src/components/workout/SummaryWorkout.tsx` | Card-context metadata foreground classes. |
| `src/components/workout/SummaryWorkoutForm.tsx` | Explicit selected-date value and calendar-icon foreground classes. |

The protected-path diff is empty for `src/actions/`, `src/data/`, `prisma/`, `src/middleware.ts`, route handlers under `src/app/api`, and pages under `src/app/(routes)`. This source-diff result supports the presentation-only boundary; it is not a runtime interaction test.

## Excluded Shared Slice

The seven shared form-state files belong only to `shared-form-state-contrast` and are excluded from this audit: `src/components/ui/{command,input,select,textarea}.tsx`, `src/components/exercise/{CreateExerciseForm,UpdateExerciseForm}.tsx`, and `src/components/workout/AddExerciseForm.tsx`. Their changed source is not treated as audit completion evidence.

## Runtime and Harness Disposition

- The authenticated screenshots are user-supplied visual evidence, not a browser harness operated by this audit reconciliation.
- The orchestrator-owned sole runtime attempt was neither acquired nor settled here.
- No server or browser process was started, stopped, or automated here.
- No computed contrast ratios, exhaustive control inventory, validation, submission, keyboard, or calendar-interaction result is inferred from the screenshots.

## Static Verification

| Command | Result |
|---|---|
| `git diff --check` | Exit 0; no output. |
| `pnpm lint` | Exit 0; one existing `react-hooks/exhaustive-deps` warning in `src/app/auth/login/ui/LoginForm.tsx:65`. |
| `pnpm exec tsc --noEmit` | Exit 0; no output. |
| `pnpm build` | Exit 0; compiled successfully. It repeated the existing LoginForm warning and reported `DYNAMIC_SERVER_USAGE` diagnostics while classifying `/workouts/create` and `/exercises` as dynamic routes. |

## Rollback Boundary

Revert only the five audit-owned presentation files listed above and this audit documentation. Keep the seven excluded shared form-state files with `shared-form-state-contrast`; do not revert or claim them as part of this audit.
