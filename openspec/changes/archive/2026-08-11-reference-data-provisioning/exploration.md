## Exploration: Versioned Reference-Data Provisioning

### Current State
`MuscleGroup` is reference data with unique `name` and `tag` fields. `Exercise.muscleGroupTag` is a required foreign key to `MuscleGroup.tag`, so an empty table makes the exercise form unusable and prevents the exercise prerequisite for workout creation. The repository contains the canonical fourteen muscle-group names and tags in `src/data/muscle-groups.ts`.

The current `pnpm seed` script deletes sets, exercises, muscle groups, and workouts before inserting muscle groups. The GET seed route inserts only when the table is entirely empty. Neither path is versioned, safe for an upgraded shared database, nor appropriate for deployment-time provisioning. The repository has eight committed PostgreSQL migration directories; the existing deployment change intentionally preserves migrations and seed behavior, and remains blocked until this separate change restores the smoke path.

### Affected Areas
- `prisma/schema.prisma` — defines the unique reference keys and required exercise relation; no schema change is currently indicated.
- `prisma/migrations/` — requires one new, immutable data-only migration for the canonical muscle groups if the migration approach is selected.
- `src/data/muscle-groups.ts` — supplies the existing canonical fourteen-record product vocabulary.
- `src/seed/index.ts` — destructive legacy seed behavior is incompatible with shared-database provisioning and must not be used for this change.
- `src/app/api/seed/route.ts` — table-empty, HTTP-triggered provisioning is not versioned or concurrency-safe; its future role must be removed or explicitly constrained.
- `src/actions/muscle/get-muscle-groups.ts` and exercise pages/forms — consume the reference rows and expose the empty-list failure.
- `openspec/changes/supabase-postgres-deployment/` — must remain unchanged and blocked; its Preview smoke can be repeated only after this independent change is deployed.

### Approaches
1. **Custom Prisma data migration** — Add one new migration containing only canonical `MuscleGroup` inserts, using PostgreSQL conflict handling keyed by `tag` and an explicit duplicate/name-collision policy.
   - Pros: Versioned with schema history; `migrate deploy` applies it once on upgrades and fresh databases; no runtime endpoint or build-time mutation; supports an auditable, repeat-safe SQL statement.
   - Cons: Requires a narrowly documented exception to the project rule against manually editing generated migrations, using Prisma's supported custom-migration workflow; canonical values are duplicated from the TypeScript source unless later consolidated; rollback must be forward-only.
   - Effort: Medium.

2. **Dedicated idempotent provisioning command** — Add a separately invoked Prisma script that upserts each canonical group by tag after migrations are applied.
   - Pros: Can reuse the existing TypeScript data list; retries are straightforward; avoids custom migration SQL.
   - Cons: Creates a second mandatory deployment operation that can be skipped or drift from migration state; requires controlled execution, evidence, and concurrency behavior; it does not make reference data part of the upgrade history.
   - Effort: Medium.

3. **Reuse the existing seed script or seed endpoint** — Invoke `pnpm seed` or the GET route after deployment.
   - Pros: Minimal immediate coding.
   - Cons: The script deletes user-facing workout and exercise data; the route only works for a completely empty table and is not an upgrade-safe idempotency contract; neither is versioned. Build-time seeding would also mutate the shared database from Preview deployments.
   - Effort: Low implementation effort, High operational risk.

### Recommendation
Choose Approach 1, scoped strictly to the fourteen existing muscle groups. Create a new, data-only custom Prisma migration with a deterministic insert/upsert contract keyed by `tag`; it MUST preserve existing exercise/workout data, MUST NOT delete reference rows, and MUST fail clearly on incompatible name/tag collisions rather than silently remapping data. Prisma Migrate records applied migrations and serializes deployment application; SQL-level conflict handling additionally makes the insert safe if it is deliberately retried during controlled recovery.

Before implementation, the proposal must explicitly approve the limited custom-migration exception: create and review a new migration for this data operation, never modify historical migrations, and use forward fixes after deployment. The existing destructive seed command and GET seed route must not be called by the delivery flow. Sample exercises are out of scope: their inclusion is a separate product decision and MUST NOT be inferred from the missing muscle groups.

### Risks
- A new data migration is irreversible in the practical sense once exercises reference its tags; rollback must be a forward corrective migration, never automatic deletion or down-migration.
- Canonical-name uniqueness means a pre-existing conflicting row could cause a safe failure; implementation needs an explicit collision receipt and a human decision instead of destructive reconciliation.
- Keeping a destructive seed and public table-empty seed route after provisioning leaves accidental or unauthorized mutation paths that should be addressed in the proposal scope.
- Static checks cannot prove deployed reference rows. Validation must include a sanitized migration receipt, canonical tag/count assertion, a deliberate idempotency check, and a fresh Preview smoke that creates a custom exercise, then a workout, without sample exercises or seed endpoints.

### Ready for Proposal
Yes — propose only muscle-group reference provisioning, record sample exercises as explicitly undecided and out of scope, and require a decision checkpoint before apply for the custom-migration exception and any detected data collision.
