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

The script MUST detect an available `podman` or `docker` with `compose`, and MUST detect whether port 5432 is already bound, refusing with an actionable message rather than auto-assigning another port.

#### Scenario: Compose starts on a free port

- GIVEN a detected runtime and free port 5432
- WHEN infrastructure starts
- THEN `compose up -d` runs

#### Scenario: Port already in use

- GIVEN port 5432 is already bound
- WHEN the check runs
- THEN the script exits non-zero and refuses to start containers

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

The script MUST verify HTTP 200 or a "Ready" log line within a bounded timeout, and MUST exit non-zero if this check fails for any reason, including the pre-existing `tailwind.config.ts` CJS/ESM bug. A reported success MUST always correspond to a genuinely healthy, responding dev server.

#### Scenario: Healthy server

- GIVEN the dev server responds within the timeout
- WHEN the check completes
- THEN the script exits zero and reports success

#### Scenario: Health check fails

- GIVEN the dev server never responds within the timeout, for any reason
- WHEN the check completes
- THEN the script exits non-zero and MUST NOT report success

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
