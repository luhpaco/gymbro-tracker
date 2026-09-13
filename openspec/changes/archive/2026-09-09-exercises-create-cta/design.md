# Design: Exercises Create CTA with Muscle-Group Pre-scoping

## 1. Architecture Summary

Small extension of the existing Next.js 15 / RSC / Zustand / server-actions pattern. No new packages, no schema/migration. Five files touched (one of them a new test). The new capability lives entirely at the presentation boundary (CTA + query-param prefill) and at one piece of client state (`selectedMuscleGroup`).

Layer responsibilities, unchanged:

- **RSC** (`/exercises/page.tsx`, `/exercises/create/page.tsx`) — fetch, render, read `searchParams` (async per Next 15), validate untrusted input server-side.
- **Client components** (`ExerciseSection`, `FilterExercises`, `CreateExerciseForm`) — interactivity, RHF forms, href derivation.
- **Zustand store** (`useExercisesStore`) — single source of truth for the filter that produced the visible list.
- **Server actions** (`createExercise`, `getMuscleGroups`) — unchanged; the existing `createExercise` runtime-validation gap is out of scope.

## 2. Decisions

### D1. `selectedMuscleGroup` lives in the Zustand store, written only on `filterExercises` submit

**Rationale.** The store is the only place where "the filter that produced the visible list" is already canonical. Lifting to a component (`useState` in `ExerciseSection`) duplicates the logic the store already runs, refactors `FilterExercises`'s API, and complicates Stage-1 unit testing. The draft-vs-submitted divergence is resolved by writing the field only inside `filterExercises` (which is called by RHF `onSubmit`), never inside `FilterExercises`'s `onValueChange` handler.

**Encoding.** Reuse the same convention the form already uses: `""` or `"all"` ⇒ no filter active. `ExerciseSection` treats any value other than `""`/`"all"` as "active filter" and builds `?muscleGroup=<tag>` accordingly.

**Rejected alternatives.**
- *Lift to `ExerciseSection` via controlled props* — refactors `FilterExercises`, duplicates store logic, no benefit.
- *Read form value via ref/imperative handle* — breaks sibling-component boundary, untestable, rejected.

### D2. `ExerciseSection` derives hrefs from the store, not from props

**Rationale.** Both the always-visible CTA and the empty-state link need the same data. Reading from the store means one expression, one place to fix. Reading from props would force the parent RSC to subscribe to a client store, which is impossible in RSC.

### D3. Create page validates the tag server-side against `getMuscleGroups()`

**Rationale.** The query param is user-controllable. The Radix `<Select>` paired with RHF `defaultValues` will hold whatever string we pass, but the underlying form will only submit a value that matches a `<SelectItem>`. If we pass an unknown tag, the visible `SelectValue` shows the placeholder while RHF's `muscleGroup` field holds the bogus string — Zod resolves to the placeholder with `value === ""`, but a future refactor that bypasses the Radix coercion could submit the raw string into `createExercise`. The belt-and-braces rule: validate against `getMuscleGroups()` server-side, pass `defaultMuscleGroup` only if the tag is in the known set, otherwise treat as no param.

**Why server-side, not client-side.** A client check would race a hand-edited URL. The trust boundary is the RSC. Also: validation is naturally adjacent to `searchParams` reading, which already lives in the RSC.

### D4. `CreateExerciseForm` accepts `defaultMuscleGroup?: string`; RHF seeds `defaultValues.muscleGroup` from it

**Rationale.** Mirrors the existing pattern of the component accepting its data via props (the muscle-group list is already passed in). Avoids touching the schema, the submit handler, or `createExercise`. Keeps the contract narrow and testable.

**Edge.** The form already does `defaultValue={field.value}` on the Radix `Select`, so the prop just needs to be wired into `useForm({ defaultValues: { muscleGroup: defaultMuscleGroup ?? "" } })`.

### D5. Always-visible CTA sits at the section header, not in the empty state

**Rationale.** Visibility on every render of `/exercises` is the entire point of the change. Placing it inside the empty state would silently re-break the populated case. The empty-state "Ánimate a crear uno" copy stays for context but no longer carries the only path forward.

## 3. Component Contract

| Surface | Kind | Change | Contract |
|---|---|---|---|
| `useExercisesStore` | Zustand store | +1 field, +0 in 1 fn | New `selectedMuscleGroup: string` state; `filterExercises(muscle)` now also `set({ selectedMuscleGroup: muscle })`; `setExercises` leaves the field untouched (an RSC remount produces a fresh list but the user's last filter is still the active intent). |
| `useExercisesStore` test | vitest | +2 cases | (a) `filterExercises('all')` ⇒ `selectedMuscleGroup === 'all'` and `filteredExercises` is the full list. (b) `filterExercises('chest')` ⇒ `selectedMuscleGroup === 'chest'` and only chest exercises remain. |
| `ExerciseSection` | client component | +1 link, +1 conditional on the empty-state link | Always renders a "Crear ejercicio" `<Button asChild><Link href={...}>` whose href is `/exercises/create?muscleGroup=<tag>` when `selectedMuscleGroup` is not `""`/`"all"`, else `/exercises/create`. The existing empty-state link uses the same expression. |
| `/exercises/create/page.tsx` | RSC | read + validate `searchParams` | `searchParams` is async (Next 15). Resolve, read `muscleGroup`, validate against `getMuscleGroups()` (compare by `tag`), pass `defaultMuscleGroup` to `CreateExerciseForm` iff the tag is known. Unknown / missing / `all` ⇒ no prefill. |
| `CreateExerciseForm` | client component | +1 optional prop | New `defaultMuscleGroup?: string`. Wire into `useForm({ defaultValues: { muscleGroup: defaultMuscleGroup ?? "" } })`. No other change. |

## 4. Flows

### Flow A — user filters to "Pecho", empty list, clicks "Ánimate a crear uno"

1. `FilterExercises` submits RHF form with `muscleGroup = "chest"`.
2. `onSubmit` calls `useExercisesStore.filterExercises("chest")` ⇒ store sets `selectedMuscleGroup = "chest"`, `filteredExercises = []`.
3. `ExerciseSection` re-renders empty state; the "Ánimate a crear uno" link now targets `/exercises/create?muscleGroup=chest`.
4. User clicks → `CreateExercisePage` RSC reads `searchParams.muscleGroup = "chest"`, fetches `getMuscleGroups()`, finds `"chest"` in the list, passes `defaultMuscleGroup = "chest"` to `CreateExerciseForm`.
5. `CreateExerciseForm` seeds `defaultValues.muscleGroup = "chest"`. The Radix `<Select>` shows "Pecho" pre-selected.

### Flow B — user filters to "Pecho", non-empty list, clicks always-visible "Crear ejercicio" CTA

1. Same as steps 1–2 of Flow A, but `filteredExercises` is non-empty.
2. `ExerciseSection` renders the CTA alongside the list; its href is `/exercises/create?muscleGroup=chest`.
3. Steps 4–5 of Flow A.

### Flow C — bogus tag in the URL

1. User navigates to `/exercises/create?muscleGroup=NOT_A_TAG`.
2. `CreateExercisePage` fetches `getMuscleGroups()`; the tag is not in the set.
3. `defaultMuscleGroup` is `undefined`; the form opens un-scoped, identical to the no-param case. Even if the user submits without picking, Zod fails on `muscleGroup.min(1)` — no bogus string can reach `createExercise`.

## 5. Verification Strategy per Spec Scenario

Stage-1 strict TDD covers only pure-logic units (vitest, `src/**/*.test.ts`). The orchestrator's spec phase flagged that the CTA rendering and the RSC pre-scoping cannot be unit-tested under that harness. Per-scenario coverage is therefore a mix of unit test, build/typecheck, and (Stage 2/3) integration tests that this change will not deliver.

| Spec scenario | Stage-1 unit (`pnpm test`) | Build/typecheck (`pnpm exec tsc --noEmit` + `pnpm build`) | Stage 2/3 (deferred) |
|---|---|---|---|
| CTA visible with populated list | — | TS check ensures `ExerciseSection` renders the CTA unconditionally | E2E render check |
| CTA visible with empty unfiltered list | — | TS check | E2E |
| CTA carries active filter | — | TS check (the conditional is in TSX) | E2E |
| Empty-state link reflects active filter | — | TS check | E2E |
| Empty-state link without a filter | — | TS check | E2E |
| Draft selection ≠ submitted filter | store test: `selectedMuscleGroup` is only set on `filterExercises`, not on `Select.onValueChange` | — | — |
| Valid tag pre-scopes the form | — | TS check (page reads `searchParams` and passes `defaultMuscleGroup`) | E2E / mock-RSC integration |
| Unknown tag is ignored | — | TS check; Zod's `min(1)` is the safety net | E2E with hand-edited URL |
| No parameter leaves the form un-scoped | — | TS check | E2E |

The Stage-2 integration test (mock `searchParams`, assert `defaultMuscleGroup` reaches the form) is the natural follow-up and is noted in the proposal as out-of-scope.

## 6. Risk Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Bogus `?muscleGroup=` URL value submitted as `muscleGroupTag` | Med | High (data integrity) | Server-side validation in the RSC before `defaultMuscleGroup` is passed; Zod `min(1)` on the form's `muscleGroup` field as belt-and-braces. |
| Select draft value vs last-submitted filter diverges and leaks into CTA | Med | Med (wrong prefill) | `selectedMuscleGroup` is written only inside `filterExercises`, which is called by RHF `onSubmit`. Draft changes via `Select.onValueChange` do NOT touch the store. Unit test pins the contract. |
| Regression on the existing empty-state copy | Low | Low | Copy is preserved verbatim; only the `<Link href>` is made conditional. |
| Store value survives across navigations to other pages and confuses a future feature | Low | Low | Out-of-scope to reset on unmount. Document in the design; revisit when a new feature needs filter persistence. |

## 7. Out-of-Scope Items (explicit non-goals, recorded for traceability)

- Runtime Zod validation in the `createExercise` server action (existing gap, separate backlog candidate).
- Filter persistence across navigation (URL sync, localStorage).
- Update/delete CTAs on `/exercises`.
- Refactor of `FilterExercises` to controlled-props pattern.
- Stage 2/3 integration tests for the RSC pre-scoping flow.

## 8. Rollback

Revert the single commit. No DB migration, no data risk. The store gains one field; reverting removes it. The CTA and pre-scoping vanish together.
