# Exploration: Runtime Zod validation for `createExercise`

## Current State

- `src/actions/exercise/create-exercise.ts` receives `CreateExerciseFormData` (a type **inferred** from the form's local Zod schema) but performs **no runtime parse**. The inferred TS type is erased at runtime, so malformed or tampered input reaches `prisma.exercise.create` — violating CLAUDE.md hard rule #5.
- Errors are silently swallowed: `catch (error) { console.error(error); }` returns `undefined`. The form's `onSubmit` awaits the action and, since nothing throws, shows the SUCCESS toast and redirects even when the create failed.
- `tag` is derived in the action as `name.toLowerCase().replace(/\s/g, "-")` — never taken from client input (good), but with no uniqueness check.
- Prisma schema facts: `Exercise.tag` has **no** unique constraint; `Exercise.name` **is** globally `@unique` (a cross-user name collision throws P2002); `muscleGroupTag` has an FK to `MuscleGroup.tag` (invalid tags fail only at the DB layer with a raw error).
- `src/components/exercise/CreateExerciseForm.tsx` defines `CreateExerciseSchema` inside the component file (`exerciseName` min 4, `description?`, `muscleGroup` min 1; Spanish messages) and exports `CreateExerciseFormData = z.infer<...>` — the only consumer of that type is the action.
- Precedent to mirror: `src/lib/schemas/workout-set.ts` (shared schema) + `src/actions/workout/update-set.ts` (`safeParse` → early `{ ok: false }` return, auth check first) + co-located vitest `workout-set.test.ts` (Stage-1 pure units).

### Input shape the action MUST accept

`{ name: string (min 4), description?: string, muscleGroupTag: string (min 1) }` — DB-aligned keys, not the form's UI names. `tag` is **derived server-side only**, never accepted from input.

### Validations needed

1. `name` length (min 4, matching the form) and type.
2. `description` optional string.
3. `muscleGroupTag` non-empty **and** a known `MuscleGroup.tag` (pre-check for a clean error code; FK is the safety net).
4. Derived `tag` non-empty (follows from min-4 name) and **unique per user** — `findFirst({ where: { tag, userId } })` before create.

## Affected Areas

- `src/lib/schemas/exercise.ts` — NEW shared schema + `CreateExerciseInput` type.
- `src/actions/exercise/create-exercise.ts` — MODIFIED: runtime parse, existence + uniqueness checks, discriminated-union return.
- `src/components/exercise/CreateExerciseForm.tsx` — MODIFIED: drop local schema, map fields, handle union.
- `src/lib/schemas/exercise.test.ts` — NEW vitest unit tests.

## Approaches

1. **DB-aligned shared schema + action-side checks** — schema in `src/lib/schemas/exercise.ts` with `name`/`description?`/`muscleGroupTag`; action: auth → `safeParse` → muscle-group exists → per-user tag unique → create → `{ ok: true, exercise } | { ok: false, code }`.
   - Pros: server contract decoupled from UI naming; mirrors `update-set.ts`; per-code errors reach the form; schema unit-testable without DB.
   - Cons: form needs a small field-mapping adapter on submit.
   - Effort: Low

2. **Form-shaped schema reuse** — keep `exerciseName`/`muscleGroup` keys in the shared schema.
   - Pros: minimal form churn.
   - Cons: couples the server contract to UI field names; weaker separation.
   - Effort: Low

3. **DB unique-constraint migration** (deferred, out of scope) — `@@unique([userId, tag])`.
   - Pros: eliminates the TOCTOU race definitively.
   - Cons: migration + data-backfill risk; explicitly deferred by scope decision.
   - Effort: Medium

## Recommendation

**Approach 1.** It closes the hard-rule gap with the established `update-set.ts` pattern, keeps the action from trusting the form's inferred type, and the discriminated union replaces the silent error swallow. The form keeps its own resolver-shaped validation (fields still named `exerciseName`/`muscleGroup`) and maps to the action contract on submit. Per-user tag uniqueness is enforced with `findFirst` before create; a `duplicate_tag`-style error code surfaces it. The `error` catch-all must map Prisma P2002 (global `name @unique`) to a code instead of `console.error` + `undefined`.

## Risks

- Changing the action's return shape breaks the form — mitigation: handle both union branches in `onSubmit`, never swallow.
- Derived `tag` may collide (no DB constraint; TOCTOU between check and create) — accepted risk, documented in the proposal; `findFirst` per user is the chosen approach.
- Extracting the schema must not break `useForm`'s resolver — mitigation: keep form field names stable, type-check, and cover the schema with unit tests.

## Ready for Proposal

Yes — scope, approach, and the discriminated-union contract are confirmed. Tell the user: the action will stop returning `Exercise | undefined` and start returning `{ ok: true, exercise } | { ok: false, code }`, and the form will show real per-code errors; the TOCTOU race on `tag` is the accepted trade-off for skipping the DB migration.