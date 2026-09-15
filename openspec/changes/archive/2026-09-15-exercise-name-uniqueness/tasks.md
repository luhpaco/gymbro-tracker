# Tasks: Per-User Exercise Name Uniqueness

## Review Workload Forecast

| Field | Value |
|---|---|
| Estimated changed lines | 650–950 |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 → PR 2 → PR 3 |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|---|---|---|---|---|---|
| 1 | Normalization, validation, and action contract | PR 1 | `pnpm test -- src/lib/exercise-name.test.ts src/lib/schemas/exercise.test.ts src/actions/exercise` | `pnpm test`; mocked actions | Lib, schemas, actions, dependency |
| 2 | Safe expand/backfill/contract database rollout | PR 2 | `pnpm test -- src/lib/exercise-name-backfill.test.ts` | Authorized isolated PostgreSQL migration and dry-run | Schema, generated migrations, backfill runner |
| 3 | UI wiring and opt-in concurrency proof | PR 3 | `pnpm test -- src/store/exercises/exercises-store.test.ts` | Manual create/rename browser smoke; isolated PostgreSQL races | Forms, store fixtures, integration config |

## Phase 1: RED Contract Tests

- [x] 1.1 Add failing cases in `src/lib/exercise-name.test.ts` for NFC, trim/whitespace/NBSP, idempotence, sharp-S/sigma folds, and punctuation/accent preservation.
- [x] 1.2 Add failing schema/action tests in `src/lib/schemas/exercise.test.ts` and `src/actions/exercise/{create,update}-exercise.test.ts` for normalized length, tampering, auth, ownership, inactive conflicts, self-rename, scoped P2002, and success-only revalidation.
- [x] 1.3 Add failing `src/lib/exercise-name-backfill.test.ts` cases: collision audit blocks, retry preserves IDs/sets/tags, and refusal plus dry-run makes zero writes without authorized database opt-in.

## Phase 2: Core Application GREEN

- [x] 2.1 Add pinned `unicode-case-folding@1.1.1` in `package.json` and `pnpm-lock.yaml`; implement `src/lib/exercise-name.ts` to return normalized display and canonical names.
- [x] 2.2 Implement shared schemas in `src/lib/schemas/exercise.ts`, rejecting caller `userId`, `tag`, and `canonicalName` and requiring update `id`.
- [x] 2.3 Create `src/lib/exercises.ts` for owner-scoped, inactive-inclusive collision queries and exact canonical-constraint P2002 classification.
- [x] 2.4 Update `src/actions/exercise/{create,update}-exercise.ts` to authenticate, validate, pre-check, atomically persist name/key/legacy tag, and return the specified discriminated codes.

## Phase 3: Safe Data Rollout GREEN

- [x] 3.1 Update `prisma/schema.prisma` with `canonicalName`, scoped uniqueness, and removed global name/tag constraints; generate separate expand and contract migrations with `pnpm exec prisma migrate dev` (never edit generated SQL).
- [x] 3.2 Implement resumable audit/backfill in `src/lib/exercise-name-backfill.ts` and dry-run-default `scripts/backfill-exercise-names.ts`; require explicit authorized connection/write opt-in and never log credentials.
- [x] 3.3 Add `tests/exercise-name-uniqueness.integration.test.ts` and `vitest.integration.config.ts` for fresh/upgrade migrations, null prohibition, cross-owner reuse, and all three synchronized race pairs with one winner.

## Phase 4: UI and Verification

- [x] 4.1 Update `src/components/exercise/{Create,Update}ExerciseForm.tsx` for code-specific Spanish destructive feedback, retained failure values, and success-only reset/navigation; update required-key fixtures in `src/store/exercises/exercises-store.test.ts`.
- [x] 4.2 Run focused tests, then `pnpm test`, `pnpm lint`, `pnpm run format:check`, `pnpm exec tsc --noEmit`, `pnpm exec prisma validate`, and `pnpm build`.
- [x] 4.3 Manually verify both forms: duplicate retains values/no success and successful rename refreshes catalog; record isolated PostgreSQL rollout, audit, and race evidence before reopening writers.
