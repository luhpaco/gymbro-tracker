## Exploration: Exercise name uniqueness

### Current State
`Exercise.name` has a global database unique index (`Exercise_name_key`), while `(userId, tag)` is also uniquely enforced per user. `createExercise` only pre-checks the per-user derived `tag`; when a different user already owns the exact same `name`, PostgreSQL raises P2002 and the action returns the generic `error` code. The form therefore shows a generic failure instead of a duplicate-name message.

The current OpenSpec baseline explicitly requires global `name @unique` to remain unchanged and specifies the generic cross-user P2002 result. This change must modify that baseline if the product decision changes the scope.

### Affected Areas
- `prisma/schema.prisma` — declares global `name @unique` and per-user `(userId, tag)` uniqueness.
- `prisma/migrations/` — a new Prisma-generated migration is required to remove or replace the global name index; generated migrations must not be edited manually.
- `src/actions/exercise/create-exercise.ts` — currently treats a name-index P2002 as a generic error.
- `src/actions/exercise/create-exercise.test.ts` — explicitly verifies that a global name violation returns `error`.
- `src/actions/exercise/update-exercise.ts` — updates `name` but not `tag`; a scoped name policy must define rename behavior so create and update preserve the same invariant.
- `src/components/exercise/CreateExerciseForm.tsx` — maps the generic server result to the user-facing fallback.
- `openspec/specs/exercise-tag-uniqueness/spec.md` and `openspec/specs/exercise-action-validation/spec.md` — currently codify global name uniqueness and its generic P2002 outcome.

### Approaches
1. **Per-user normalized-name uniqueness (recommended)** — Permit different users to create the same exercise name, while a user cannot create a second name with the same approved canonical form.
   - Pros: Matches private exercise catalogs and removes the multi-user collision; maintains a clear owner-scoped invariant.
   - Cons: Requires an explicit canonicalization and rename policy; changes the existing OpenSpec contract and database index.
   - Effort: Medium

2. **Keep global name uniqueness** — Retain `name @unique` and improve the P2002 mapping/message only.
   - Pros: No data-model change and no migration.
   - Cons: Still prevents separate users from using the same common exercise name, contradicting the ticket's multi-user concern.
   - Effort: Low

3. **Treat name as an unrestricted display label** — Remove global name uniqueness and rely only on the existing `(userId, tag)` constraint.
   - Pros: Different users can always reuse names; smallest schema change.
   - Cons: Existing updates do not recompute `tag`, so a user could create duplicate display names through renames; the create and update rules would diverge.
   - Effort: Medium

### Recommendation
Adopt **per-user normalized-name uniqueness**: an exercise name is owned by its creator's catalog and is reusable by every other user. Confirm that same-user collisions are evaluated using a documented canonical form (at minimum trim, case-fold, and whitespace normalization) and that renames recompute or deliberately preserve the identifier consistently. The existing per-user `tag` constraint can support this only if its derivation is made the approved canonical-name rule and updates maintain it.

### Risks
- Removing only `name @unique` without a rename policy leaves creation and update with different duplicate behavior.
- Existing OpenSpec requirements expressly preserve the global index; a proposal must modify, not silently contradict, those requirements.
- A migration must be generated through `prisma migrate dev` and verified against existing rows before it is applied.
- Database uniqueness for the raw `name` is not a complete semantic rule for casing or whitespace; the product must define what users perceive as the same name.

### Ready for Proposal
No — the product owner must explicitly confirm: **Are exercise names unique only within each user's catalog (recommended), allowing other users to reuse them, and should same-user identity use a normalized name/tag on both create and rename?** After that confirmation, proceed to `sdd-propose`.
