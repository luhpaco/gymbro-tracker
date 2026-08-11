# Reference-Data Provisioning Validation Evidence

## Scope and Isolation

Validation used only a disposable local PostgreSQL 15.3 container with trust authentication. The validator creates its own fixture schema, never prints connection details, and removes its container in a `finally` block. It does not invoke `pnpm seed`, the HTTP seed route, or `pnpm build`.

## Focused Validator

| Check | Result |
|---|---|
| RED migration-path guard before the new migration | Expected failure: the unique provisioning migration was absent; no fixture mutation was attempted. |
| Fresh fixture | Pass: all 14 canonical tag/name pairs were inserted exactly once. |
| Upgrade and name divergence | Pass: existing `chest` retained its identifier and tag while its name reconciled to `Pecho`; the extra group, user, workout, exercise, set, and exercise foreign key remained unchanged. |
| Retry | Pass: canonical identifiers, tags, names, and row count were unchanged on equivalent re-execution. |
| Incompatible collision | Pass: SQLSTATE `P0001` with `reference_data_provisioning_incompatible_state`; fixture snapshot was unchanged. |
| Concurrent deploy | Pass: two concurrent executions converged to the same 14 canonical rows. |
| Competing writer | Pass: bounded lock-timeout failure left rows and the fixture exercise foreign key unchanged. |

Focused command: `pnpm exec ts-node scripts/validate-reference-data-provisioning.ts`  
Final exit status: `0`

## Static Guards

| Guard | Result |
|---|---|
| New migration checksum | `fee686635f614ddb4c8586895d7be4af296989416ffec253a065434c6684b512` |
| Validator checksum | `9461d8390c2f486e9ba091f2db50b052a722a4ba8b9ebfa8c80f42bfddfd6e16` |
| Historical migration tree checksum | `b3bd689e14c43846111a46a589757fa0cdc88acb324f0fc72a0c1974375817d4` |
| Historical migrations, schema, canonical TypeScript data, and seed surfaces | No staged or unstaged tracked diff. |
| Provisioning surface | One new data-only migration plus the local validator; no seed, HTTP seed, build provisioning, UI, or package-script changes authored. |

## Quality Commands

| Command | Result |
|---|---|
| `pnpm lint` | Exit `0`; one pre-existing React Hooks dependency warning outside this change. |
| `pnpm exec tsc --noEmit` | Exit `0`. |
| `fnm exec --using=24 pnpm build` | Exit `0`; completed under Node 24. |

No quality command produced an in-scope failure class. The three commands passed; their retained outcomes contain no environment values, URLs, credentials, or raw command output.

## Recovery Guidance

For an unapplied migration blocked by an incompatible collision, perform a private reviewed data correction, run `prisma migrate resolve --rolled-back 20260811140000_provision_muscle_groups`, then reapply the unchanged migration. For a defect discovered after the migration is applied, create a new forward-only migration. Do not rewrite history, down-migrate, remap tags, or delete rows automatically.
