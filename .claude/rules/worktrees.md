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

## Port isolation

Each worktree gets its own Postgres host port (scanned upward from 5433, range 5433–5443) and dev-server port (scanned upward from 3001, range 3001–3011), so multiple worktrees' stacks and dev servers can run simultaneously without colliding with the main checkout's defaults (Postgres `5432`, dev server `3000`) or with each other's stacks.

- **Assignment**: ports are resolved in one step, right after container-runtime detection. A fresh worktree scans each range upward for the first free port; a worktree with an existing `.worktree-port` file reuses its persisted pair verbatim — tolerating its own already-running stack/dev-server on that port — instead of re-scanning.
- **`.worktree-port`**: worktree-root, gitignored (`/.worktree-port`), exactly two lines, `KEY=VALUE`, never sourced or `eval`'d — parsed with an anchored `grep -E '^KEY=[0-9]+$'` plus a range check.
  ```
  POSTGRES_HOST_PORT=5433
  DEV_PORT=3001
  ```
  A missing, malformed, or out-of-range value is treated as absent and triggers a fresh scan rather than executing untrusted file content. It is never removed by either script — it dies with the worktree directory when `git worktree remove` runs.
- **`.env` rewrite**: after the manifest copy, the worktree's own copied `.env` gets `POSTGRES_HOST_PORT` set to the assigned port and its `POSTGRES_URL`'s port segment rewritten to match. Every other copied `.env*` file that also has a `POSTGRES_URL=` line (in practice, `.env.local`) gets the same port-segment rewrite, since Next.js resolves `.env.local` ahead of `.env` — but `.env.local` never gains a `POSTGRES_HOST_PORT` line, since only `.env` is read by the container runtime. None of this ever touches the main checkout's own `.env`/`.env.local`.
- **Dev-server port**: passed to `pnpm dev`/`next dev` as a real process environment variable (`PORT=<port>`), never via `.env` (Next.js does not read `PORT` from `.env`). `package.json`'s `dev` script is never modified. To run the dev server manually after provisioning:
  ```bash
  PORT=$(grep -E '^DEV_PORT=[0-9]+$' .worktree-port | cut -d= -f2) pnpm dev
  ```
- **Exit codes 7 and 12 reused, meaning generalized**: `7` now covers any Postgres-port failure (range exhausted, a persisted port held by another process/stack, or the `.env`/`.env.local` `POSTGRES_URL` rewrite could not be verified); `12` covers any dev-server-port failure (range exhausted, or a persisted port held by another process). The error message always names the exact scanned range, or the offending port plus `.worktree-port`.
- **Main checkout unaffected**: the existing `$WT != $MAIN` guard makes all of the above unreachable for the main checkout, which keeps the literal defaults (`5432`, `3000`) and never creates or reads `.worktree-port`.

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
- On SELinux-enforcing hosts (the norm on Fedora), `worktree-provision.sh` pre-labels the target worktree's bind-mounted `postgres/` data directory `container_file_t` before starting the container stack — the same relabeling a `:Z` mount flag would do. This was discovered during dry-run testing: without it, the postgres image's own permission bootstrap silently fails inside the container and Postgres never becomes ready. This SELinux relabeling step does not itself require any `docker-compose.yml` change, and the file is still shared with the main checkout (its only change for port isolation is the `${POSTGRES_HOST_PORT:-5432}` default, which keeps every already-provisioned worktree and the main checkout on today's behavior with no `.env` edit required).
- A Next.js dev-server run inside a freshly provisioned worktree has been observed to create a stray, harmless, untracked symlink under `.agents/skills/agent-browser/` a few seconds after startup (most likely a file-watcher artifact of `.claude/skills/agent-browser` being a real symlink). It is untracked, confined to that worktree, and does not affect provisioning or migration state — `worktree-cleanup.sh` removes it along with everything else when the worktree is torn down.
- `git status --porcelain` excludes gitignored files, so `.worktree-port` is invisible to `worktree-cleanup.sh`'s dirty check **only on a branch that carries the `/.worktree-port` line** added to `.gitignore` by worktree-port-isolation. A worktree created from an older branch (one that predates this line) will see `.worktree-port` as untracked, and cleanup will correctly refuse without `--force` — this is expected, not a bug to work around, since `.worktree-port` is deliberately persistent per-worktree state, not a log file that can simply be deleted on success like `.worktree-dev.log`.
- Two worktrees' `.worktree-port` files can end up with the same `DEV_PORT`: the dev-server port is only reserved for the duration of the provisioning health check (the dev server is killed and its log removed on success), so it is not continuously held the way the Postgres port is via the running container. Assigning both worktrees' Postgres ports never collides, since those containers stay up. This is an accepted, low-risk race window, not a defect — see Design Decision 1 in `openspec/changes/worktree-port-isolation/design.md`.

## Cleanup checklist

`worktree-cleanup.sh <path> [--force]`:

1. Refuses to run against the main checkout or an unregistered path (exit 2).
2. Refuses if the worktree has uncommitted changes — staged, unstaged, **or untracked** — unless `--force` is given (exit 3).
3. Tears down the container stack (`compose down`), then removes the CodeGraph index, then removes the container-owned `postgres/` data directory (needed under rootless podman so `git worktree remove` doesn't fail with "Directory not empty"), then removes the worktree directory itself, then prunes.
4. **Never deletes the git branch.** The worktree directory and its infrastructure are disposable; the branch is work product, possibly pushed or backing an open PR. After cleanup, `git branch` still lists it — delete it yourself if and when it's actually merged or abandoned.
