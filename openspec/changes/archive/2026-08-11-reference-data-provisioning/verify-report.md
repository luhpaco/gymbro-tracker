```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:5c1e9002c96390a0bebc0b8704e6e20044329c8033b75d61b72453e578ed9e25
verdict: pass
blockers: 0
critical_findings: 0
requirements: 6/6
scenarios: 9/9
test_command: pnpm exec ts-node scripts/validate-reference-data-provisioning.ts
test_exit_code: 0
test_output_hash: sha256:5cccfe832d6b11548e622ae119c5c7fd403708df912a9e3a54869e4857773d5a
build_command: fnm exec --using=24 pnpm build
build_exit_code: 0
build_output_hash: sha256:9f30470d121f6aed492748b735fe64e4f6458e126c7fa3187d2cc69619d524b9
```

## Verification Report

**Change**: reference-data-provisioning  
**Version**: N/A  
**Mode**: Standard (Strict TDD disabled; no project test runner configured)  
**Verdict**: PASS WITH WARNINGS

### Completeness

| Metric | Value |
|---|---:|
| Requirements | 6 |
| Scenarios | 9 |
| Tasks total | 11 |
| Tasks complete | 11 |
| Tasks incomplete | 0 |

Native status reported `verify: ready`, all task checkboxes are complete in OpenSpec and Engram, and the active authorized verification attempt was authenticated without mutation. Native settlement was not run.

### Build & Tests Execution

| Check | Command / source | Exit | Output hash | Result |
|---|---|---:|---|---|
| Disposable PostgreSQL behavioral validator | `pnpm exec ts-node scripts/validate-reference-data-provisioning.ts` | 0 | `sha256:5cccfe832d6b11548e622ae119c5c7fd403708df912a9e3a54869e4857773d5a` | ✅ Passed |
| Static scope and artifact audit | Independent Python audit over migration, canonical source, preserved paths, package scripts, UI diff, evidence, and handoff | 0 | `sha256:6ac11d05d0c185f68c4b2d5a5c07a909c80666f3d3e382add3a43f558a46121e` | ✅ Passed |
| Lint | `pnpm lint` | 0 | `sha256:a201e02171ad759faa07d4f938bf38e41b7314bdb0a31defbc98c13aae9d1c79` | ✅ Passed with one pre-existing out-of-scope warning |
| TypeScript | `pnpm exec tsc --noEmit` | 0 | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | ✅ Passed |
| Node 24 production build | `fnm exec --using=24 pnpm build` | 0 | `sha256:9f30470d121f6aed492748b735fe64e4f6458e126c7fa3187d2cc69619d524b9` | ✅ Passed from persisted user confirmation |

The production build was intentionally not rerun. Its exit code and sanitized evidence are bound to native runtime attempt ordinal 4 and `validation-evidence.md`, which record successful completion under the required fnm-bound Node 24 runtime. The build hash above is the SHA-256 of the exact retained sanitized build-evidence bytes, not raw build output, because raw output was intentionally not retained.

The verifier shell did not expose `fnm`; therefore the newly executed validator, lint, and type-check used the available Node 22.22.2 runtime. They passed. This does not replace the separately persisted Node 24 build proof.

**Coverage**: Not available; the project has no configured coverage runner.

### Spec Compliance Matrix

| Requirement | Scenario | Runtime/static evidence | Result |
|---|---|---|---|
| Versioned Canonical Provisioning | Fresh database | Disposable validator `freshAndRetryCase`; static audit proves exactly 14 source pairs and no sample/user table mutation in SQL | ✅ COMPLIANT |
| Versioned Canonical Provisioning | Existing canonical data | Validator reapplies equivalent SQL and compares identifiers, tags, names, and row state | ✅ COMPLIANT |
| Tag-Keyed Reconciliation | Name divergence on an existing tag | Validator `upgradeAndDivergenceCase` proves name-only update with stable ID, tag, and exercise FK | ✅ COMPLIANT |
| Tag-Keyed Reconciliation | Partially populated database | Same runtime case proves 14 canonical rows plus preserved extra group, user, workout, exercise, set, and relations | ✅ COMPLIANT |
| Atomic Collision Escalation | Incompatible collision | Validator `collisionCase` proves `P0001`, static message, and unchanged snapshot | ✅ COMPLIANT |
| Atomic Collision Escalation | Post-deployment correction | Executed artifact audit verifies forward-only recovery guidance and prohibitions | ✅ COMPLIANT |
| Idempotent Convergence | Migration retry | Validator compares complete canonical rows before and after retry | ✅ COMPLIANT |
| Migration-Only Delivery Boundary | Delivery inspection | Executed audit proves tag-only migration behavior, unchanged tracked schema/canonical/seed/API/UI paths, unchanged package scripts, and no seed/build invocation | ✅ COMPLIANT |
| Sanitized Validation and Deployment Isolation | Validation unlock | Executed audit verifies sanitized evidence and isolated handoff; separate deployment Task 3.1 remains incomplete | ✅ COMPLIANT |

**Compliance summary**: 9/9 scenarios compliant.

### Correctness (Static Evidence)

| Requirement | Status | Notes |
|---|---|---|
| Versioned Canonical Provisioning | ✅ Implemented | One new data-only migration contains two identical 14-pair canonical sources matching `src/data/muscle-groups.ts`; migration checksum is `fee686635f614ddb4c8586895d7be4af296989416ffec253a065434c6684b512`. |
| Tag-Keyed Reconciliation | ✅ Implemented | `MERGE` matches only `target.tag = source.tag`, updates only `name`, and inserts only `name`/`tag`; no delete/remap clause exists. |
| Atomic Collision Escalation | ✅ Implemented | Explicit transaction, 10-second local lock timeout, table lock, static `P0001` precheck, and rollback behavior passed. |
| Idempotent Convergence | ✅ Implemented | Runtime retry and concurrent execution converge without duplicate or changed canonical rows. |
| Migration-Only Delivery Boundary | ✅ Implemented | No tracked diff in schema, canonical data, seed, HTTP seed, or UI paths; package scripts are unchanged. |
| Sanitized Validation and Deployment Isolation | ✅ Implemented | Evidence contains counts/checksums/failure classes only; handoff does not run Preview smoke or mutate platform state. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Data-only migration rather than seed/runtime provisioning | ✅ Yes | Provisioning exists only in the new migration. |
| PostgreSQL 15 `MERGE` keyed by tag | ✅ Yes | Exact design contract is present. |
| Explicit transaction and bounded table lock | ✅ Yes | `BEGIN`, local 10-second timeout, `SHARE ROW EXCLUSIVE`, and `COMMIT` are present. |
| Static collision exception | ✅ Yes | Stable message and SQLSTATE are emitted without retained row data. |
| Forward-only recovery | ✅ Yes | Evidence requires reviewed correction/rolled-back resolution before unchanged reapply, or a new forward migration after application. |
| Full migration-history fixture strategy | ⚠️ Partial | The disposable runtime validator constructs the relevant existing schema and executes the migration SQL directly; it does not invoke Prisma over the full historical migration chain. The required SQL behavior is nevertheless covered at runtime. |

### Artifact Consistency

- OpenSpec and Engram proposal, specification, design, and tasks agree on scope and all 11 completed tasks.
- OpenSpec `apply-progress.md`, validation evidence, smoke handoff, and Engram apply/handoff observations are semantically consistent.
- The current `validation-evidence.md` digest is `sha256:161b207b14318d5abe53a69776a54237dd38c0760d15f67748f6cca7b042c76b`, matching `apply-progress.md` and the native attempt history.
- The migration and validator checksums independently match the recorded values.
- The recorded historical-tree checksum has no documented derivation and was therefore not reused as proof; independent tracked-diff guards showed no historical migration modification.
- `openspec/changes/supabase-postgres-deployment/tasks.md` still leaves the human Preview smoke task unchecked; no smoke was repeated here.

### Issues Found

**CRITICAL**

None.

**WARNING**

1. The Node 24 build was not independently rerun by explicit instruction; PASS relies on the persisted native/user-confirmed Node 24 build record. The verifier shell itself lacked `fnm`.
2. Lint retains one pre-existing out-of-scope React Hooks dependency warning in `src/app/auth/login/ui/LoginForm.tsx`.
3. The disposable validator tests the migration SQL against a representative fixture schema rather than applying the complete Prisma migration history.
4. Prior hybrid apply auxiliary artifacts are semantically mirrored in Engram summaries, but their Markdown bytes are not all mirrored verbatim.

**SUGGESTION**

1. Add a reproducible Node 24 CI gate and retain its sanitized output hash so future verification does not depend on human-attested build evidence.
2. Document the historical migration-tree checksum algorithm or replace it with a reproducible tracked-diff manifest.
3. When a test runner is introduced, move the disposable migration scenarios into committed integration tests and include one full Prisma migration-history case.

### Canonical Verification Evidence

The exact UTF-8 preimage below, including its trailing newline, hashes to `sha256:5c1e9002c96390a0bebc0b8704e6e20044329c8033b75d61b72453e578ed9e25`. It is sanitized and safe for native settlement; it contains no attempt token, secret, URL, host, identity, or raw platform output.

```text
schema=gentle-ai.verification-evidence/v1
change=reference-data-provisioning
mode=standard
requirements=6/6
scenarios=9/9
tasks=11/11
migration_sha256=fee686635f614ddb4c8586895d7be4af296989416ffec253a065434c6684b512
validator_sha256=9461d8390c2f486e9ba091f2db50b052a722a4ba8b9ebfa8c80f42bfddfd6e16
validation_evidence_sha256=161b207b14318d5abe53a69776a54237dd38c0760d15f67748f6cca7b042c76b
test_command=pnpm exec ts-node scripts/validate-reference-data-provisioning.ts
test_exit_code=0
test_output_hash=sha256:5cccfe832d6b11548e622ae119c5c7fd403708df912a9e3a54869e4857773d5a
static_audit_exit_code=0
static_audit_output_hash=sha256:6ac11d05d0c185f68c4b2d5a5c07a909c80666f3d3e382add3a43f558a46121e
lint_command=pnpm lint
lint_exit_code=0
lint_output_hash=sha256:a201e02171ad759faa07d4f938bf38e41b7314bdb0a31defbc98c13aae9d1c79
typecheck_command=pnpm exec tsc --noEmit
typecheck_exit_code=0
typecheck_output_hash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_command=fnm exec --using=24 pnpm build
build_exit_code=0
build_output_hash=sha256:9f30470d121f6aed492748b735fe64e4f6458e126c7fa3187d2cc69619d524b9
build_evidence_source=native-runtime-attempt-ordinal-4-and-validation-evidence
historical_migrations_tracked_diff=clean
seed_http_ui_schema_tracked_diff=clean
preview_smoke_rerun=false
remote_migration=false
```

### Verdict

**PASS WITH WARNINGS**

The implementation satisfies all six requirements and nine scenarios, all tasks are complete, the independent disposable validator and scoped checks passed, and no prohibited deployment, seed, UI, historical-migration, secret, PR, or platform action occurred.
