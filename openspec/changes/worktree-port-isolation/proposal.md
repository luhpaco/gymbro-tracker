# Proposal: Worktree Port Isolation

## Intent

`worktree-provision.sh` refuses to provision when host port 5432 or 3000 is already bound (lines 190-197, 263-266). That was a deliberate trade-off in the archived `worktree-strategy` design, justified by "a single-developer machine where 'shut down the other stack' is a one-liner". The soak test falsifies that premise: two concurrent agent sessions (Claude Code + OpenCode) in sibling worktrees cannot free a port without killing the other agent's live stack. Data isolation already works per worktree (`./postgres` bind mount, per-directory compose project name); only the shared host port binding blocks concurrency. This proposal supersedes that one rejected alternative, not the rest of the prior design.

## Scope

### In Scope

- Parametrize `docker-compose.yml:15` as `${POSTGRES_HOST_PORT:-5432}:5432`, default unchanged.
- `worktree-provision.sh`: replace both refuse-guards with scan-and-assign — pick the first free port from a base offset, persist it in a worktree-local, gitignored `.worktree-port`, reuse it on re-provision. Preserve the existing "tolerant when this worktree's own stack holds it" idempotency.
- Rewrite the copied `.env`'s Postgres port (`POSTGRES_HOST_PORT` and the port embedded in `POSTGRES_URL`) post-copy, per worktree only.
- Pass the assigned dev-server port into the real process env when launching `pnpm dev`, and point the health-check curl at it instead of literal `localhost:3000`.
- `.gitignore`: add `/.worktree-port`. `.env.template`: add the new port var if design introduces one.
- `.claude/rules/worktrees.md`: document assignment, the state file, and the manual `pnpm dev` invocation for an assigned port.

### Out of Scope

- CI (`.github/workflows/ci.yml`) — never runs compose; confirmed unaffected.
- DB/data isolation itself (already correct) and shared-instance/per-schema designs.
- A global cross-repo port registry or lockfile.
- Any other PR #30 scope; `worktree-cleanup.sh` teardown order (already port-agnostic — `.worktree-port` dies with the directory).
- Modifying `package.json`'s `dev` script — preferred path is an env-var invocation, not a script rewrite. Design confirms.

## Capabilities

### New Capabilities

- None

### Modified Capabilities

- `worktree-provisioning`: "Runtime Detection and Port Guard" changes from refuse-on-collision to scan-and-assign with a persisted per-worktree port; the dev-server health check targets the assigned port; docs requirement extends to the new convention.

## Approach

Free-port scan + worktree-local persisted state (exploration Approach 2). Chosen over hash-derived ports (needs a live-scan fallback anyway) and a global registry (new cross-repo state with staleness risk — the exact cost the original design rejected). Keeps every worktree reasoning only about its own state, like `.codegraph/` and `postgres/`.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `docker-compose.yml` | Modified | Variable host port, default `5432` |
| `scripts/worktree-provision.sh` | Modified | Scan-and-assign, `.env` port rewrite, port-aware health check |
| `.gitignore` | Modified | Ignore `/.worktree-port` |
| `.env.template` | Modified | New port var, only if introduced |
| `.claude/rules/worktrees.md` | Modified | Document assignment + manual `pnpm dev` |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Bad default silently breaks main checkout and every existing worktree (shared tracked files) | Med | Explicit main-checkout regression scenario: default resolves to literal `5432`/`3000` with no `.worktree-port` present |
| `podman compose` may not auto-load a project-directory `.env` for substitution | Med | Verify against the installed version in design/apply before relying on it |
| Exact `.env`/`.env.template` key names unconfirmed (permission-denied to tooling) | Med | Human confirms key list and port format in `sdd-design` |
| Assigned port re-occupied between provision and later `pnpm dev` | Low | Same risk class the current guards already accept; fail loudly |
| Dropping the "own stack holds the port" tolerance breaks idempotent re-provision | Low | Preserve that branch explicitly; covered by a re-run scenario |

## Rollback Plan

Revert the five files. No migration, schema, or application-runtime change; already-provisioned worktrees fall back to the `5432`/`3000` defaults, and any stale `.worktree-port` is inert once the scripts no longer read it. Worktree infrastructure remains disposable via `scripts/worktree-cleanup.sh`.

## Confirmed Parameters

User-confirmed during the proposal question round:

- Dev-server port invocation: documented one-liner (e.g. `PORT=$(cat .worktree-port) pnpm dev`); `package.json` stays untouched.
- Scan range: Postgres 5433–5443, dev server 3001–3011, scanning upward with a bounded attempt count.
- No extra discoverability tooling — `.worktree-port` plus the provisioning summary line is sufficient.
- Exhausted range: fail hard, reporting the exact scanned range in the error message (no silent fallback to the old refuse-with-message guard).

## Dependencies

- Installed `podman compose` behavior for `.env` variable substitution (verify).
- Human confirmation of `.env`/`.env.template` key names.

## Success Criteria

- [ ] Two sibling worktrees provision and run concurrently without a port collision.
- [ ] Main checkout still uses `5432`/`3000` with no `.worktree-port` and no behavior change.
- [ ] Re-provisioning a running worktree reuses its assigned ports and stays idempotent.
- [ ] The dev-server health check verifies the assigned port, not a hardcoded `3000`.
- [ ] `.claude/rules/worktrees.md` documents how a human starts `pnpm dev` on an assigned port.
