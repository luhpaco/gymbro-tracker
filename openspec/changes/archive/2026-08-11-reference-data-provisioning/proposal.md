# Proposal: Reference-Data Provisioning

## Intent

Make fresh and existing installations reliably usable by provisioning the canonical fourteen muscle groups through deployment migration history without risking user data.

## Proposal Question Round

Approved decisions resolve the product questions: canonical scope, reconciliation, collision safety, non-goals, and forward-only recovery are fixed. No product assumptions remain open.

## Scope

### In Scope
- Add one versioned, data-only migration for the current names/tags in `src/data/muscle-groups.ts`.
- Reconcile installations idempotently by tag: insert missing rows; update a differing name to its canonical value; preserve tags, IDs, exercises, workouts, users, and extra rows.
- Validate fresh install, upgrade, retry, and collision behavior with sanitized evidence.

### Out of Scope
- Sample exercises, management UI, schema changes, tag remapping, or automatic deletion.
- Invoking or repurposing destructive `pnpm seed` or HTTP `/api/seed` for deployment provisioning.
- Secrets, platform configuration, commits, PR creation/mutation, or changes to `supabase-postgres-deployment`.

## Capabilities

### New Capabilities
- `reference-data-provisioning`: Versioned canonical muscle-group provisioning, reconciliation, collision handling, and validation.

### Modified Capabilities
- None; the separate deployment change remains unchanged.

## Approach

Approve a narrow custom-migration exception: create a new unapplied Prisma migration and author/review its data SQL; never edit historical/applied migrations. Use a tag-keyed PostgreSQL upsert whose repeated execution converges to the same fourteen canonical tag/name pairs. A canonical name already owned by another tag MUST fail clearly for human correction; it MUST NOT remap, merge, or delete either row.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `prisma/migrations/<version>_provision_muscle_groups/migration.sql` | New | Idempotent data reconciliation. |
| `src/data/muscle-groups.ts` | Unchanged | Canonical 14-row source for review. |
| `src/seed/index.ts`, `src/app/api/seed/route.ts` | Unchanged | Explicitly excluded from deployment. |
| `openspec/changes/supabase-postgres-deployment/` | Unchanged | Unblocked for a later smoke rerun only. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Unique-name collision | Medium | Fail with sanitized diagnostics; require human correction. |
| Data loss during reconciliation | Low | Update name by matching tag only; assert preserved row counts/relations. |

## Rollback Plan

Halt deployment on failure. After deployment, correct only with a new forward migration; never down-migrate, delete provisioned rows, rewrite history, or remap tags.

## Dependencies

- Existing Prisma migration workflow and canonical list; this enables but does not execute or mutate `supabase-postgres-deployment`.

## Success Criteria

- [ ] Fresh and populated fixtures contain all fourteen canonical tag/name pairs while preserving all existing user-owned data and extra rows.
- [ ] Re-execution is a no-op; incompatible name/tag collision fails without mutation.
- [ ] Sanitized migration receipt, canonical count/tag/name assertions, `pnpm lint`, type-check, and build pass without secrets or seed-route usage.
