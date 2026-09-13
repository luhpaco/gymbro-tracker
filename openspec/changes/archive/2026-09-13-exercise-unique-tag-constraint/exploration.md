# Exploration: Atomic per-user exercise tag uniqueness

## Current State

- `Exercise` model (`prisma/schema.prisma`) has a **global** `name @unique` only. There is no composite uniqueness on `(userId, tag)`.
- `createExercise` (`src/actions/exercise/create-exercise.ts`) derives `tag` server-side (`name.toLowerCase().replace(/\s/g, "-")`), runs a `findFirst` pre-check on `{ userId, tag }` (fast path → `duplicate_tag`), then `prisma.exercise.create`.
- The action's catch-all maps **every** exception — including any Prisma P2002 — to `{ ok: false, code: "error" }`. Existing test asserts a global-name P2002 → `error`.
- **TOCTOU gap**: between the `findFirst` pre-check and `create`, a concurrent request can insert the same `(userId, tag)`. The pre-check is not atomic; the DB has no backstop.
- This was a CodeRabbit Major on PR #33, resolved then as accepted risk. Notion Housekeeping ticket "[Housekeeping] Constraint @@unique([userId, tag]) en Exercise + mapeo P2002 por target" is `En curso` / Owner OpenCode.

## Data Check (read-only, local DB)

Ran against the local PostgreSQL (connection from `.env` `POSTGRES_URL`, no writes):

```
SELECT "userId", tag, COUNT(*) FROM "Exercise" GROUP BY "userId", tag HAVING COUNT(*) > 1;
```

**Result: 0 rows.** 3 total exercise rows across 1 user. No pre-existing violations of the composite `(userId, tag)` — the migration can apply without a data-cleanup step. Re-check at apply time anyway; if rows appear in the meantime, stop and clean data first.

## Affected Areas

- `prisma/schema.prisma` — add `@@unique([userId, tag])` to `Exercise` (global `name @unique` stays).
- `prisma/migrations/<new>` — `CREATE UNIQUE INDEX "Exercise_userId_tag_key"` (Prisma default naming, see `Exercise_name_key` precedent).
- `src/actions/exercise/create-exercise.ts` — map P2002 by `meta.target` in the catch-all.
- `src/actions/exercise/create-exercise.test.ts` — 3 new mocked tests (composite P2002, name P2002, pre-check short-circuit).

## Approaches

1. **DB composite `@@unique` + P2002 target mapping** (approved scope)
   - Pros: atomic backstop closes TOCTOU; keeps friendly `duplicate_tag` without exception round-trip; minimal diff; mocked tests fit existing pattern.
   - Cons: P2002 `meta.target` shape varies by version/connector (must normalize both shapes).
   - Effort: Low

2. **Serializable transaction or advisory lock around pre-check + create**
   - Pros: no schema change.
   - Cons: still no DB-level guarantee for direct writes; more complexity; overkill for this app.
   - Effort: Medium

3. **Drop global `name @unique`** — explicitly out of scope (cross-user collisions surface as P2002 → `error`, per `exercise-action-validation` spec).

## Recommendation

Approach 1, per the approved scope. Keep the `findFirst` fast path (friendly code without an exception round-trip); the constraint is the atomic backstop. Normalize `meta.target` defensively: array form (PG 5.x: `["userId","tag"]` — confirmed via prisma/prisma#6166) AND string constraint-name form (`Exercise_userId_tag_key`). Unit-test both shapes at the mock level.

## Risks

- Migration fails if duplicates appear between now and apply — Low (verified 0 today); re-check at apply, clean data first if needed.
- P2002 `meta.target` shape differences across Prisma versions/connectors — Med; normalize both shapes + mock-level tests.
- TOCTOU — now closed by the constraint.

## Ready for Proposal

Yes — scope confirmed, data verified clean, approach settled. Tell the user: 0 duplicate `(userId, tag)` rows exist today (3 rows, 1 user), so no data-cleanup step is needed; migration + P2002 target mapping + fast-path retention is the plan.