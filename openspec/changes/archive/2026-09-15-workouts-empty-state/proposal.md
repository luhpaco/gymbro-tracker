# Proposal: Workouts Empty State & Persistent CTA

## Intent

`/workouts` renders a blank section when the user has no workouts — no message, no way to create one. The exercises route already solves this with a persistent "Crear ejercicio" button and a conditional empty-state message. This change closes the gap on `/workouts` using the same proven in-repo pattern.

## Scope

### In Scope
- Persistent "Crear entrenamiento" CTA button at the top of `WorkoutsSection`
- Conditional empty-state message when `workoutsToDisplay.length === 0` with inline CTA link to `/workouts/create`
- Copy in neutral Spanish matching the exercises route tone (generic — no filter context)

### Out of Scope
- Dashboard strips empty state (separate gap, different context — summary page vs management list)
- Shared `EmptyState` component extraction (premature at 2 consumers with divergent copy shapes)
- `ExerciseSection` refactoring (reference only, untouched)
- `page.tsx` changes (CTA lives inside the section)

## Capabilities

### New Capabilities
- `workouts-empty-state`: Persistent create CTA + conditional empty-state message for the workouts list, mirroring the exercises route pattern.

### Modified Capabilities
None.

## Approach

Inline fix in `WorkoutsSection.tsx` reusing the `ExerciseSection` pattern:
1. Add `<Button asChild><Link href="/workouts/create">Crear entrenamiento</Link></Button>` above the list.
2. Wrap the `.map()` in a ternary: when `workoutsToDisplay.length === 0`, render a `<p>` message + inline `<Link>` CTA.
3. Component stays a server component — no `"use client"` needed (CTA is plain markup, no interactivity).

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/app/(routes)/workouts/components/WorkoutsSection.tsx` | Modified | Add persistent CTA + conditional empty-state block |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Copy tone mismatch with exercises route | Low | Mirror exact structure: "No has creado ningún entrenamiento todavía..." + "¡Anímate a crear uno!" with underline link |
| Accidentally making it a client component | Low | CTA uses `Button asChild > Link` (server-safe); no hooks or interactivity needed |

## Rollback Plan

Revert the single-file change to `WorkoutsSection.tsx`. No data, schema, or route changes involved.

## Dependencies

None. Creation route `/workouts/create` already exists.

## Success Criteria

- [ ] `/workouts` shows a "Crear entrenamiento" button when the user has workouts
- [ ] `/workouts` shows a friendly empty-state message + inline CTA link when the list is empty
- [ ] `WorkoutsSection` remains a server component (no `"use client"` directive)
- [ ] `pnpm build` and `pnpm lint` pass
