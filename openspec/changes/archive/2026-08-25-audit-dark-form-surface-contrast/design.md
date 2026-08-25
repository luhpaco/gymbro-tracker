# Design: Audit Dark Form Surface Contrast

## Technical Approach

Keep the change presentation-only and limited to authenticated desktop and mobile evidence from `/workouts/create`. Apply the smallest semantic-token, shared-primitive, and route-consumer class changes needed for the outlined `Registrar ejercicio` trigger, open calendar and selected date/icon, exercise-added metadata, intentional empty pending reservation, and `Guardar entrenamiento` action. Screenshot validation covers only these named states; it does not require an exhaustive caller audit, all-control inventory, or computed contrast-ratio matrix.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Route-local overrides only | Narrow blast radius, but duplicates state styling already owned by shared primitives | Use only where the date value/icon or summary metadata is route-specific. |
| Targeted semantic tokens and primitive classes | Shared styles can affect other consumers | Use for primary, outline, boundary, and calendar states because those owners already define the rendered presentation; keep edits minimal and validate the named route states. |
| New theme or behavioral component variants | Greater isolation, but expands APIs and scope | Reject because the proposal preserves the dark-only identity and existing behavior. |

## Data Flow

    /workouts/create page
      ├─ DialogAddExercise → outline Button (`Registrar ejercicio`)
      └─ SummaryWorkout
           ├─ exercise metadata + empty pending reservation
           └─ SummaryWorkoutForm → date Button → Popover → Calendar
                                  └─ primary Button (`Guardar entrenamiento`)

Only presentation ownership changes. Exercise state, calendar selection, validation, submission, routing, server actions, and persisted data flow remain unchanged.

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/globals.css` | Modify | Adjust only semantic colors and the dashed ghost-slot boundary needed by the named primary and pending-reservation states. |
| `src/components/ui/button.tsx` | Modify | Make the shared outline foreground and primary presentation legible without changing variants, events, or disabled behavior. |
| `src/components/ui/calendar.tsx` | Modify | Keep open-calendar navigation, disabled dates, and selected-day presentation legible without changing DayPicker behavior. |
| `src/components/workout/SummaryWorkout.tsx` | Modify | Clarify exercise-added labels and the intentionally empty, bounded `pending` reservation. |
| `src/components/workout/SummaryWorkoutForm.tsx` | Modify | Apply explicit selected-date value/icon presentation while preserving the popover and submission logic. |

`src/components/workout/DialogAddExercise.tsx` and `src/app/(routes)/workouts/create/page.tsx` require no changes: they already compose the outlined trigger and named route flow.

## Interfaces / Contracts

No TypeScript, API, schema, route, validation, event, Zustand, server-action, or Radix/shadcn behavior contract changes. Existing component props and form values remain unchanged. The only contract added is visual: the named states MUST remain legible on dark surfaces, and the empty reservation MUST remain visibly bounded and contain no fabricated workout data.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static | Presentation-only boundary and build health | Confirm no diff in `src/actions/`, `src/data/`, `prisma/`, middleware, or route handlers; run `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`. |
| Browser | Named authenticated desktop states | Capture `/workouts/create` with the trigger and primary action, open selected calendar/date/icon, and exercise-added metadata plus empty pending reservation. |
| Browser | Named authenticated mobile states | Repeat the same named evidence at a mobile viewport and verify no clipping or loss of legibility. |
| Behavior | Existing interactions | Confirm trigger opening, date selection/closing, exercise state, validation, keyboard interaction, and submission outcomes are unchanged. |

No automated test runner exists. Missing any named state or viewport screenshot leaves visual validation incomplete.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary changes.

## Migration / Rollout

No migration or feature flag is required. Roll back the isolated presentation changes if authenticated evidence regresses a named state.

## Open Questions

None.
