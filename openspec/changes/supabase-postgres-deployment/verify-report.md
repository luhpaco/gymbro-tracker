```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:75a1eb7ec87d2a3298dbca950a75371899a5574f2e282c92ad491dccd1d5b2ab
verdict: fail
blockers: 2
critical_findings: 2
requirements: 5/7
scenarios: 8/10
test_command: PATH="/tmp/opencode/node24-bin:$PATH" pnpm lint
test_exit_code: 0
test_output_hash: sha256:66676b0b7418a865a838103e4d0cb7cb661e55d84481f5d6b9434f56b4069fad
build_command: PATH="/tmp/opencode/node24-bin:$PATH" pnpm build
build_exit_code: 0
build_output_hash: sha256:c6181094a53c48ed8ac98e3789a0f5f69a953419901544a02ba8c2fb0e99c692
```

## Verification Report

**Change**: supabase-postgres-deployment  
**Version**: N/A  
**Mode**: Standard (Strict TDD disabled; no project test runner configured)  
**Verdict**: FAIL

### Completeness

| Metric | Value |
|---|---:|
| Requirements | 7 |
| Scenarios | 10 |
| Tasks total | 12 |
| Tasks complete | 12 |
| Tasks incomplete | 0 |

Native status was supplied as `verify=ready`, and the authorized verification attempt was supplied as acquired. This verifier did not run native settlement, remote migration, remote smoke, or any platform/Git/PR mutation.

### Build & Tests Execution

| Check | Command / source | Exit | Output hash | Result |
|---|---|---:|---|---|
| Project tests | Not configured | N/A | N/A | ➖ Unavailable |
| Lint under Node 24.19.0 in an environment-file-free isolated source snapshot | `PATH="/tmp/opencode/node24-bin:$PATH" pnpm lint` | 0 | `sha256:66676b0b7418a865a838103e4d0cb7cb661e55d84481f5d6b9434f56b4069fad` | ✅ Passed with one pre-existing warning |
| TypeScript under Node 24.19.0 in the same snapshot | `PATH="/tmp/opencode/node24-bin:$PATH" pnpm exec tsc --noEmit` | 0 | `sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855` | ✅ Passed |
| Production build under Node 24.19.0 in the same snapshot | `PATH="/tmp/opencode/node24-bin:$PATH" pnpm build` | 0 | `sha256:c6181094a53c48ed8ac98e3789a0f5f69a953419901544a02ba8c2fb0e99c692` | ✅ Passed |
| Sanitized artifact privacy scan | Explicit scan of five change artifacts; no environment files | 0 | `sha256:37810eab85bb1a21b2cdcc50cf4c3d2841db4f018c6ed2563c1c44161e33b2c5` | ✅ Passed |

The isolated build used no repository environment files or external configuration values. Its exact raw output is not persisted in this report. Static inspection confirms `scripts.build` remains `prisma generate && next build`; it invokes neither migration nor seed behavior.

**Coverage**: Not available; no test or coverage runner is configured.

### Spec Compliance Matrix

| Requirement | Scenario | Runtime/static evidence | Result |
|---|---|---|---|
| Shared Database Safety | Preview uses disposable data | Sanitized full-smoke receipt records a fresh context and disposable account, exercise, and workout data with no seed run | ✅ COMPLIANT |
| Secret Custody and Non-Disclosure | Scoped runtime secrets are available | Sanitized platform checkpoint plus successful Preview registration/login demonstrate runtime availability without stored values | ✅ COMPLIANT |
| Secret Custody and Non-Disclosure | Disclosure evidence is detected | Independent artifact scan found no URI-scheme values, JWT-shaped values, private-key blocks, or retained raw output | ✅ COMPLIANT |
| Migration Checkpoint | Migration succeeds | Sanitized human receipt records one successful private session-mode migration with no URL, raw output, retry, rollback, or seed retained | ✅ COMPLIANT |
| Migration Checkpoint | Migration fails | No covering runtime failure test or authorized failed-migration receipt exists | ❌ UNTESTED |
| Vercel Node.js 24 Configuration | Node configuration is verified | Current `package.json` declares `24.x`; sanitized deployment evidence records Node major 24; Node 24.19.0 lint/type-check/build passed | ✅ COMPLIANT |
| Immutable Change Boundaries | Scope audit remains clean | Current scoped diff adds only `engines.node` to `package.json`; build script is unchanged; schema, historical migration, lockfile, and seed paths show no deployment-change diff | ✅ COMPLIANT |
| Fresh-Session Preview Smoke Sequence | Complete smoke sequence passes | Latest sanitized human receipt passes registration, login, dashboard, exercise creation, workout creation, and logout in order | ✅ COMPLIANT |
| Fresh-Session Preview Smoke Sequence | A smoke step fails | Earlier sanitized runtime receipt blocked acceptance when exercise/workout failed; later steps did not substitute for missing evidence | ✅ COMPLIANT |
| Read-Only PR #1 Readiness Assessment | Readiness is reported without mutation | Independent read-only PR inspection now reports PR #1 as merged, contradicting the required unmerged boundary | ❌ FAILING |

**Compliance summary**: 8/10 scenarios compliant; 5/7 requirements fully compliant.

### Correctness (Static and Delivery Evidence)

| Constraint | Status | Notes |
|---|---|---|
| Package Node 24 declaration | ✅ Implemented in worktree | `package.json` contains only the approved `engines.node: 24.x` addition relative to the current feature-branch HEAD. |
| No unintended protected-path changes | ✅ Scoped pass | The deployment change preserves schema, historical migrations, lockfile, seed paths, and build behavior. The existing `.gitignore` worktree change predates this apply evidence, and the separately approved reference-data migration is merged delivery rather than an unintended deployment edit. |
| No build-time migration or seed | ✅ Verified | Node 24 isolated build passed; script inspection and output audit show Prisma client generation plus Next build only. |
| Sanitized private migration evidence | ✅ Verified | Only result/state facts are retained; no connection value, host, identity, raw output, or command history is persisted. |
| Transaction-pooler PgBouncer compatibility | ✅ Supported by runtime evidence | Engram records that the corrected compatibility configuration preceded the successful full Preview smoke. Configuration values were not accessed or persisted. |
| Full Preview smoke | ✅ Verified by sanitized receipt | Registration, login, dashboard, exercise creation, workout creation, and logout all passed with disposable data. Remote smoke was not rerun. |
| Reference-data delivery merged | ✅ Confirmed | Read-only delivery inspection reports the core and dependent archive PRs merged; the canonical migration on the merged branch matches `sha256:fee686635f614ddb4c8586895d7be4af296989416ffec253a065434c6684b512`. |
| Secret, URL, and raw-log persistence | ✅ Clean | The scoped artifact scan passed, and this report retains only sanitized states and hashes. |
| PR #1 read-only/unmerged boundary | ❌ Violated | PR #1 is merged despite the specification, proposal, design, tasks, and apply evidence requiring no merge. |

### Coherence (Design)

| Decision | Followed? | Notes |
|---|---|---|
| Transaction pooler for runtime; private session mode for migration | ✅ Yes | Sanitized checkpoint and smoke evidence are consistent with the design. |
| Human-only migration; no build migration | ✅ Yes | No remote rerun occurred; build remained migration-free. |
| One stable auth scope for Preview and Production | ✅ Yes | Sanitized checkpoint records shared scope without values. |
| Add only the Node engine declaration | ✅ Yes in worktree | The current worktree package diff is engine-only. |
| Fresh ordered Preview smoke | ✅ Yes | The latest receipt covers all required steps after reference-data delivery. |
| Read-only PR #1 assessment with no merge | ❌ No | Current independent PR state is merged. |

### Issues Found

**CRITICAL**

1. PR #1 is merged. This directly violates the requirement that readiness be assessed without merging or mutating PR #1; the persisted apply evidence still says `merge_performed: false`, so current delivery state and acceptance evidence are contradictory.
2. The required migration-failure scenario has no passing covering runtime test. With no project test runner and no authorized failed-migration receipt, it remains `UNTESTED` and cannot be declared compliant.

**WARNING**

1. The Node 24 declaration is present only in the current uncommitted worktree; the independently inspected merged branch package has no `engines` declaration. Reference-data delivery is merged, but the deployment declaration is not yet present in merged delivery.
2. The worktree still contains a pre-existing `.gitignore` modification. The apply baseline identifies it as preserved, but current Git metadata cannot independently attribute authorship.
3. PgBouncer compatibility is proven indirectly by the sanitized successful runtime receipt because direct platform configuration inspection and value access were explicitly forbidden.
4. The successful environment-file-free build emitted existing application warnings and handled missing runtime data access internally while still exiting 0; no migration or seed ran.
5. Lint retains one pre-existing React Hooks dependency warning in the login form.

**SUGGESTION**

1. Reconcile the SDD artifacts with the authorized delivery decision: either update the PR #1 boundary through a new approved spec delta or document why the merge supersedes that requirement before settlement.
2. Deliver the Node 24 package declaration through an approved tracked change so merged source and platform runtime cannot drift.
3. Add an isolated migration-failure harness that proves halt/no-retry/no-rollback behavior without using any remote database.

### Canonical Verification Evidence

The exact UTF-8 preimage below, including its trailing newline, hashes to `sha256:75a1eb7ec87d2a3298dbca950a75371899a5574f2e282c92ad491dccd1d5b2ab`. It is sanitized and safe for settlement; it contains no attempt token, secret, connection value, host, identity, or raw platform output.

```text
schema=gentle-ai.verification-evidence/v1
change=supabase-postgres-deployment
mode=standard
verdict=fail
requirements=5/7
scenarios=8/10
tasks=12/12
apply_evidence_sha256=370711584a3188204c0c270001c8dc06e49d075becb62bb42a20d786c49b0c64
package_sha256=b920ea29b36e35fe30e4e91bb6819d64c77f2a87d56748ea49ecbcc483261e75
node_engine_worktree=24.x
node_engine_merged_delivery=missing
build_script=prisma_generate_then_next_build
build_migration=false
build_seed=false
protected_path_scope=pass_with_preexisting_worktree_change
reference_data_delivery=merged
reference_data_migration_sha256=fee686635f614ddb4c8586895d7be4af296989416ffec253a065434c6684b512
transaction_pooler_pgbouncer_compatibility=sanitized_runtime_receipt_pass
preview_smoke=pass
preview_smoke_steps=registration,login,dashboard,exercise_creation,workout_creation,logout
migration_success_receipt=pass
migration_failure_scenario=untested
pr1_state=merged
pr1_read_only_boundary=failed
test_command=PATH="/tmp/opencode/node24-bin:$PATH" pnpm lint
test_exit_code=0
test_output_hash=sha256:66676b0b7418a865a838103e4d0cb7cb661e55d84481f5d6b9434f56b4069fad
typecheck_command=PATH="/tmp/opencode/node24-bin:$PATH" pnpm exec tsc --noEmit
typecheck_exit_code=0
typecheck_output_hash=sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855
build_command=PATH="/tmp/opencode/node24-bin:$PATH" pnpm build
build_exit_code=0
build_output_hash=sha256:c6181094a53c48ed8ac98e3789a0f5f69a953419901544a02ba8c2fb0e99c692
privacy_scan_exit_code=0
privacy_scan_output_hash=sha256:37810eab85bb1a21b2cdcc50cf4c3d2841db4f018c6ed2563c1c44161e33b2c5
raw_output_persisted=false
remote_migration_rerun=false
remote_smoke_rerun=false
native_settle=false
```

### Verdict

**FAIL**

The implementation and sanitized runtime receipts satisfy the deployment, Node 24 worktree, migration-success, privacy, reference-data, and full-smoke constraints, but final verification fails because PR #1 is now merged contrary to the authoritative specification and the migration-failure scenario has no passing runtime coverage.
