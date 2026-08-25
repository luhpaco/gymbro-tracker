# Worktrees — gymbro-tracker

Provisioning, verification, and cleanup contract for isolated git worktrees: a fresh worktree becomes runnable (env, DB, migrations, CodeGraph index) via one script invocation, and teardown never loses uncommitted work or deletes branches.

## Which mechanism?

| Trigger | Mechanism |
|---|---|
| Another session has uncommitted work in the main checkout; task needs an isolated DB/env; parallel Claude + OpenCode work on unrelated changes | **Manual sibling worktree + `worktree-provision.sh`** (primary, documented below) |
| One-off Claude-Code-only isolation, no DB/env, no OpenCode | `EnterWorktree`/`ExitWorktree` — lands in `.claude/worktrees/`, no provisioning, does not satisfy the CodeGraph sibling-directory rule from the global config |
| Single delegated sub-task that must not touch the checkout | `Agent(isolation:"worktree")` — auto-cleans only if the agent made no changes |
| Small in-place fix already covered by `/sdd-apply` | No worktree |

## Quick path

```bash
git worktree add ../gymbro-tracker-worktrees/<name> -b <branch>
scripts/worktree-provision.sh ../gymbro-tracker-worktrees/<name>
# ... work in the worktree ...
scripts/worktree-cleanup.sh ../gymbro-tracker-worktrees/<name>          # refuses if dirty
scripts/worktree-cleanup.sh ../gymbro-tracker-worktrees/<name> --force  # discards uncommitted changes, tears down infra
```

`worktree-provision.sh` copies gitignored files, runs `pnpm install`, starts the container stack, waits for Postgres, runs `prisma migrate deploy`, initializes CodeGraph if missing, then proves the dev server actually compiles and responds (HTTP 200 or a "Ready" log line) before exiting 0. It is idempotent: re-running skips or converges every already-satisfied step, and a mid-run failure leaves state as-is — just re-run to resume.

## Triggers vs non-triggers

| Open a worktree | Do not open a worktree |
|---|---|
| Concurrent Claude + OpenCode sessions on unrelated branches | Single-file, low-risk fix already handled inline or via `/sdd-apply` |
| A task needs its own Postgres instance / migration state independent of the main checkout | Read-only exploration or research |
| Long-running branch work that would otherwise force switching branches in the main checkout mid-task | Anything that fits comfortably as a normal commit on the current branch |

## Naming convention

New worktree directories flatten the branch name's `/` to `-` (e.g. branch `fix/foo-bar` → directory `../gymbro-tracker-worktrees/fix-foo-bar`).

**Historical exception**: `shared-form-state-contrast` was created before this convention was formalized and is **not** renamed — renaming an in-flight worktree with uncommitted work buys nothing and risks the exact disruption this document exists to avoid. Treat it as a permanent, documented exception, not a violation to fix.

## `.worktreeinclude` format

`.worktreeinclude`, in the main checkout root, lists one repo-relative path per line; `worktree-provision.sh` copies each into the target worktree.

```
# Comments and blank lines are ignored.
# One repo-relative path per line. Directories are copied recursively.
.env
.env.local
.mcp.json
.claude/skills/agent-browser
```

- Blank lines and lines whose first non-space character is `#` are ignored.
- Absolute paths and any path containing a `..` segment are rejected (exit 3) — never add one.
- Entries are copied with `cp -a` (symlinks preserved, not dereferenced) and every copied `.env*` destination is `chmod 0600`.
- A missing source path is a warning, not a failure.
- Never add anything that duplicates a secret outside `.env*` — this manifest is read by a plain shell loop (no `eval`/`source`, no glob expansion), but it is still copied verbatim into a new working tree.

## CodeGraph per worktree

Every worktree needs its own `.codegraph/` index — never copy, symlink, or reuse another checkout's index, since an index encodes its own root and checked-out bytes. `worktree-provision.sh` runs `codegraph init` only when `.codegraph/` is absent from the target worktree; `worktree-cleanup.sh` removes it with `codegraph uninit -f`.

## Known limits

- `Unverified`: how OpenCode sets its working directory when delegating to a worktree was not confirmed during implementation of this change. OpenCode has no native worktree tool and must be pointed at the worktree path manually — do not assume a specific mechanism; verify before relying on it for a given task.
- `ExitWorktree` does not apply to this manual sibling-worktree mechanism — it only reverses Claude Code's own `EnterWorktree`.
- On SELinux-enforcing hosts (the norm on Fedora), `worktree-provision.sh` pre-labels the target worktree's bind-mounted `postgres/` data directory `container_file_t` before starting the container stack — the same relabeling a `:Z` mount flag would do. This was discovered during dry-run testing: without it, the postgres image's own permission bootstrap silently fails inside the container and Postgres never becomes ready. `docker-compose.yml` itself is not modified, since it is shared with the main checkout.
- A Next.js dev-server run inside a freshly provisioned worktree has been observed to create a stray, harmless, untracked symlink under `.agents/skills/agent-browser/` a few seconds after startup (most likely a file-watcher artifact of `.claude/skills/agent-browser` being a real symlink). It is untracked, confined to that worktree, and does not affect provisioning or migration state — `worktree-cleanup.sh` removes it along with everything else when the worktree is torn down.

## Cleanup checklist

`worktree-cleanup.sh <path> [--force]`:

1. Refuses to run against the main checkout or an unregistered path (exit 2).
2. Refuses if the worktree has uncommitted changes — staged, unstaged, **or untracked** — unless `--force` is given (exit 3).
3. Tears down the container stack (`compose down`), then removes the CodeGraph index, then removes the container-owned `postgres/` data directory (needed under rootless podman so `git worktree remove` doesn't fail with "Directory not empty"), then removes the worktree directory itself, then prunes.
4. **Never deletes the git branch.** The worktree directory and its infrastructure are disposable; the branch is work product, possibly pushed or backing an open PR. After cleanup, `git branch` still lists it — delete it yourself if and when it's actually merged or abandoned.
