# Design: Reference-Data Provisioning

## Technical Approach

Add one PostgreSQL 15 data-only Prisma migration containing the fourteen pairs from `src/data/muscle-groups.ts`. In one explicit transaction, lock the table, reject cross-tag canonical-name ownership, then `MERGE` by tag: matched rows update only divergent `name`; unmatched tags insert.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Migration vs seed/runtime provisioning | Duplicates canonical values in SQL | Migration makes fresh installs and upgrades converge through `migrate deploy`; destructive seed, HTTP seed, and build provisioning stay excluded. |
| PostgreSQL `MERGE` keyed by `tag` | Requires PostgreSQL 15+ | Chosen because the project targets PostgreSQL 15; it preserves IDs/tags and updates only divergent canonical names. |
| Transaction plus `SHARE ROW EXCLUSIVE` lock | Briefly blocks writers | Prisma does not transaction-wrap PostgreSQL migrations by default. Reads continue; writers wait, then fail after a 10-second local timeout without partial row changes. |
| Static collision exception | Private inspection supplies row detail | Emits a stable error without dynamic values in retained evidence. |

## Data Flow

```mermaid
sequenceDiagram
    participant O as Operator
    participant P as Prisma Migrate
    participant D as PostgreSQL
    O->>P: migrate deploy
    P->>D: BEGIN; bounded table lock
    D->>D: Validate canonical-name ownership
    alt incompatible collision or lock timeout
        D-->>P: sanitized failure class; ROLLBACK
        P-->>O: halt for reviewed remediation
    else compatible
        D->>D: MERGE by tag (update name / insert missing)
        D-->>P: COMMIT
        P-->>O: migration recorded once
    end
```

Prisma advisory locking serializes migration commands; the table lock serializes application DML against `MuscleGroup`. It cannot prevent a later deliberate destructive seed, so validation MUST prove neither seed path is invoked.

## File Changes

| File | Action | Description |
|---|---|---|
| `prisma/migrations/<timestamp>_provision_muscle_groups/migration.sql` | Create | Transactional precheck and canonical tag-keyed `MERGE`. |
| Historical migrations, `prisma/schema.prisma`, `src/data/muscle-groups.ts`, `src/seed/index.ts`, `src/app/api/seed/route.ts`, `package.json` | Preserve | Checksum/diff guard; no edits. |

## Interfaces / Contracts

SQL MUST use `BEGIN`, `SET LOCAL lock_timeout = '10s'`, and `LOCK TABLE "MuscleGroup" IN SHARE ROW EXCLUSIVE MODE`. Before mutation, reject any canonical `name` owned by another `tag` with SQLSTATE `P0001` and static message `reference_data_provisioning_incompatible_state`. `MERGE` MUST source exactly the specified pairs, match only `tag`, set only `name` when `IS DISTINCT FROM`, insert only `name`/`tag`, then `COMMIT`.

Permitted workflow: run `pnpm exec prisma migrate dev --create-only --name provision_muscle_groups`; author/review only its new unapplied SQL; validate disposably; then deploy committed history only with `pnpm exec prisma migrate deploy`. If unchanged schema prevents empty generation, manually create only the timestamped directory/file under this exception. Never use `migrate dev`/`db push` in production or edit attempted, applied, or historical migrations.

## Testing Strategy

| Layer | What to prove | Approach |
|---|---|---|
| Static | Scope and canonical parity | Diff/checksum guards; compare 14 SQL pairs to TypeScript; lint, type-check, build; assert no build migration/seed. |
| Integration | Fresh, upgrade, divergence, retry, preservation | Disposable fixtures; apply history plus migration; execute its SQL again and compare pairs, IDs, counts, and relationships. |
| Failure/concurrency | Atomic collision and writer safety | Snapshot collision and competing-writer fixtures; expect `P0001` or bounded timeout with no row/FK change; concurrent deploys apply at most once. Retain only outcomes, counts, checksums, and error class. |
| E2E handoff | Later deployment smoke eligibility | Verify canonical data, then emit eligibility only; no Preview or platform mutation in this change. |

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior | Planned RED test |
|---|---|---|---|
| Documentation-like paths | N/A — no executable classifier | Fixed Prisma migration path | None |
| Git repository selection | N/A — no VCS automation | No repository command introduced | None |
| Commit state | N/A — no commit automation | Index/worktree not managed | None |
| Push state | N/A — no push automation | No destination resolution | None |
| PR commands | N/A — no PR automation | No PR command accepted | None |
| Migration/application process | Applicable | Locks serialize; timeout/collision rolls back and halts | Concurrent deploy, writer, collision fixtures |

## Migration / Rollout

Prisma records the migration once; controlled SQL re-execution is a no-op. After precondition failure, privately perform reviewed data correction, run `prisma migrate resolve --rolled-back <migration>`, and reapply the unchanged migration. If applied logic/data is wrong, add a forward migration; never down-migrate, rewrite history, remap tags, or delete automatically.

After verification and target deployment, a separately authorized `supabase-postgres-deployment` session MAY read and rerun its existing Task 3.1 unchanged. This change MUST NOT edit/mark that change, record its smoke result, alter platform configuration, or broaden the sequence; evidence updates belong only to a later phase launched for that change.

## Open Questions

None.
