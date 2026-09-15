# Design: Workouts Empty State & Persistent CTA

## Technical Approach

Single-file inline fix in `WorkoutsSection.tsx` mirroring the `ExerciseSection` pattern: persistent `Button asChild > Link` CTA above the list plus a ternary empty-state block on `workoutsToDisplay.length === 0`. Spec copy pinned verbatim; component stays a React Server Component.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Inline JSX in `WorkoutsSection` vs new shared `EmptyState` component | Shared component is DRY but premature at 2 consumers with divergent copy shapes (exercises: filter-scoped + dynamic href; workouts: generic + static href) | Inline — zero new abstractions, smallest diff |
| Static `/workouts/create` href vs dynamic query param | Exercises appends `?muscleGroup=` when a filter is active; workouts has no filter so a param adds dead complexity | Static href `/workouts/create` for both CTA and inline link |
| Ternary on `.length === 0` vs early return | Early return would skip the persistent CTA in the empty case, violating the spec | Ternary inside the list container so the CTA always renders |

## Data Flow

`page.tsx` (auth guard + `getWorkouts`) ──→ `WorkoutsSection({ workoutsToDisplay })` ──→ CTA (static link) + ternary: cards | empty-state block. No state, no store, no refetch.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/app/(routes)/workouts/components/WorkoutsSection.tsx` | Modify | Add persistent CTA + conditional empty-state ternary; reuse existing `Button`, `Link`, `TornStrip` imports |
| `src/app/(routes)/workouts/page.tsx` | None | Unchanged — CTA lives inside the section |
| `src/app/(routes)/exercises/components/ExerciseSection.tsx` | None | Reference only, untouched |

## Interfaces / Contracts

No new types or APIs. Existing contract unchanged:

```tsx
interface Props {
  workoutsToDisplay: WorkoutToDisplay[];
}
```

Resulting JSX shape (structure only, copy pinned by spec):

```tsx
<section className="flex flex-col gap-4 mt-6">
  <Button asChild>
    <Link href="/workouts/create">Crear entrenamiento</Link>
  </Button>
  <div className="flex flex-col gap-4">
    {workoutsToDisplay.length > 0 ? (
      workoutsToDisplay.map((workout) => (/* existing TornStrip card, unchanged */))
    ) : (
      <>
        <p>No has creado ningún entrenamiento todavía...</p>
        <p>¡Anímate <Link href="/workouts/create" className="underline font-semibold">a crear uno!</Link></p>
      </>
    )}
  </div>
</section>
```

Constraints: no `"use client"`, no hooks, no event handlers; `Button`/`Link` imports already present. Card JSX byte-for-byte identical in the non-empty branch.

## Testing Strategy

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Unit | n/a (no logic extracted; Stage 1 covers pure units only) | None |
| Integration | n/a (Stage 3 Postgres tests not implemented) | None |
| E2E (manual) | CTA visible with and without workouts; empty copy verbatim; no cards when empty; cards unchanged when present | Seed empty + seeded DB, visual check |
| Gates | `pnpm build`, `pnpm lint` clean; file contains no `"use client"` | CI / verify |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration required. Rollback: revert the single file.

## Open Questions

None. Copy, structure, and boundary are pinned by proposal + spec.
