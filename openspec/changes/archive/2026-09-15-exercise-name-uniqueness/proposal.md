# Proposal: Per-User Exercise Name Uniqueness

## Intent

Allow cross-user name reuse while preventing normalized-name duplicates within each catalog on creation and rename. This confirmed decision resolves `exploration.md`'s pending question.

## Scope

### In Scope

- Document one normalization rule: trim, case-fold, and normalize whitespace.
- Enforce owner-scoped uniqueness atomically on creation and rename, including inactive exercises; allow an exercise's unchanged canonical name.
- Align rename authentication, ownership, input validation, and duplicate feedback with creation.
- Migrate/backfill canonical identity safely and cover regression cases.

### Out of Scope

- Sharing, merging, automatic conflict renaming, and reactivation UI.
- Unrelated action refactors or workout/muscle-group uniqueness changes.

## Capabilities

### New Capabilities

- `exercise-name-uniqueness`: Normalized-name identity, cross-user reuse, and create/rename parity.

### Modified Capabilities

- `exercise-tag-uniqueness`: Remove global-index preservation; align atomic constraints and duplicate handling, including rename races.
- `exercise-action-validation`: Replace legacy derivation and cross-user-error scenarios; extend validated, authenticated mutation and duplicate-feedback contracts to rename.
- `exercise-soft-delete`: Scope inactive-name reservation to owners; preserve reactivation and history.

## Approach

Use shared server-side normalization, self-excluding collision pre-checks, and database enforcement. Persist name and canonical identity atomically. Design resolves tag versus dedicated canonical-key storage, normalization details, consumer compatibility, and backfill sequencing without weakening the invariant. Keep queries in `src/lib/` or `src/data/`; forms consume validated server actions.

## Affected Areas

| Area | Impact | Description |
| --- | --- | --- |
| `prisma/schema.prisma`, `prisma/migrations/` | Modified/New | Scoped enforcement/backfill |
| `src/actions/exercise/{create,update}-exercise.ts` | Modified | Mutation parity |
| `src/lib/schemas/exercise.ts`, `src/lib/` | Modified/New | Validation, normalization, data access |
| `src/components/exercise/{Create,Update}ExerciseForm.tsx` | Modified | Duplicate feedback |
| Co-located `*.test.ts` | Modified/New | Regression coverage |
| `openspec/specs/` | Modified/New | Listed capability updates |

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| Legacy canonical collisions | Medium | Audit; block migration pending approved remediation |
| Tag consumer breakage | Medium | Inventory consumers before choosing storage |
| Concurrent mutation duplicates | Medium | Database backstop and race verification |

## Rollback Plan

Pause writes; restore compatible application/schema and backed-up canonical values. Restore global uniqueness only after approved cross-user collision resolution, through a new generated migration. Preserve exercise IDs and sets.

## Dependencies

- Collision audit and Prisma-generated migration; never hand-edit generated migrations.

## Success Criteria

- [ ] Cross-user names succeed; same-user normalized duplicates fail on create/rename, including inactive rows and races.
- [ ] Self-renames succeed; invalid/unauthorized mutations fail without writes.
- [ ] Backfill preserves history; affected baseline scenarios agree.
- [ ] Normalization/action tests, database checks, and existing CI gates pass.
