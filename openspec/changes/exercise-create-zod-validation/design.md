# Design: Runtime Zod Validation for Exercise Creation

## 1. Architecture Summary

Mirror the `workout-set.ts` / `update-set.ts` pattern already in the repo: a Zod schema lives in `src/lib/schemas/`, the server action parses and returns a discriminated union, the form maps UI fields to DB keys and handles both union branches explicitly. The change touches 4 files: 1 new schema, 1 new test, 1 modified action, 1 modified form. No DB migration, no new packages.

Layer responsibilities, unchanged:

- **`src/lib/schemas/exercise.ts`** (NEW) — pure Zod schema + inferred input type. No DB knowledge, no I/O, no side effects.
- **`src/actions/exercise/create-exercise.ts`** (MODIFIED) — `safeParse` first, then existence + uniqueness pre-checks, then `prisma.exercise.create`. Returns a discriminated union. No `console.error` swallow, no `return undefined`.
- **`src/components/exercise/CreateExerciseForm.tsx`** (MODIFIED) — keeps its RHF field names (`exerciseName`, `muscleGroup`) for UX, maps to schema keys on submit, handles both union branches with code-specific Spanish toasts.
- **`src/lib/schemas/exercise.test.ts`** (NEW) — vitest unit tests on the schema (accept / reject paths).

## 2. Decisions

### D1. Schema keys are DB-aligned (`name`, `muscleGroupTag`), NOT UI-aligned (`exerciseName`, `muscleGroup`)

**Rationale.** The form's field names exist for RHF's resolver. The schema exists to validate what reaches Prisma — so its keys must match the data model. The form is responsible for the UI→DB mapping at submit time, not the schema. This makes the schema reusable from any caller (server action, future API route, future CLI).

**Why not the reverse (form-style keys in the schema).** That would force the server action to translate before `prisma.create`, or accept UI-shaped input as the action's contract — both are wrong (UI vocabulary leaks into the data layer).

**Rejected alternative.** Define two schemas (form-schema + action-schema) with explicit translation. Duplication for no benefit — one schema with form-side mapping is simpler.

### D2. Schema is syntactic only; muscle-group existence is an action-side pre-check, not a schema refinement

**Rationale.** The spec already commits to this. The schema stays in pure-logic land (Stage-1 unit-testable, no DB mock). The action calls `prisma.muscleGroup.findUnique({ where: { tag } })` after parse and before create. This is the only way `pnpm test` can cover the schema without a DB fixture (the project has no Stage 2 harness).

**Rejected alternative.** Zod `.refine` calling a DB lookup. Couples the schema to Prisma; makes unit tests need mocks; complicates the inference. No upside.

### D3. Per-user tag uniqueness via `findFirst` before `create`, not via a DB constraint

**Rationale.** Adding `@@unique([userId, tag])` requires a migration. Out of scope per the proposal. The TOCTOU window between `findFirst` and `create` is accepted: the worst case is two users with the same tag creating a record at the same instant, and the global `name @unique` constraint would surface a P2002 on `create` regardless. Search-before-create is the pragmatic choice that ships without a migration.

**Risk acknowledged.** Concurrent same-user submissions of the same `name` could both pass the `findFirst` and only one will succeed via P2002. The losing user sees `{ ok: false, code: 'error' }` (the catch-all). For a single-user app this is essentially zero probability; for a multi-tenant migration it is a future concern.

### D4. Form keeps RHF field names `exerciseName` / `muscleGroup`; maps to `name` / `muscleGroupTag` on submit

**Rationale.** Touching the form's RHF field names ripples through `useForm({ defaultValues })`, `<FormField name="...">`, and `zodResolver(FormSchema)`. Mapping at submit time is a single object spread in `onSubmit`. The form's UX stays identical to today.

### D5. Form uses Spanish error toasts per code; success toast only on `{ ok: true, exercise }`

**Rationale.** The current form already shows toasts in Spanish and the user validated the change end-to-end on their local server. New messages must match the project's existing voice. The success toast MUST NOT appear on any failure code — that's the entire point of the discriminated union.

**Per-code Spanish messages (drafts, design will finalize; sdd-apply can refine if needed):**
- `unauthorized` → "Tu sesión expiró. Vuelve a iniciar sesión."
- `invalid_input` → "Revisa los datos del formulario e inténtalo de nuevo."
- `unknown_muscle_group` → "El grupo muscular seleccionado no es válido."
- `duplicate_tag` → "Ya tienes un ejercicio con ese nombre. Prueba con otro."
- `error` → "Ups, ocurrió un problema al crear el ejercicio. Inténtalo de nuevo."

### D6. Action's `tag` derivation stays server-side, never from input

**Rationale.** Input is untrusted. Even with a shared schema, letting the user pick `tag` invites URL-collision attacks and bypasses the `findFirst` uniqueness check (different `name` could still map to the same `tag`). Keep the current derivation (`name.toLowerCase().replace(/\s/g, "-")`) — it's deterministic and the schema explicitly does NOT accept `tag` as input.

## 3. Component Contract

| Surface | Kind | Change | Contract |
|---|---|---|---|
| `src/lib/schemas/exercise.ts` | NEW | Zod schema + inferred type | Exports `createExerciseSchema` and `CreateExerciseInput`. Fields: `name` (min 4, Spanish message), `description?` (optional), `muscleGroupTag` (min 1, Spanish message). NO `tag` field. |
| `src/lib/schemas/exercise.test.ts` | NEW | vitest unit | 4 cases: accept path, `name` too short, `muscleGroupTag` empty, missing field. |
| `src/actions/exercise/create-exercise.ts` | MODIFIED | shape change | Input type → `CreateExerciseInput`. Returns `Promise<{ ok: true, exercise: Exercise } \| { ok: false, code: ErrorCode }>` where `ErrorCode = 'unauthorized' \| 'invalid_input' \| 'unknown_muscle_group' \| 'duplicate_tag' \| 'error'`. No more `console.error` swallow. No more `return undefined`. |
| `src/components/exercise/CreateExerciseForm.tsx` | MODIFIED | field mapping + branch handling | Keeps `exerciseName` / `muscleGroup` for RHF. On submit, maps to `{ name, description, muscleGroupTag }` and calls `createExercise`. On `{ ok: true }` → success toast + reset + push `/exercises` (current). On `{ ok: false }` → destructive toast with code-specific message. |

## 4. Flow

### Flow A — happy path

1. User submits form with `exerciseName="Press banca"`, `muscleGroup="chest"`, `description="Barra plana"`.
2. `onSubmit` maps to `{ name: "Press banca", description: "Barra plana", muscleGroupTag: "chest" }`.
3. `createExercise(input)`:
   1. `auth()` → session present.
   2. `safeParse` → success.
   3. `prisma.muscleGroup.findUnique({ where: { tag: "chest" } })` → exists.
   4. `prisma.exercise.findFirst({ where: { userId, tag: "press-banca" } })` → null.
   5. `prisma.exercise.create({...})` → returns row.
   6. Returns `{ ok: true, exercise }`.
4. Form: success toast, `form.reset()`, `router.push("/exercises")`.

### Flow B — duplicate per-user tag

1. User submits with `exerciseName="Press banca"` but already has an exercise with `tag="press-banca"`.
2. Step 3 above runs; step 3.4 returns a row.
3. Action returns `{ ok: false, code: 'duplicate_tag' }`.
4. Form: destructive toast "Ya tienes un ejercicio con ese nombre. Prueba con otro."; no redirect.

### Flow C — cross-user name collision (different users, same `name`)

1. User A and User B both submit `exerciseName="Press banca"` at the same time.
2. User A passes all pre-checks and creates successfully.
3. User B passes all pre-checks (different `userId`, so `findFirst` returns null) and calls `prisma.exercise.create`.
4. Prisma throws P2002 (`Exercise.name @unique`).
5. Action catches in the `error` catch-all and returns `{ ok: false, code: 'error' }`.
6. Form: destructive toast "Ups, ocurrió un problema…".

## 5. Verification Strategy per Spec Scenario

Stage-1 strict TDD = vitest unit-only on `src/**/*.test.ts`. The new schema is the only fully-runtime-testable surface. The action's branching and the form's union handling rely on typecheck + build + manual smoke (mirroring how the prior change's CTA rendering was verified).

| Spec scenario | Unit (`pnpm test`) | TS check | Manual smoke | Stage 2/3 (deferred) |
|---|---|---|---|---|
| Valid input parses | ✅ | — | — | — |
| Name too short | ✅ | — | — | — |
| Empty muscle-group tag | ✅ | — | — | — |
| Missing required field | ✅ | — | — | — |
| Invalid input short-circuits | — | ✅ (return shape) | submit bad input | mock action |
| Valid input proceeds | — | ✅ | submit good input | mock action |
| Known muscle group proceeds | — | ✅ | submit good input | mock action |
| Unknown muscle-group short-circuits | — | ✅ | hand-edit muscleGroup in DevTools | mock action |
| No collision creates | — | ✅ | submit | mock action |
| Collision short-circuits | — | ✅ | duplicate submit | mock action |
| Cross-user name → P2002 | — | ✅ (catch block) | (cannot repro single-user) | mock action + Prisma |
| Success return | — | ✅ | submit good input | mock action |
| Unauthorized | — | ✅ | (cannot repro without auth bypass) | mock action |
| Invalid input | — | ✅ | submit bad input | mock action |
| Unknown muscle group | — | ✅ | hand-edit | mock action |
| Duplicate tag | — | ✅ | duplicate submit | mock action |
| Error catch-all | — | ✅ | (DB-level) | mock action |
| Form success branch | — | ✅ | submit good input | RTL test |
| Form error branch per code | — | ✅ | force each code via DevTools | RTL test |
| Field mapping on submit | — | ✅ | inspect network | RTL test |

**Summary:** 4/20 scenarios unit-tested, 16/20 typecheck-verified with manual smoke as the next-best signal under Stage 1, 0 unverified. The Stage 2/3 mock-based server-action tests (already on the testing roadmap in `.claude/rules/testing.md`) would lift every action-surface scenario from "manual smoke" to "automated". Out of scope here.

## 6. Risk Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Form's RHF resolver breaks when schema moves out of the component | Med | High (form won't render) | Keep `name`/`muscleGroupTag` as the schema's keys; the form keeps its own UI keys and maps on submit. D1, D4. |
| Cross-user `name` collision surfaces as opaque P2002 instead of a friendly code | Low | Low (one user out of many sees the catch-all) | `error` toast says "Ups, ocurrió un problema…". A future migration to a non-unique `name` would obsolete this; not in scope. |
| TOCTOU on per-user `tag` between `findFirst` and `create` | Low | Low (concurrent same-user submission of identical `name`) | Accepted per proposal; loses fall to `error` code. Multi-tenant will revisit. |
| Form regresses on success path (forgets to reset or redirect) | Med | Med | Requirement 6 explicitly requires success branch behavior; typecheck on the form; manual smoke. |
| `revalidatePath` missing on the create path | Low | Med (stale `/exercises` cache after success) | Mirror `update-set.ts`: call `revalidatePath("/exercises")` on `ok: true` before returning. |

## 7. Out-of-Scope (recorded for traceability)

- DB migration to `@@unique([userId, tag])`. Search-before-create chosen; the TOCTOU race is the accepted trade-off.
- Adding Zod to other server actions (`getExercises`, `getMuscleGroups`, etc. — they are read-only and Zod-parse the response is overkill). Separate changes per CLAUDE.md hard rule #5.
- Generic error-boundary on the form to catch thrown errors outside the action's union (e.g., a future thrown Prisma error before the action's try/catch). The action's try/catch is the contract; a form-level boundary is a future refactor.

## 8. Rollback

Revert the change's commits (schema + action + form + test). No DB migration, no data risk. The action's old return type was `Promise<Exercise | undefined>`; reverting restores that. The form's old `onSubmit` (with `console.error(error)`) is restored. No other module depends on the new `createExerciseSchema` yet.
