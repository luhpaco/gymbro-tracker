# Design: Per-User Exercise Name Uniqueness

## Technical Approach

Implement `proposal.md`: required `Exercise.canonicalName String`, `@@unique([userId, canonicalName])`, including inactive rows. Remove `name @unique` and `@@unique([userId, tag])`. Authenticated create/rename persist server-derived identity atomically. Change-specific specs remain pending; the proposal supersedes conflicting baselines.

## Architecture Decisions

| Option | Tradeoff | Decision |
| --- | --- | --- |
| Dedicated canonicalName | Additional column | Choose: separate identity from slugs. |
| Repurpose tag | Changes semantics | Reject: preserve compatibility. |
| Lowercase/slug identity | Misses folds/conflates punctuation | Reject: use full folding. |
| Pre-check alone | Races remain | Reject: add database backstop. |
| Paused cutover | Downtime | Choose: prevent mixed writers. |

## Interfaces / Contracts

`normalizeExerciseName(raw)` returns `{name, canonicalName}`. Display: NFC → trim → collapse ECMAScript `\s+` to ASCII space; preserve case. Identity: `caseFold(name).normalize("NFC")`, using pinned [unicode-case-folding@1.1.1](https://cdn.jsdelivr.net/npm/unicode-case-folding@1.1.1/README.md). Preserve accents/punctuation: `Bench-Press` differs from `Bench Press`. Folding-table upgrades require re-audit.

Shared Zod schemas require at least four characters after display normalization. Create accepts `{name, description?, muscleGroupTag}`; update accepts those fields plus nonempty `id`. Reject supplied `userId`, `tag`, and `canonicalName`.

Both return `{ok:true, exercise}` or `{ok:false, code}`. Codes: `unauthorized`, `invalid_input`, `unknown_muscle_group`, `duplicate_name`, `error`; update additionally returns `not_found` for missing/non-owned rows or update P2025.

Only P2002 targets identifying exactly `userId`/`canonicalName` (array, either order) or `Exercise_userId_canonicalName_key` map to `duplicate_name`; unrelated/malformed targets remain `error`.

## Data Flow

```mermaid
sequenceDiagram
    participant C as createExercise
    participant R as updateExercise
    participant D as lib/exercises + PostgreSQL
    Note over C,R: Auth/Zod; same owner/key; ownership/muscle-group validated
    C->>D: Pre-check(userId,canonicalName)
    D-->>C: Available
    R->>D: Self-excluding pre-check(userId,canonicalName)
    D-->>R: Available
    C->>D: Atomic create
    D-->>C: Committed
    C->>C: revalidatePath('/exercises'); success
    R->>D: Atomic rename (id+session.userId)
    D-->>R: duplicate_name (scoped-P2002)
    R->>R: Failure; no revalidation
```

Collision queries omit `isActive`. Forms retain values on failure; only success resets/navigates. Preserve existing Spanish feedback conventions.

### Tag compatibility

`ExerciseSection` links by ID; sets reference `exerciseId`; stores filter `muscleGroupTag`. Exercise tags appear in create checks, edit props, and fixtures. Preserve historical tags; derive non-unique legacy-format tags atomically on create/rename. Leave workout/muscle-group tags unchanged.

## File Changes

| File | Action | Description |
| --- | --- | --- |
| `prisma/schema.prisma` | Modify | Replace identity constraints. |
| `prisma/migrations/<timestamp>_exercise_name_{expand,contract}/migration.sql` | Generate | Two schema migrations. |
| `src/lib/{exercise-name,exercises,exercise-name-backfill}.ts` | Create | Normalizer, queries/error classifier, resumable backfill. |
| `scripts/backfill-exercise-names.ts` | Create | Dry-run-default runner; no subprocesses. |
| `src/lib/schemas/exercise.ts` | Modify | Shared create/update validation. |
| `src/actions/exercise/{create,update}-exercise.ts` | Modify | Authentication and mutation parity. |
| `src/components/exercise/{Create,Update}ExerciseForm.tsx` | Modify | Validation/results; remove caller ownership. |
| `src/lib/{exercise-name,exercises,exercise-name-backfill}.test.ts`, `src/lib/schemas/exercise.test.ts`, `src/actions/exercise/{create,update}-exercise.test.ts` | Create/modify | RED-first regressions. |
| `src/store/exercises/exercises-store.test.ts` | Modify | Required-key fixtures. |
| `tests/exercise-name-uniqueness.integration.test.ts`, `vitest.integration.config.ts` | Create | Opt-in PostgreSQL proof. |
| `package.json`, `pnpm-lock.yaml` | Modify | Pinned folding dependency. |

## Testing Strategy

| Layer | Required evidence |
| --- | --- |
| Node/Vitest | Normalizer idempotence, whitespace/NBSP, NFC, sharp-S/sigma folds, accents/hyphens; schema parity; unauthorized/tampered inputs; ownership; inactive collisions; self-renames; atomic payload; P2002 variants; success-only revalidation. |
| Isolated PostgreSQL | Fresh/upgrade migrations, stale tags, collision abort, interrupted backfill/retry, null prohibition, preserved IDs/sets; synchronized create/create, create/rename, rename/rename races: one winner, loser duplicate_name; cross-user successes. Mock auth/cache, not Prisma. |
| Manual browser | Both forms: duplicate failure retains values and never reports success; successful rename refreshes catalog. No DOM harness exists. |

Run existing test/lint/format/typecheck/Prisma-validation/build gates. CI has no database; require separate integration evidence before rollout.

## Threat Matrix

| Boundary | Applicability |
| --- | --- |
| Documentation-like paths | N/A: no executable classification. |
| Git repository selection | N/A: no Git invocation. |
| Commit state | N/A: no commits. |
| Push state | N/A: no pushes. |
| PR commands | N/A: no PR automation. |

Backfill execution — Applicable: explicit authorized database and write opt-in required; refuse absent authorization without connection. RED-test refusal and dry-run zero writes. Never print credentials.

## Migration / Rollout

1. Pause/drain all exercise writers; back up rows. Audit normalized current names, including inactive rows. Invalid names/collisions block rollout; no automatic merging/renaming.
2. Deploy expand-only migration adding nullable canonicalName. Backfill keys using the shared helper; preserve labels/tags initially. Verify every key and zero nulls/collisions.
3. Deploy contract separately: require canonicalName, add scoped uniqueness, drop old indexes. Normalize legacy display names afterward, before reopening writes. Preserve IDs, tags, sets, and lifecycle state.
4. Deploy matching application/client; re-audit, smoke-test, resume writes. Failures remain paused. Never ship both pending migrations before backfill: deploy applies all pending migrations. Generate DDL with `prisma migrate dev`; never edit generated SQL. Backfill is separate idempotent DML.

Rollback stays paused; restore backed-up values and compatible code. Restoring old indexes requires approved collision remediation and a new generated migration.

## Open Questions

No design blockers. Audit/remediation and maintenance authorization gate rollout. Tasks must assess the 400-line budget.
