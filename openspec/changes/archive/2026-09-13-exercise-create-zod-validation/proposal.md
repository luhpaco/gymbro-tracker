# Proposal: Runtime Zod Validation for Exercise Creation

## Intent

`createExercise` trusts the form's inferred TS type and skips runtime validation, so malformed or tampered input reaches Prisma (CLAUDE.md hard rule #5). Errors are swallowed (`console.error` + `return undefined`), so the form shows success on failure. This change adds a shared Zod schema, a runtime parse in the action, and a discriminated-union return the form can render. Tracks the existing Notion Housekeeping ticket for the Zod gap.

## Scope

### In Scope

- Shared `createExerciseSchema` + `CreateExerciseInput` type in `src/lib/schemas/exercise.ts`.
- Runtime `safeParse` in `createExercise`; verify `muscleGroupTag` exists in `MuscleGroup`; verify derived `tag` unique per user (`findFirst`); then create.
- Discriminated-union return: `{ ok: true, exercise } | { ok: false, code }` with distinct codes (`unauthorized`, `invalid_input`, `unknown_muscle_group`, `duplicate_tag`, `error`).
- Form: use shared schema/messages, map `exerciseName`/`muscleGroup` → `name`/`muscleGroupTag`, handle both branches with toasts per code.
- Co-located vitest unit tests for the schema.

### Out of Scope

- DB unique-constraint migration (`@@unique([userId, tag])`) — search-before-create chosen; TOCTOU race accepted.
- Adding Zod to other server actions — separate changes per hard rule.

## Capabilities

### New Capabilities

- `exercise-action-validation`: runtime Zod validation of create-exercise input, per-user tag uniqueness, and discriminated-union action results.

### Modified Capabilities

- None

## Approach

Extract the schema to `src/lib/schemas/exercise.ts` (keys `name` min 4, `description?`, `muscleGroupTag` min 1; Spanish messages per project convention) and export `CreateExerciseInput`. Action flow: auth → `safeParse` → `MuscleGroup` exists → per-user tag unique → `create` → `{ ok: true, exercise }`; every failure returns `{ ok: false, code }`, with the `error` catch-all mapping Prisma P2002 (global `name @unique`) instead of swallowing. `tag` stays derived server-side, never from input. The form keeps resolver-friendly field names and maps on submit. Mirrors `update-set.ts`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/lib/schemas/exercise.ts` | New | Shared schema + `CreateExerciseInput` |
| `src/actions/exercise/create-exercise.ts` | Modified | safeParse, existence/uniqueness checks, union return |
| `src/components/exercise/CreateExerciseForm.tsx` | Modified | Schema import, field mapping, union handling |
| `src/lib/schemas/exercise.test.ts` | New | Vitest units (accept/reject paths) |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| New return shape breaks the form | Med | Handle both union branches in `onSubmit`; never swallow |
| Derived `tag` collides; no DB constraint (TOCTOU) | Low | `findFirst` per user before create; race documented as accepted |
| Schema extraction breaks `useForm` resolver | Med | Keep resolver field names stable; type-check; unit tests |

## Rollback Plan

Revert the change's commits (schema + action + form + test). No migration, no data risk.

## Dependencies

- Existing Notion Housekeeping backlog ticket (Zod validation gap) — reference for traceability.

## Success Criteria

- [ ] `createExercise` returns `{ ok: false, code }` on invalid input before any DB write.
- [ ] Duplicate per-user tag → `duplicate_tag`; unknown muscle group → `unknown_muscle_group`; DB error → `error`.
- [ ] Form shows a destructive toast per error code and the success toast only on `ok: true`.
- [ ] `exercise.test.ts` covers accept + reject paths; `pnpm test` green.
- [ ] `pnpm build` green.