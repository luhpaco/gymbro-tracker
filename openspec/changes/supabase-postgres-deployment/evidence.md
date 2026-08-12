# Sanitized Apply Evidence

## Guardrail Baseline

- worktree_status_captured: true
- existing_protected_file_change_preserved: true
- protected_paths_other_than_existing_change_clean: true
- package_build_baseline_captured: true
- package_build_unchanged: true
- build_migration_behavior: false
- build_seed_behavior: false

## Fail-Closed Boundary Tests (RED)

| Boundary | Expected result | Result |
|---|---|---|
| Wrong repository selector | Rejected | pass |
| Relative repository selector | Rejected | pass |
| Absolute repository selector | Rejected | pass |
| Fixed working directory | Required | pass |
| PR merge command | Rejected | pass |
| PR edit command | Rejected | pass |
| PR review command | Rejected | pass |
| PR close command | Rejected | pass |
| Environment-prefixed PR command | Rejected | pass |
| Composed PR command | Rejected | pass |
| Fixed-directory PR view | Permitted | pass |
| Fixed-directory PR checks | Permitted | pass |
| Fixed-directory PR diff | Permitted | pass |

## Repository Configuration (GREEN)

- node_engine_required: "24.x"
- node_engine_declared: true
- non_engine_package_changes: false
- lockfile_changed: false
- prisma_schema_changed: false
- migration_paths_changed: false
- seed_paths_changed: false
- repository_environment_files_changed: false

## Verification

- node_major: 24
- lint_exit_code: 0
- typecheck_exit_code: 0
- build_exit_code: 0
- build_completed: true
- build_migration_invoked: false
- build_seed_invoked: false
- agent_introduced_protected_path_changes: false

## Human Checkpoints

- external_platform_configuration: complete
- private_migration_receipt: complete
- preview_smoke_receipt: complete
- pr_read_only_assessment: complete

## Final Human-Checkpoint Evidence (Sanitized)

- supabase_free_provisioning: complete
- runtime_scope: preview_and_production
- runtime_connection_mode: transaction_pooler
- stable_auth_secret_scope: preview_and_production
- external_configuration_values_retained: false
- private_session_migration: succeeded
- migration_url_retained: false
- migration_raw_output_retained: false
- migration_retry_performed: false
- migration_rollback_performed: false
- migration_seed_performed: false
- fresh_browser_context: true
- disposable_test_data: true
- registration: pass
- login: pass
- dashboard: pass
- exercise_creation_with_muscle_group: pass
- workout_creation_with_exercise: pass
- logout: pass
- ordered_smoke_sequence: pass
- smoke_acceptance: accepted
- prior_incomplete_smoke_receipt: superseded_by_latest_complete_pass

## Historical Acceptance and Rollback State

- change_scoped_protected_path_audit: pass
- agent_introduced_protected_path_changes: false
- secret_disclosure_detected: false
- historical_final_acceptance: accepted
- rollback_boundary: available
- rollback_status: not_invoked
- automatic_down_migration_performed: false
- external_platform_mutation_by_this_finalization: false

## Superseded Preview Evidence (Sanitized)

- superseded: true
- retained_for_audit: true
- values_or_logs_retained: false

## PR #1 Historical Read-Only Assessment (Sanitized)

- fixed_cwd: true
- read_only_commands: view, checks, diff
- pr_state_at_original_assessment: open
- pr_state_in_current_local_history: merged
- changed_files: 39
- changed_lines: 4939
- review_budget_lines: 800
- approval_present: false
- required_checks_reported: false
- readiness: blocked
- mutation_count: 0
- original_assessment_agent_merge_performed: false

## Evidence Safety

- secret_values_observed: false
- template_content_observed: false
- raw_output_retained: false
- command_history_retained: false
- hostnames_retained: false
- identities_retained: false

## Corrective Delivery Evidence

- corrective_scope_limited_to_authorized_files: true
- package_node_engine: "24.x"
- package_non_engine_changes: false
- migration_failure_harness: passed
- simulated_migration_attempts: 1
- acceptance_continued_after_failure: false
- smoke_continued_after_failure: false
- retry_invoked: false
- seed_invoked: false
- migration_rewrite_invoked: false
- rollback_invoked: false
- connection_input_invoked: false
- connection_output_invoked: false
- connection_persistence_invoked: false
- database_connection_attempted: false
- environment_files_read: false
- input_values_accepted: false
- prisma_seed_or_migration_command_invoked: false
- local_lint: unavailable_missing_local_dependencies
- local_typecheck: unavailable_missing_local_dependencies
- environment_dependent_build: not_run
- native_settlement: not_run
- corrective_verification: pending
- archive: pending

## Corrective Evidence Revision

The following sanitized UTF-8 preimage, including its trailing newline, identifies this corrective local evidence. It retains no URLs, hosts, account data, environment values, secrets, or raw command output.

```text
schema=gymbro-tracker.corrective-evidence/v1
change=supabase-postgres-deployment
package_node_engine=24.x
package_non_engine_changes=false
migration_failure_harness=pass
simulated_migration_attempts=1
acceptance_continued=false
smoke_continued=false
retry=false
seed=false
migration_rewrite=false
rollback=false
connection_input=false
connection_output=false
connection_persistence=false
database_connection_attempted=false
environment_files_read=false
input_values_accepted=false
prisma_seed_or_migration_command_invoked=false
lint=unavailable_missing_local_dependencies
typecheck=unavailable_missing_local_dependencies
build=not_run_environment_dependent
corrective_verification=pending
archive=pending
native_settlement=not_run
```

- corrective_evidence_revision: sha256:881e46da3a2ac2eec84279d65c61ae0c8bab1d4ee27f8a618cf6ea813504810c
