# Proposal: Atomic per-user exercise tag uniqueness

## Intent

Per-user exercise tag uniqueness is enforced only by a `findFirst` pre-check in `createExercise`, which is not atomic: two concurrent requests can both pass the check and insert the same `(userId, tag)`. A CodeRabbit Major on PR #33 was accepted as risk; this change closes it with a DB-level `@@unique([userId, tag])` constraint plus P2002 target mapping in the action.

## Scope

### In Scope

- Add `@@unique([userId, tag])` to `Exercise` (global `name @unique` stays) + migration via `prisma migrate dev`.
- Map composite P2002 → `duplicate_tag`; name P2002 and all other errors → `error` (current behavior preserved). Keep the `findFirst` fast path as the friendly no-exception route; the constraint is the atomic backstop.
- Mocked action tests: composite P2002 → `duplicate_tag`, name P2002 → `error`, pre-check still short-circuits.

### Out of Scope

- Removing global `name @unique`; changing `findFirst` semantics; soft-delete/read paths/UI; other actions; Notion sync (ticket already `En curso`).

## Capabilities

### New Capabilities

- `exercise-tag-uniqueness`: atomic per-user tag uniqueness for exercises — DB composite constraint + P2002-target mapping in `createExercise`.

### Modified Capabilities

- `exercise-action-validation` (delta): the Per-user tag uniqueness requirement gains the atomic backstop and composite/name P2002 mapping scenarios.

## Approach

1. Schema: `@@unique([userId, tag])` on `Exercise`; `prisma migrate dev --name exercise_user_tag_unique` (do not hand-edit generated SQL).
2. `createExercise` catch-all: if `err.code === "P2002"` and `meta.target` matches the composite — array form `["userId","tag"]` or string constraint name `Exercise_userId_tag_key` — return `duplicate_tag`; otherwise `error`. Normalize both shapes defensively (shape differs by Prisma version/connector; PG 5.x reports field-name arrays).
3. Tests: mock composite P2002 (array + string target), name P2002, and pre-check short-circuit.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/schema.prisma` | Modified | `@@unique([userId, tag])` on `Exercise` |
| `prisma/migrations/<new>` | New | `CREATE UNIQUE INDEX "Exercise_userId_tag_key"` |
| `src/actions/exercise/create-exercise.ts` | Modified | P2002 target mapping in catch-all |
| `src/actions/exercise/create-exercise.test.ts` | Modified | 3 new mocked tests |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Migration fails on pre-existing duplicates | Low — verified 0 violating rows today (3 rows, 1 user) | Re-check at apply; stop and clean data first if violations appeared |
| P2002 `meta.target` shape varies (array vs constraint-name string) | Med | Normalize both shapes; unit-test both at mock level |
| TOCTOU between pre-check and create | — closed | Constraint is the atomic backstop |

## Rollback Plan

- DB: new drop-constraint migration (`DROP INDEX "Exercise_userId_tag_key"`) via `prisma migrate dev`; never hand-edit generated SQL. Snapshot with `pg_dump` before applying.
- Code: revert `create-exercise.ts` + test changes in the same PR.

## Dependencies

- Local PostgreSQL running (podman) for `prisma migrate dev`.
- Prisma 5.18 pinned — no version change.

## Success Criteria

- [ ] `prisma migrate dev` applies cleanly (verified no existing duplicates).
- [ ] Concurrent same-`(userId, tag)` inserts: second returns `{ ok: false, code: "duplicate_tag" }`.
- [ ] Global-name P2002 still maps to `error`.
- [ ] `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build` all green.