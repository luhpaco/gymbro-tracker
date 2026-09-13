# Design: Atomic Per-User Tag Uniqueness

## 1. Architecture Summary

Two-part change: one additive Prisma migration (`@@unique([userId, tag])`) plus a targeted edit of `createExercise`'s catch-all that discriminates P2002 by target. The existing `findFirst` fast path stays untouched as the friendly no-exception route; the constraint is the atomic backstop for the TOCTOU window. No UI, no read-path, no schema-shape changes.

## 2. Decisions

### D1. Constraint `@@unique([userId, tag])`, global `name @unique` stays

**Rationale.** The composite closes exactly the TOCTOU window (same user + same derived tag) without changing any other invariant. Removing the global `name @unique` would be a separate product decision (cross-user name sharing) — explicitly out of scope. Verified 0 violating rows locally, so the migration applies with no data cleanup; apply must re-check and stop if violations appeared.

**Migration.** `pnpm exec prisma migrate dev --name exercise_user_tag_unique` producing `CREATE UNIQUE INDEX "Exercise_userId_tag_key"`. Rollback = NEW migration with `DROP INDEX` (never hand-edit SQL) or pre-change snapshot.

### D2. Normalize both P2002 `meta.target` shapes defensively

**Rationale.** Prisma 5.x on PostgreSQL reports `meta.target` as a field-name array (`["userId","tag"]`); other versions/connectors report the constraint-name string (`"Exercise_userId_tag_key"`). The mapping helper MUST accept both, because a future Prisma bump could flip the shape and silently reroute `duplicate_tag` into `error`.

**Shape.** A small pure helper in `create-exercise.ts` (or a co-located `isCompositeTagViolation(err): boolean`):
- `target` is an array containing exactly `userId` + `tag` (order-insensitive) → composite.
- `target` is a string equal to `"Exercise_userId_tag_key"` → composite.
- Anything else → not composite → `error`.

**Why a helper, not inline.** Pure, unit-testable without mocks, reusable if another action ever needs the same discrimination. Keep it module-private to the action file (no new file — YAGNI; a shared util with one caller is premature abstraction).

### D3. Keep the `findFirst` fast path unchanged

**Rationale.** The pre-check returns `duplicate_tag` without an exception round-trip — cheaper and its behavior is already tested and verified. The constraint only fires when two requests race past it. No reason to remove working, tested code. The spec's "pre-check still short-circuits" scenario pins this.

### D4. Catch-all ordering: composite check first, then `error`

**Rationale.** Current catch-all maps everything to `error`. New logic: `if (isPrismaP2002(err) && isCompositeTagViolation(err)) return duplicate_tag; return error`. The existing name-P2002 test (`["name"]` target → `error`) must keep passing unchanged — it is the regression guard for this exact edit.

### D5. No `meta` type widening beyond the helper

**Rationale.** Prisma types `meta` as `Record<string, unknown>`; narrowing happens at runtime inside the helper with `Array.isArray` / `typeof === "string"` guards. No casts leak into the action body, no `@ts-expect-error`, no schema changes.

## 3. Component Contract

| Surface | Kind | Change | Contract |
|---|---|---|---|
| `prisma/schema.prisma` | Modified | +1 line | `@@unique([userId, tag])` on `Exercise` |
| `prisma/migrations/*_exercise_user_tag_unique/` | New | Migration | `CREATE UNIQUE INDEX "Exercise_userId_tag_key" ON "Exercise"("userId", "tag")` |
| `src/actions/exercise/create-exercise.ts` | Modified | Catch-all edit + private helper | Composite P2002 → `duplicate_tag`; all else → `error`; fast path untouched |
| `src/actions/exercise/create-exercise.test.ts` | Modified | +3 tests | Composite-array P2002 → `duplicate_tag`; composite-string P2002 → `duplicate_tag`; name-P2002 → `error` (already exists — keep, don't duplicate; add only the two composite shapes + fast-path short-circuit if missing) |

## 4. Flows

### Flow A — race past the pre-check

1. Two concurrent `createExercise` calls, same user, same derived tag. Both pass `findFirst` (null at read time).
2. First `create` succeeds. Second `create` throws P2002 with target `["userId","tag"]`.
3. Helper matches composite → `{ ok: false, code: "duplicate_tag" }`. No exception escapes; the form shows the friendly message.

### Flow B — name collision (unchanged behavior)

1. `create` throws P2002 with target `["name"]`.
2. Helper rejects (not composite) → `{ ok: false, code: "error" }`. Identical to today.

## 5. Verification Strategy per Spec Scenario

Mocked Vitest action tests cover every mapping branch (proven pattern). Migration correctness via `prisma validate` + migrate output + the pre-verified zero-duplicate query.

| Spec scenario | Unit (`pnpm test`) | Migration/build | Deferred |
|---|---|---|---|
| Constraint declared + migrated | — | `prisma validate` + migration SQL exact | — |
| No-collision create | existing test | — | — |
| Race → `duplicate_tag` | ✅ mock composite P2002 (both shapes) | — | true-concurrency test |
| Fast path retained | existing test | — | — |
| Array target → `duplicate_tag` | ✅ | — | — |
| String target → `duplicate_tag` | ✅ | — | — |
| Non-composite target → `error` | existing name-P2002 test | — | — |
| Delta: backstop + mapping | same as above | — | — |

**Summary:** 7/13 mocked-unit (3 new + 4 existing), 2/13 migration/build, 4/13 covered by existing tests. 0 unverified. True-concurrency (two parallel inserts) is not reproducible under Stage-1 — the constraint itself is the proof, verified by migration apply.

## 6. Risk Table

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| Duplicates appeared since exploration | Low | High (migration fails) | Re-run the duplicate query at apply before migrating; stop + clean first |
| `meta.target` third shape (e.g. null/undefined) | Low | Low | Helper defaults to `error` — safe direction (generic toast, no crash) |
| Prisma version bump flips target shape | Low | Low | Both shapes handled; tests pin both |
| Ambiguous "Error catch-all" wording in old spec (flagged by sdd-spec) | — | Low | Archive tightens the wording to "non-composite P2002 or other DB error" |

## 7. Out-of-Scope (recorded)

Removing `name @unique`, changing `findFirst` semantics, soft-delete/read paths/UI, other actions, true-concurrency test harness.

## 8. Rollback

Code revert + NEW drop-constraint migration. Data safe: constraint adds no column, deletes nothing.
