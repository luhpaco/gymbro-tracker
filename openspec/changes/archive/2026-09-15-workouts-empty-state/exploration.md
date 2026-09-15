# Exploration: workouts-empty-state

Topic: `/workouts` has no empty state or CTA to create a workout when the list is empty (Notion — Tipo Bug, Prioridad Media).

Date: 2026-09-15

## Current State

`/workouts` (server component) fetches via `getWorkouts` and renders `WorkoutsSection`:

- `src/app/(routes)/workouts/page.tsx` — auth guard + `getWorkouts`, renders `<h1>Entrenamientos</h1>`, a subtitle, and `WorkoutsSection`.
- `src/app/(routes)/workouts/components/WorkoutsSection.tsx` — server component (no `"use client"`). Only maps `workoutsToDisplay` into `TornStrip` cards. When the array is empty the section renders **nothing**: no message, no CTA. The page then shows only the heading + subtitle, with an empty gap below.
- No global CTA exists either: `(routes)/layout.tsx` is a navigation shell + breadcrumbs, nothing pointing to `/workouts/create`.
- The creation route exists and is the natural CTA target: `src/app/(routes)/workouts/create/page.tsx` (`/workouts/create`, renders `WorkoutCreationForm`).

The reference pattern lives in the exercises route: `src/app/(routes)/exercises/components/ExerciseSection.tsx` is a **client** component that always renders a persistent `Crear ejercicio` button at the top (`<Button asChild><Link href={createHref}>`) and, when `filteredExercises.length === 0`, renders a conditional empty state: two `<p>` lines with an inline CTA link (`¡Anímate a crear uno!`). `createHref` is `/exercises/create` or `/exercises/create?muscleGroup=<tag>` when a filter is active.

Gap confirmed in `/workouts`: no persistent create CTA and no empty-state message.

## Affected Areas

- `src/app/(routes)/workouts/components/WorkoutsSection.tsx` — the only file that needs the fix (add persistent CTA + conditional empty state). Stays a server component; no client directive needed (CTA is a plain `Button asChild > Link`).
- `src/app/(routes)/workouts/page.tsx` — unchanged, unless the CTA is placed here instead of inside the section (not needed).
- `src/app/(routes)/exercises/components/ExerciseSection.tsx` — reference pattern only; only touched if Option B (shared component) is chosen and the exercises route is refactored.

## Route Audit (empty state + create CTA)

All list/creation pages under `src/app/(routes)/`:

| Route | Persistent create CTA | Empty-state message | Creation href | Notes |
|---|---|---|---|---|
| `/workouts` (list) | ❌ none | ❌ none | `/workouts/create` | **The bug.** Renders blank section when `workoutsToDisplay` is empty. |
| `/exercises` (list) | ✅ `Crear ejercicio` button (top of section) | ✅ "No has creado ningún ejercicio… ¡Anímate a crear uno!" | `/exercises/create` (+ `?muscleGroup=` when filter active) | Reference pattern. Empty state also covers the "filter matches nothing" case, not only "nothing created". |
| `/dashboard` (summary) | ❌ (has `TornStrip.Link` nav to `/workouts` and `/exercises`, not create CTAs) | ❌ both strips ("Últimos entrenamientos", "Resumen de tus ejercicios") render blank bodies when empty | n/a (summary page) | Same class of gap but different context (summaries, not management lists). Secondary; would need its own copy. |
| `/workouts/create` | n/a (form page) | n/a | — | CTA target. |
| `/exercises/create` | n/a (form page) | n/a | — | CTA target; supports `?muscleGroup=` preselect. |
| `/workouts/[slug]` (detail) | n/a | n/a | — | Not a list page. |
| `/exercises/update/[id]` | n/a | n/a | — | Not a list page. |
| `/` (root) | n/a | n/a | — | Placeholder `<h1>Home</h1>`, not a list page. |

## Approaches

1. **Reuse the ExerciseSection pattern (inline in WorkoutsSection)** — add a persistent `<Button asChild><Link href="/workouts/create">Crear entrenamiento</Button>` above the list and a conditional empty-state block (`workoutsToDisplay.length === 0`) with a message + inline CTA link, mirroring the exercises copy style.
   - Pros: Zero new abstractions; smallest diff; identical UX to the exercises route the user already knows; server component stays server; copy can be tuned per-route (workouts has no muscle-group filter, so the message is generic, unlike exercises).
   - Cons: Duplicates empty-state JSX between two routes (mild DRY concern); if a third consumer appears, drift risk.
   - Effort: Low.

2. **New shared `EmptyState` component** (e.g., `src/components/ui/empty-state.tsx`) with props like `message`, `ctaLabel`, `ctaHref`; use it in WorkoutsSection and optionally refactor ExerciseSection to use it too.
   - Pros: DRY; single place to evolve copy/design; ready for the dashboard strips and future routes.
   - Cons: Larger diff and expanded scope (refactoring exercises touches a working route); needs API design before it pays off; the two current consumers have meaningfully different copy shapes (exercises: filter-scoped message + dynamic href; workouts: static), so the abstraction must be flexible or it becomes a prop-juggling shell; premature with only 2 consumers.
   - Effort: Medium.

## Recommendation

**Option 1 (reuse the ExerciseSection pattern) for the fix.** The bug is a single-route gap with a proven in-repo pattern; a shared component does not yet earn its keep at 2 consumers with divergent copy shapes. If the dashboard strips get fixed in the same effort (not part of this Notion bug), revisit Option 2 — a shared `EmptyState` would then have 3+ consumers and justify the extraction. Workouts empty-state copy should be generic (no filter context): something like "No has creado ningún entrenamiento todavía… ¡Anímate a crear uno!" linking to `/workouts/create`.

## Risks

- Copy inconsistency: must match the existing Spanish, neutral, motivational tone of the exercises empty state; no persona/slang injection.
- The workouts page has no filter, so the empty state means "no workouts created" (unlike exercises, where it also covers "filter matches nothing") — the message must not claim a filter context.
- Do not accidentally make `WorkoutsSection` a client component; the CTA works as a plain server-rendered `Button asChild > Link` (same as exercises' button markup, minus the client-only filter logic).
- Out of scope (flagged, not for this fix): `/dashboard` strips and the create pages' lack of a page-level auth guard (create pages rely on action-level auth; list pages already guard, so CTA users are authenticated).

## Ready for Proposal

Yes. The orchestrator can tell the user: gap confirmed at `/workouts`, single-file fix in `WorkoutsSection.tsx` reusing the exercises pattern (persistent CTA + conditional empty state), low effort, no new components. Audit found only `/dashboard` with the same class of gap (secondary, different context).