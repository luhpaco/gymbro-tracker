## Exploration: workout-edit-delete (F0.2 · edit and delete saved workouts)

### Current State

Workouts are create-only plus single-field set edits. `createWorkout` (`src/actions/workout/create-workout.ts`) validates with `AddWorkoutFormSchema`, derives the tag server-side via `buildWorkoutTag`, assigns set order server-side via `buildSetsForCreate`, and resolves same-owner tag collisions with a bounded suffix retry (`-2`…`-10`, `MAX_TAG_ATTEMPTS = 10`). `updateSet` (`src/actions/workout/update-set.ts`) is the ONLY mutation after creation and edits just `weight`/`reps` of one set, with ownership enforced through `prisma.set.findFirst({ where: { id, workout: { userId } } })`. Reads are `getWorkoutBySlug` (owner-scoped `userId_tag` lookup) and `getWorkouts`, both returning sets sorted by `SET_ORDER_BY` and grouped by exercise. The detail page `src/app/(routes)/workouts/[slug]/page.tsx` routes directly by tag. There is NO delete-workout, delete-set, update-workout, or add-set action, NO confirm/alert-dialog primitive, and NO `update-set.test.ts`.

### Affected Areas

- `src/actions/workout/` — new actions live here (`delete-workout`, `delete-set`, `update-workout`, `add-sets` or similar); existing: `create-workout.ts`, `update-set.ts`, `get-workout-by-slug.ts`, `get-workouts.ts`
- `src/lib/workout-tag.ts` — `buildWorkoutTag`, `nextTagCandidate`, `isWorkoutTagCollision`, `MAX_TAG_ATTEMPTS`; tag derivation and collision semantics
- `prisma/schema.prisma` — `Workout` (`@@unique([userId, tag])`), `Set` (`@@index([workoutId, order])`, no `onDelete`, no `updatedAt`); FKs are `ON DELETE RESTRICT` per `prisma/migrations/20240710014202_create_set_table_and_relations/migration.sql`
- `src/app/(routes)/workouts/[slug]/page.tsx` — RSC detail page routing by tag; rename semantics decide URL stability
- `src/components/workout/WorkoutDetailSets.tsx` — client component; needs add/remove-set and remove-exercise controls alongside existing `EditableStat` editors
- `src/app/(routes)/workouts/components/WorkoutsSection.tsx:53` — list links `/workouts/${workout.tag}`
- `src/lib/breadcrumbs.ts`, `src/lib/breadcrumb-trails.ts` — `[slug]` labels resolve via `getWorkoutBySlug`
- `src/components/ui/dialog.tsx` — Radix Dialog primitive (bottom-sheet usage in `AuthenticatedNavigationShell.tsx:201`); the confirmation UI would be a NEW composition, not a reuse
- `src/app/(routes)/exercises/components/ExerciseSection.tsx` — destructive-button + toast + `router.refresh()` pattern to mirror
- `src/actions/exercise/set-exercise-active-state.ts` — coded-union + ownership pattern to mirror
- `src/lib/schemas/workout.ts`, `src/lib/schemas/workout-set.ts` — Zod schemas new actions must reuse/extend
- `openspec/specs/workout-tag-uniqueness/spec.md`, `openspec/specs/workout-set-ordering/spec.md` — binding constraints (immutable tag; gap-tolerant non-unique order)

### Approaches

1. **Immutable tag on rename (spec-mandated)** — update only `name`/`date`; never recompute `tag`.
   - Pros: zero uniqueness risk; existing `/workouts/[slug]` URLs, bookmarks, and breadcrumbs keep working; simplest update action (no retry loop); directly complies with `workout-tag-uniqueness` ("stored tag MUST NOT be recomputed")
   - Cons: tag cosmetically drifts from name/date (tag becomes opaque slug, which it already is after any `-N` suffix)
   - Effort: Low

2. **Recompute tag on rename with collision retry** — rebuild `buildWorkoutTag(newName, newDate)` and reuse the `-2…-10` retry on `P2002`.
   - Pros: tag stays descriptive of current name/date
   - Cons: breaks existing URLs (old slug 404s to `/workouts` list redirect); needs retry logic on the update path; suffix churn; needs redirect mapping or stale-link handling; contradicts the durable spec
   - Effort: Medium

3. **Application-level cascade delete (no migration)** — ownership-checked `findFirst`, then `prisma.$transaction([deleteMany sets, delete workout])`.
   - Pros: no schema migration; explicit and auditable; ownership check precedes any write; matches ticket scope
   - Cons: two writes per delete; every future delete path must remember the pattern
   - Effort: Low

4. **Schema-level cascade (`onDelete: Cascade` on `Set.workoutId`) + single delete** — one migration changing the FK, then `prisma.workout.delete`.
   - Pros: single write; DB guarantees no orphans
   - Cons: requires a new migration; changes delete semantics globally; identical irreversible data-loss profile as option 3 with more ceremony
   - Effort: Medium

5. **Confirmation UX: new bottom-sheet confirm dialog** — compose Radix `Dialog` (existing `src/components/ui/dialog.tsx`) in the mobile bottom-sheet style of `AuthenticatedNavigationShell.tsx:201` (bottom-anchored, safe-area padding, `min-h-11` touch targets) for workout delete; per-row inline confirm or dialog for set delete.
   - Pros: satisfies ticket's "con confirmación"; one-hand mobile friendly; consistent with existing mobile patterns
   - Cons: NEW component (no `AlertDialog` exists in repo — grep confirms zero matches); needs new tests/harness (no component/DOM tests exist yet — Stage 1 only)
   - Effort: Medium

### Recommendation

- **Tag: option 1 (immutable).** The durable spec is explicit — "Once a workout is created, its stored tag MUST NOT be recomputed, so existing URLs remain valid" — and the archived F0.1 report already flags F0.2 to keep the tag immutable (optionally routing by `id` later). Present option 2 in design only to record why it was rejected.
- **Delete: option 3 (app-level transaction) as default**, option 4 as the design-phase alternative. Both satisfy the ticket; option 3 avoids a migration for a change that otherwise needs none. Soft delete is NOT recommended: the ticket says "borrar", no restore UI is decided, and it would leak an `isActive` filter into every read path.
- **New actions mirror `setExerciseActiveState`** (`src/actions/exercise/set-exercise-active-state.ts`): validate in order session → Zod → ownership (`findFirst` with `userId`) → write; return coded unions (`unauthorized | invalid_input | not_found | error`); `revalidatePath` the detail path AND `/workouts` on success. Note `updateSet` returns a codeless `{ ok: boolean }` — design must decide whether new actions adopt codes (recommended) and whether `updateSet` is aligned.
- **Order for added sets:** assign `max(existing order) + 1` per new set (never recount from zero); gaps and duplicates are tolerated by `workout-set-ordering` but avoiding collisions keeps the total sort deterministic. Design must also decide: removing the last set/exercise of a workout (creation invariant requires ≥1 exercise / ≥1 set — block, allow empty, or cascade to workout delete?).

### Risks

- **Tag recompute would break URLs and violate a durable spec** — any rename design that touches `tag` needs explicit user sign-off against `workout-tag-uniqueness`.
- **Hard delete is irreversible and currently FK-blocked** — `ON DELETE RESTRICT` on `Set.workoutId` means a naive `prisma.workout.delete` throws; the change MUST delete sets first or migrate. No cascade exists today.
- **No confirmation primitive exists** — `ExerciseSection` deletes with NO confirmation; the ticket requires one, so new UI + new test approach (no jsdom/Testing Library installed) is needed.
- **Ownership must be enforced per action** — `getWorkoutBySlug` takes `userId` as a parameter and does no auth; mutations MUST follow the `updateSet`/`setExerciseActiveState` pattern (session inside the action, `findFirst` scoped by `userId`, `not_found` covering missing-or-foreign to avoid enumeration).
- **Empty-workout edge** — deleting all sets/exercises of a workout collides with the ≥1 exercise/≥1 set creation invariant; undefined behavior today.
- **Exercise-picker scope for "add sets to a saved exercise"** — design must decide whether new sets can reference any exercise id (ownership + `isActive` check needed — inactive exercises are hidden from pickers but still own history) and how `order` interleaves with existing rows.
- **`updateSet` has no test file** — the established mock pattern (`vi.hoisted` + `vi.mock("@/auth")` + `vi.mock("@/lib/prisma")` + `vi.mock("next/cache")`, see `src/actions/exercise/create-exercise.test.ts:1-42`) applies directly, but ownership (`not_found`-style) tests for workout mutations are new ground the ticket explicitly requires.

### Ready for Proposal

Yes — with two decisions the design phase MUST present as options (not silently pick): (1) tag immutability vs recompute (evidence strongly favors immutability per the durable spec); (2) app-level transaction vs `onDelete: Cascade` migration for set cleanup, plus the confirmation UX shape (bottom-sheet dialog vs inline confirm). All other findings are ready to feed proposal scope directly.
