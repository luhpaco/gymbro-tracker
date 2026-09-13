# Design: Exercise Soft-Delete

## 1. Architecture Summary

Mirror the two established precedents: `update-set.ts` for the toggle action (auth → Zod → ownership `findFirst` → update, coded union) and `create-exercise.ts` for the union shape (`{ ok: true, exercise } | { ok: false, code }`, `revalidatePath` on success). One additive Prisma migration introduces `isActive`; two read actions gain a `where` clause; one new action flips the flag; one card button triggers it. No cascade, no FK change, no new packages.

## 2. Decisions

### D1. Field `isActive Boolean @default(true)` on `Exercise`

**Rationale.** The schema has no Boolean fields yet, so there is no convention to conflict with. `isActive` (not `active`) matches the common Prisma adjective-prefix style and reads unambiguously in `where` clauses. `@default(true)` backfills every existing row as active — the migration is purely additive and existing behavior is preserved by default.

**Migration.** `pnpm exec prisma migrate dev --name exercise_is_active`. Rollback = revert `schema.prisma` + a NEW migration dropping the column (never hand-edit generated SQL), or a pre-change DB snapshot. Prisma has no down migrations — the proposal records this and the design confirms it.

### D2. Active-only filtering lives in the server actions, not the store

**Rationale.** The spec mandates it and exploration confirmed: `getExercises` feeds both `/exercises` and the `/workouts/create` picker, so filtering at the action level fixes both surfaces in one `where` clause. The store keeps working on whatever the RSC hands it (and, since the CodeRabbit fix, re-applies `selectedMuscleGroup` on replacement — orthogonal and compatible).

**Change.** `where: { userId, isActive: true }` in `getExercises`; `where: { userId, isActive: true }` in `getExercisesSummary`. Nothing else in those files changes (their swallow-and-return-`[]` error shape is pre-existing and out of scope).

### D3. Confirm the `not_found` code string (spec's open question)

**Confirmed: `not_found`.** One code covers "row missing" and "row owned by another user" (anti-enumeration — the caller cannot probe which IDs exist). The full code set for `setExerciseActiveState` is therefore `unauthorized | invalid_input | not_found | error`, mirroring `createExercise`'s union minus the codes that don't apply (`unknown_muscle_group`, `duplicate_tag`).

### D4. Ownership via `findFirst({ where: { id, userId } })`, then `update`

**Rationale.** Exact mirror of `update-set.ts`: one query both resolves the row and proves ownership; a null result maps to `not_found` without revealing whether the ID exists. Auth and `safeParse` run before any Prisma call (same ordering as `createExercise` after the CodeRabbit boundary fix — auth inside the try, parse before DB).

**Schema.** `exerciseActiveStateSchema = z.object({ id: z.string().min(1), isActive: z.boolean() })` exported from `src/lib/schemas/exercise.ts` next to `createExerciseSchema`. Syntactic only — unit-testable without a DB.

### D5. Deactivate control in `ExerciseSection`: destructive button per card

**Rationale.** Each `TornStrip` card already has an "Editar" `<Button asChild>` in its body; the deactivate control sits next to it as a destructive button (not `asChild`, since it triggers an action, not a navigation). Client handler: call `setExerciseActiveState({ id, isActive: false })`; on `ok: true` call `router.refresh()` (fresh RSC payload → `setExercises` → card disappears); on `ok: false` show a destructive toast per code and keep the card. Spanish messages matching the existing form toasts.

**Reactivation UI deferred** per proposal: the action supports `isActive: true`, but no button exposes it yet (inactive rows are invisible, so there is nowhere to put it — a future "show inactive" view owns that).

### D6. Store test fixture gains `isActive: true`

**Rationale.** After the migration, the generated `Exercise` type requires `isActive`; the `makeExercise` helper in `exercises-store.test.ts` must include it or `tsc` fails. This is a mechanical fixture update, not a behavior change — `setExercises`/`filterExercises` logic is untouched by this change.

## 3. Component Contract

| Surface | Kind | Change | Contract |
|---|---|---|---|
| `prisma/schema.prisma` | Modified | +1 field | `isActive Boolean @default(true)` on `Exercise` |
| `prisma/migrations/*_exercise_is_active/` | New | Migration | `ALTER TABLE "Exercise" ADD COLUMN "isActive" BOOLEAN NOT NULL DEFAULT true` |
| `src/lib/schemas/exercise.ts` | Modified | +1 schema | `exerciseActiveStateSchema` + inferred `ExerciseActiveStateInput` |
| `src/lib/schemas/exercise.test.ts` | Modified | +cases | Accept `{id, isActive}` both directions; reject empty `id`, non-boolean `isActive`, missing fields |
| `src/actions/exercise/set-exercise-active-state.ts` | New | Action + test | Auth → parse → ownership → update; union return; `revalidatePath("/exercises")` on success |
| `src/actions/exercise/set-exercise-active-state.test.ts` | New | Mock tests | unauthorized / invalid_input (zero Prisma calls); not_found; error on update failure; success with `revalidatePath` |
| `src/actions/exercise/get-exercises.ts` | Modified | +1 where key | `isActive: true` |
| `src/actions/exercise/get-exercises-summary.ts` | Modified | +1 where key | `isActive: true` |
| `src/app/(routes)/exercises/components/ExerciseSection.tsx` | Modified | +1 control | Destructive deactivate button per card; refresh-on-ok, toast-on-err |
| `src/store/exercises/exercises-store.test.ts` | Modified | Fixture | `makeExercise` gains `isActive: true` |

## 4. Flows

### Flow A — deactivate

1. User clicks deactivate on a card → handler calls `setExerciseActiveState({ id, isActive: false })`.
2. Action: session → parse → `findFirst({ id, userId })` → row found → `update({ isActive: false })` → `revalidatePath("/exercises")` → `{ ok: true, exercise }`.
3. Client: `router.refresh()` → RSC refetches (active-only) → `setExercises` → card gone. `Set` rows untouched.

### Flow B — same name while inactive

1. Exercise "X" inactive; user creates "X" again.
2. `createExercise` finds no per-user tag collision (inactive row still holds the tag — `findFirst` has no `isActive` filter), proceeds to `create` → Prisma P2002 on global `name @unique` → `{ ok: false, code: "error" }`.
3. Specified behavior: reactivation (server-side, via the action) is the supported path. Documented, not fixed here.

## 5. Verification Strategy per Spec Scenario

Stage-1 now includes mocked action tests (proven by `f47e6bf`), so every action branch gets runtime coverage. Only the two UI scenarios stay manual-smoke.

| Spec scenario | Unit (`pnpm test`) | TS/build | Manual smoke | Deferred |
|---|---|---|---|---|
| Pre-existing rows stay active | — (migration) | `prisma validate` + migrate output | inspect DB | — |
| New rows default active | — (migration) | `prisma validate` | create → inspect | — |
| Inactive excluded from /exercises | — | ✅ | deactivate → card gone | — |
| Inactive excluded from summary | — | ✅ | — | Stage 2 |
| Inactive not in workout picker | — | ✅ | open picker | — |
| Deactivation succeeds | ✅ mock | ✅ | click deactivate | — |
| Reactivation succeeds | ✅ mock | ✅ | — (no UI; action-level only) | — |
| Unauthorized | ✅ mock | ✅ | logged-out submit | — |
| Invalid input | ✅ mock + schema unit | ✅ | — | — |
| Not found / not owned | ✅ mock | ✅ | — | — |
| Error catch-all | ✅ mock | ✅ | — | — |
| Sets survive | — | ✅ (no Set write in diff) | inspect workout detail | — |
| Success removes card | — | ✅ | click → refresh → gone | RTL |
| Failure toast + card stays | — | ✅ | force failure | RTL |
| Same-name fails while inactive | — | ✅ | create same name | — |
| Reactivation restores | ✅ mock | ✅ | — (no UI) | — |

**Summary:** 9/16 unit-tested (schema + mocked action), 5/16 migration/build-verified, 2/16 manual-smoke (UI). 0 unverified.

## 6. Risk Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Migration locks or fails on existing rows | Low | High | Additive `DEFAULT true`; test on local DB first; snapshot before migrate |
| `getExercises` picker exclusion surprises | Low | Med | Intended + specced; verify explicitly |
| Same-name re-creation blocked while inactive | Med | Low | Specified behavior; reactivation path exists server-side |
| Direct `/exercises/update/[id]` edits inactive rows | Low | Low | Accepted edge, noted for verify |
| Fixture drift (`isActive` missing in other test helpers) | Med | Low | `tsc` fails loudly; fix all helpers |

## 7. Out-of-Scope (recorded)

Hard delete, cascade changes, reactivation UI, workout/set logic, other actions' Zod, unique-name changes, `getExercises`/`getExercisesSummary` error-shape refactor (their swallow-and-`[]` stays).

## 8. Rollback

Revert `schema.prisma` + NEW drop-column migration (never edit generated SQL). Deactivations are boolean flips — re-running the toggle restores them. No data loss in any path.
