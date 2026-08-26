# Worktree Provisioning Specification

## Purpose

Provisioning, verification, and cleanup contract for isolated git worktrees in gymbro-tracker: a fresh worktree becomes runnable (env, DB, migrations, CodeGraph index) via one script invocation, and teardown never loses uncommitted work or deletes branches.

## Requirements

### Requirement: Manifest Format and File Copy

`.worktreeinclude` MUST list one relative path per line; `#` and blank lines MUST be ignored. It MUST include `.env`, `.env.local`, `.mcp.json`, and `.claude/skills/agent-browser`. The script MUST copy entries with `cp -a` (preserving symlinks), MUST `chmod 0600` every copied `.env*` file, and MUST run `pnpm install` after copying.

#### Scenario: Parsing manifest entries

- GIVEN a manifest with comments, blanks, and paths
- WHEN parsed
- THEN only non-comment, non-blank lines are copied

#### Scenario: Symlink preserved

- GIVEN `.claude/skills/agent-browser` is a symlink
- WHEN copied
- THEN the destination remains a symlink, not a dereferenced copy

#### Scenario: Env permissions enforced

- GIVEN `.env`/`.env.local` are copied
- WHEN the copy step completes
- THEN both files have mode `0600`

### Requirement: Provisioning Preconditions

The script MUST refuse to run against the main checkout and MUST verify the target is a registered git worktree before making any change.

#### Scenario: Refuse main checkout

- GIVEN invocation from the main checkout
- WHEN preconditions run
- THEN the script exits non-zero with no side effects

#### Scenario: Unknown worktree

- GIVEN a path absent from `git worktree list`
- WHEN preconditions run
- THEN the script exits non-zero

### Requirement: Runtime Detection and Port Guard

The script MUST detect an available `podman` or `docker` with `compose`. Instead of refusing on a bound default port, the script MUST scan for the first free host port for Postgres in the range 5433–5443 and for the dev server in the range 3001–3011, scanning upward from the start of each range with a bounded number of attempts. The script MUST persist the assigned pair in a worktree-local, gitignored `.worktree-port` file and MUST reuse those exact values on re-provision rather than re-scanning, preserving idempotency for a worktree whose own stack already holds its assigned port (generalized from the prior literal-5432 check). If no free port is found within a scanned range, the script MUST fail hard and MUST report the exact scanned range in the error message, with no fallback to the old refuse-with-message guard. The main checkout's default behavior (host port `5432` for Postgres, `3000` for the dev server) MUST remain unchanged, and running the script against the main checkout MUST NOT create or read a `.worktree-port` file.
(Previously: MUST detect whether port 5432 is already bound, refusing with an actionable message rather than auto-assigning another port.)

#### Scenario: Compose starts on the resolved port

- GIVEN a detected runtime and a resolved host port (literal `5432` for the main checkout, or the assigned value from `.worktree-port` for a worktree)
- WHEN infrastructure starts
- THEN `compose up -d` runs against that resolved port

#### Scenario: Fresh worktree scans and assigns ports

- GIVEN a new worktree with no `.worktree-port` file and ports 5433 and 3001 are free
- WHEN provisioning runs
- THEN the script assigns Postgres port 5433 and dev-server port 3001
- AND persists both values to a gitignored `.worktree-port` file in the worktree

#### Scenario: Scan skips occupied ports within range

- GIVEN 5433 is already bound by another worktree's stack and 5434 is free
- WHEN the Postgres port scan runs
- THEN the script assigns 5434 and persists it

#### Scenario: Re-provision reuses persisted ports

- GIVEN a worktree already has a `.worktree-port` file from a prior successful provision
- WHEN the script re-runs
- THEN it reads and reuses the exact persisted port pair without re-scanning
- AND it tolerates its own stack already holding that assigned port, without treating that as a collision

#### Scenario: Exhausted range fails hard with the scanned range reported

- GIVEN every port in 5433–5443 (or 3001–3011) is already bound
- WHEN the scan completes its bounded attempts
- THEN the script exits non-zero
- AND the error message states the exact range that was scanned
- AND no fallback to the old refuse-with-message guard occurs

#### Scenario: Main checkout keeps literal defaults

- GIVEN the script (or its port-assignment logic) is invoked against the main checkout
- WHEN it resolves ports
- THEN it resolves to literal Postgres port `5432` and dev-server port `3000`
- AND no `.worktree-port` file is created or read

### Requirement: Per-Worktree Env Rewrite

After the manifest copy step, the script MUST rewrite the worktree's copied `.env` to reflect its assigned Postgres port: `POSTGRES_HOST_PORT` MUST be set to the assigned port, and the port segment embedded in `POSTGRES_URL` MUST match it. The `POSTGRES_URL` port-segment rewrite MUST additionally apply to every other copied `.env*` file (e.g. `.env.local`) in the manifest that also contains a `POSTGRES_URL=` line, since Next.js resolves `.env.local` ahead of `.env`; `POSTGRES_HOST_PORT` itself is only ever set in `.env`, since that is the file the container runtime reads. This rewrite MUST apply only inside the worktree's own copied files and MUST NOT modify any file in the main checkout.

#### Scenario: Worktree env reflects assigned port

- GIVEN a worktree assigned Postgres port 5435
- WHEN the `.env` rewrite step runs
- THEN the copied `.env`'s `POSTGRES_HOST_PORT` is `5435`
- AND the port segment in `POSTGRES_URL` is also `5435`

#### Scenario: .env.local also gets its POSTGRES_URL port rewritten

- GIVEN a worktree assigned Postgres port 5435 and a copied `.env.local` that also contains a `POSTGRES_URL=` line
- WHEN the env rewrite step runs
- THEN the port segment in `.env.local`'s `POSTGRES_URL` is also `5435`
- AND `.env.local` gains no `POSTGRES_HOST_PORT` line

#### Scenario: Main checkout env untouched

- GIVEN the main checkout's own `.env` and `.env.local`
- WHEN provisioning logic runs elsewhere
- THEN neither file in the main checkout is ever modified by this rewrite step

### Requirement: Database Readiness and Migration

The script MUST wait for Postgres readiness within a bounded timeout, then MUST run `prisma migrate deploy` (never `migrate dev`).

#### Scenario: Database ready in time

- GIVEN Postgres becomes ready within the timeout
- WHEN readiness is confirmed
- THEN `prisma migrate deploy` runs

#### Scenario: Database never ready

- GIVEN Postgres does not become ready within the timeout
- WHEN the wait expires
- THEN the script exits non-zero and leaves running containers as-is for retry

### Requirement: Conditional CodeGraph Init

The script MUST run `codegraph init` only when the worktree lacks its own `.codegraph/` index.

#### Scenario: Index absent

- GIVEN no `.codegraph/` in the worktree
- WHEN this step runs
- THEN `codegraph init` executes

#### Scenario: Index present

- GIVEN `.codegraph/` already exists
- WHEN this step runs
- THEN init is skipped

### Requirement: Dev Server Health Check Defines Success

The script MUST verify HTTP 200 or a "Ready" log line within a bounded timeout against the worktree's assigned dev-server port (read from `.worktree-port`), not a hardcoded `3000`, and MUST exit non-zero if this check fails for any reason, including the pre-existing `tailwind.config.ts` CJS/ESM bug. A reported success MUST always correspond to a genuinely healthy, responding dev server on the assigned port. The dev-server port MUST be passed to the `pnpm dev`/`next dev` process as a real process environment variable, never via `.env`, since Next.js reads `PORT` only from the real process environment. The `package.json` `dev` script MUST NOT be modified to accommodate this.
(Previously: MUST verify HTTP 200 or a "Ready" log line within a bounded timeout, and MUST exit non-zero if this check fails for any reason, including the pre-existing `tailwind.config.ts` CJS/ESM bug. A reported success MUST always correspond to a genuinely healthy, responding dev server.)

#### Scenario: Healthy server on assigned port

- GIVEN the worktree's dev server responds on its assigned port (e.g. 3002) within the timeout
- WHEN the check completes
- THEN the script exits zero and reports success

#### Scenario: Health check fails

- GIVEN the dev server never responds on its assigned port within the timeout, for any reason
- WHEN the check completes
- THEN the script exits non-zero and MUST NOT report success

#### Scenario: Port passed as real process env, not via .env

- GIVEN a worktree assigned dev-server port 3002
- WHEN the script launches `pnpm dev`/`next dev` for the health check
- THEN `PORT=3002` is set in the real process environment of that invocation
- AND `.env` is not used to carry the dev-server port
- AND `package.json`'s `dev` script remains unmodified

### Requirement: Idempotency and Partial-Failure Retry

Re-running the script MUST be safe and MUST skip already-satisfied steps. On a mid-run failure, the script MUST leave partial state as-is (no automatic `compose down`, no auto-deleting copied files) for the next retry.

#### Scenario: Re-run after success

- GIVEN a fully-provisioned worktree
- WHEN re-run
- THEN satisfied steps are skipped without error

#### Scenario: Re-run after partial failure

- GIVEN a prior run died mid-way (e.g., Postgres never ready)
- WHEN re-run
- THEN it resumes from the failed step without repeating or unwinding earlier steps

### Requirement: Cleanup Guard, Teardown Order, and Branch Preservation

`worktree-cleanup.sh` MUST verify the target is a known worktree and MUST refuse uncommitted changes unless `--force`. It MUST tear down infrastructure (containers, `codegraph uninit -f`) before removing files, then run `git worktree remove` and `git worktree prune`. Cleanup MUST remove only the worktree directory and its infrastructure and MUST NOT delete the associated git branch.

#### Scenario: Refuse without force

- GIVEN uncommitted changes and no `--force`
- WHEN cleanup runs
- THEN it exits non-zero, deleting nothing

#### Scenario: Force proceeds

- GIVEN uncommitted changes and `--force`
- WHEN cleanup runs
- THEN teardown proceeds

#### Scenario: Infra torn down before removal, branch preserved

- GIVEN a worktree passes preconditions
- WHEN cleanup completes
- THEN containers and CodeGraph index are removed before the worktree directory, and the git branch still exists

### Requirement: Worktree Documentation and CLAUDE.md Updates

`.claude/rules/worktrees.md` MUST document all three worktree mechanisms and when each applies, the naming convention (flatten `/` to `-`) plus its one documented historical exception (`shared-form-state-contrast`), triggers/non-triggers for opening a worktree, and MUST flag OpenCode-cwd behavior as an unverified open item rather than an asserted mechanism. `CLAUDE.md` MUST add a `## Worktrees` section, two new command-table rows for the provisioning and cleanup scripts, and MUST correct the stale `docker compose up -d` row to the installed `podman` runtime.

#### Scenario: Naming exception documented

- GIVEN a reader consults naming conventions
- WHEN they read about `shared-form-state-contrast`
- THEN it is documented as a permanent exception, not a violation

#### Scenario: OpenCode-cwd flagged unverified

- GIVEN a reader consults the OpenCode-cwd section
- WHEN they read its status
- THEN it is presented as unverified, not a confirmed mechanism

#### Scenario: CLAUDE.md command table updated

- GIVEN a reader consults Useful Commands
- WHEN they look for worktree/container commands
- THEN provision, cleanup, and the corrected runtime command are all present

### Requirement: Backfill Verification for shared-form-state-contrast

Running the finished, dry-run-tested script against `shared-form-state-contrast` MUST verify via `git status --short` before and after that the worktree's existing uncommitted `tailwind.config.ts` changes and untracked `openspec/changes/shared-form-state-contrast/` are unchanged.

#### Scenario: Backfill preserves existing state

- GIVEN `git status --short` captured before the script runs
- WHEN the script completes and `git status --short` is captured again
- THEN the `tailwind.config.ts` diff and the untracked `openspec/changes/shared-form-state-contrast/` entry are identical in both captures
