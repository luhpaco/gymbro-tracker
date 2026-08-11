# Design: Supabase PostgreSQL Deployment

## Technical Approach

Use a gated workflow: the user provisions Supabase Free, enters Vercel secrets, and privately runs migration. Runtime uses transaction pooling; migration uses a session-mode URL. A user-confirmed scope audit classifies the secret-shaped `.env.template` literal as a safe placeholder that was never used as a real secret, so no rotation is required. Corrective local validation adds a deterministic zero-I/O migration-failure harness. PR #1 is already merged, but the original assessment remains recorded as agent-read-only.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Transaction runtime; session migration | Requires operator discipline | Supabase recommends transaction mode for serverless traffic and direct/session connectivity for migrations; the migration URL never enters Vercel or the repository. |
| Human migration vs build migration | Manual checkpoint instead of automatic convenience | Human-only. It prevents every Preview build from mutating the shared database and creates a hard stop on failure. |
| One Vercel entry per key targeting both environments | Shared database/auth lifecycle | Proves scope and stable `AUTH_SECRET` without exposing values. |
| Read-only PR assessment | Cannot fix or merge blockers | Chosen because PR mutation and Production launch are out of scope. |
| Local simulated migration failure | Does not prove remote migration behavior | Chosen to prove the fail-closed continuation boundary without a database, environment input, or platform mutation. |

## Sequenced Flow

    Human provision/configure
             │
             ▼
    Protected-path audit ──→ HUMAN CHECKPOINT ──→ private migration
                                                     │ success only
                                                     ▼
                                      Preview deploy → fresh smoke → PR assessment

1. Capture worktree state; preserve the current `.gitignore` modification without staging, cleaning, or overwriting it.
2. User provisions an empty Supabase Free project. No agent receives credentials.
3. User configures Vercel Node `24.x` and sensitive `POSTGRES_URL`/`AUTH_SECRET` entries targeting Preview and Production. Runtime mode is transaction pooling.
4. Add only `engines.node: "24.x"` to `package.json`; keep the lockfile and `scripts.build` unchanged.
5. **Human checkpoint:** confirm the empty project, masked key/scope metadata, stable auth entry, and transaction mode. Record as an audit fact—without inspecting or reproducing template content—that the secret-shaped `.env.template` literal is a safe, never-used placeholder and requires no rotation.
6. User privately injects the session-mode URL, runs only `pnpm exec prisma migrate deploy`, records sanitized exit evidence, unsets the variable, and closes the session. Failure halts; no retry, seed, rollback, or smoke follows.
7. Deploy Preview and run registration → login → dashboard → exercises → workouts → logout in a new browser context. Exercise/workout pages validate protected empty states; never invoke `pnpm seed`, `/api/seed`, or reference-data create flows.
8. Preserve the original PR #1 assessment as read-only with zero agent mutation. PR #1 is now merged as a later historical fact; do not attribute that merge to the original assessment or claim archive/verification success.
9. Run the local deterministic failure harness. It simulates one migration failure without database access, environment reads, command execution, accepted input, connection I/O, or persistence; it proves acceptance and smoke do not start and no retry, seed, rewrite, or rollback occurs.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Modify during apply | Add only the Node engine declaration. |
| `scripts/validate-migration-failure-guardrails.ts` | Add during corrective delivery | Deterministically proves the local failure-continuation boundary with no external I/O. |
| `prisma/schema.prisma`, `prisma/migrations/`, `pnpm-lock.yaml`, `.gitignore`, `src/seed/`, `src/app/api/seed/route.ts` | Preserve | Baseline and post-change snapshots must match. |

## Evidence Contract

```yaml
platform: {plan: Free, database_empty_before_migration: true, secret_values_observed: false}
scope_audit: {template_literal: safe_unused_placeholder, rotation_required: false, template_content_observed: false}
vercel: {node: 24.x, POSTGRES_URL_targets: [Preview, Production], AUTH_SECRET_targets: [Preview, Production], same_auth_entry: true}
migration: {operator: human, command: "pnpm exec prisma migrate deploy", mode: session, exit_code: 0, committed_migrations_applied: 9, raw_output_retained: false}
deployment: {environment: Preview, status: READY, commit_sha: "<sha>", node_major: 24, build_migration: false, seed_run: false}
smoke: {fresh_context: true, ordered_steps: [registration, login, dashboard, exercises, workouts, logout], result: pass, identity: disposable, credentials_retained: false}
pr1: {historical_assessment_state: OPEN, current_state: MERGED, original_agent_mutations: 0, changed_lines: 4939, budget: 800, corrective_verification: pending}
```

Persist no secret values/hashes, hosts, project references, usernames, credentials, emails, raw logs, command history, or settings screenshots.

## Testing Strategy

| Layer | Approach |
|---|---|
| Static | Protected-path baseline, exact build script, `engines.node`, lint, and type-check checks. |
| Build | `pnpm build` under Node 24; assert no migration or seed command. |
| Local harness | Simulate one migration failure; assert acceptance/smoke halt and zero prohibited effects without database or environment access. |
| Integration/E2E | Human migration receipt, READY deployment metadata, and ordered fresh-context smoke receipt. |

## Threat Matrix

| Boundary | Applicability | Safe/failure behavior | Planned RED test |
|---|---|---|---|
| Documentation-like paths | N/A — no executable classification | No execution introduced | None |
| Git repository selection | Applicable | Fixed repository/cwd; mismatch fails closed | Wrong cwd, relative selector, absolute selector |
| Commit state | N/A — no staging/commit | Local state remains untouched | None |
| Push state | N/A — no push | Push is forbidden | None |
| PR commands | Applicable | Allow only read-only `view`, `checks`, and `diff`; any mutation/composition fails | Reject merge/edit/review/close, environment prefixes, composed commands |

## Migration / Rollback

The rollback boundary is migration start. Before it, remove external configuration, revert Node/package settings, and discard the empty project. After it, never down-migrate or delete automatically: disable deployments/secrets, redeploy the prior commit, and require a forward-fix decision.

## Open Questions

None. The user-confirmed placeholder classification resolves the prior acceptance blocker.
