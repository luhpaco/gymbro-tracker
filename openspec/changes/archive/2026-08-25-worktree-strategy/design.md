# Design: Worktree Strategy

## Technical Approach

Two idempotent bash scripts plus a parsed `.worktreeinclude` turn the existing ad-hoc sibling-worktree convention into a provisioning contract. `worktree-provision.sh` drives a linear, fail-fast pipeline (guards → gitignored-file copy → install → container runtime → DB → migrations → CodeGraph → real compile proof). `worktree-cleanup.sh` reverses only the disposable infrastructure. `.claude/rules/worktrees.md` documents which of three worktree mechanisms applies to which trigger. No application code, schema, or migration is touched.

## Architecture Decisions

### Decision: Manual sibling worktree stays the primary mechanism

**Choice**: `git worktree add ../gymbro-tracker-worktrees/<name>` + `worktree-provision.sh`.
**Alternatives considered**: Claude Code's native `EnterWorktree`/`ExitWorktree`; `Agent(isolation:"worktree")`.
**Rationale**: `EnterWorktree` creates worktrees under `.claude/worktrees/` *inside* the repo, which contradicts the global CLAUDE.md CodeGraph rule (worktrees must be siblings under `$HOME`, never nested/temp paths), and is Claude-Code-only — OpenCode has no equivalent tool, and this repo is explicitly dual-agent. `Agent(isolation:"worktree")` scopes to one delegated sub-task and self-cleans only when the agent made no changes, so it cannot host a days-long branch with a DB stack. Both remain **valid alternatives for narrower use cases** and are documented as such, not replaced.

### Decision: Bash, not TypeScript

**Choice**: POSIX-ish bash with `set -euo pipefail`.
**Alternatives considered**: TypeScript, matching the `scripts/*.ts` precedent.
**Rationale**: Steps 2–4 run *before* `node_modules` exists in the target worktree, so no TS runner is available. Bash is the only runtime guaranteed present at step 0.

### Decision: Compile check must fail the script

**Choice**: The dev-server health check proves readiness (HTTP 200 or a `Ready`/`compiled successfully` log line within timeout), and any failure — including the known pre-existing `tailwind.config.ts` CJS/ESM bug — exits non-zero.
**Alternatives considered**: Treat a live process as success; warn-only on compile failure.
**Rationale**: "Process alive" is exactly the false signal that produced the original debugging sessions. There must be no "succeeded but app broken" exit path. Fixing the Tailwind bug stays out of scope; detecting it is the point.

### Decision: No rollback on partial failure

**Choice**: On mid-pipeline failure, leave partial state in place and exit non-zero. Recovery is re-running the script.
**Alternatives considered**: Unwind completed steps (remove copied files, `compose down`, `codegraph uninit`).
**Rationale**: Unwinding is itself failure-prone and can destroy work the user already did in the worktree. Instead every step is written to skip when its target state already exists (see the idempotency column below), so a re-run is cheap and converges.

### Decision: Detect-and-refuse on port collision

**Choice**: Check host ports 5432 (before `compose up`) and 3000 (before the health check); if occupied by a stack that is not this worktree's, abort with an actionable message naming the port and the likely owner.
**Alternatives considered**: Auto-assign free ports per worktree.
**Rationale**: Auto-assignment requires editing the shared `docker-compose.yml` (fixed `5432:5432`), passing `-p` to `next dev`, rewriting `POSTGRES_URL` in the copied `.env`, and persisting per-worktree port state. That is a much larger, stateful change for a single-developer machine where "shut down the other stack" is a one-liner.

### Decision: Cleanup never deletes the branch

**Choice**: `worktree-cleanup.sh` removes the worktree directory, its container stack, and its CodeGraph index only.
**Alternatives considered**: Also `git branch -d/-D`.
**Rationale**: The worktree is disposable infrastructure; the branch is work product, possibly already pushed or in an open PR. Branch deletion stays a deliberate human act.

### Decision: Per-worktree CodeGraph index, never copied

**Choice**: `[ -d <wt>/.codegraph ] || codegraph init <wt>`.
**Rationale**: Restates the existing global rule — an index encodes its own root and checked-out bytes, so copying or symlinking the main index yields wrong answers.

### Decision: Dev log is removed on success

**Choice**: The health check logs to `<wt>/.worktree-dev.log`; on failure the tail is printed and the file is kept for debugging, on success the file is deleted. `/.worktree-dev.log` is also added to `.gitignore`.
**Alternatives considered**: Always keep the log; write it under `.next/`.
**Rationale**: Load-bearing for the backfill success criterion — a surviving untracked log would change `git status --short` in `shared-form-state-contrast` and fail the "nothing disturbed" check, and the worktree's branch will not carry the new `.gitignore` line. Deleting on success makes the criterion hold regardless of which branch the worktree is on; the `.gitignore` entry covers the failure path.

### Decision: `shared-form-state-contrast` is a permanent naming exception

**Choice**: New worktree directories flatten the full branch name, `/`→`-` (`fix/shared-form-state-contrast` → `fix-shared-form-state-contrast`). The existing `shared-form-state-contrast` directory is **not** renamed and is documented as the single historical exception.
**Rationale**: Renaming an in-flight worktree with uncommitted work buys nothing and risks the very disruption this change promises to avoid.

## Data Flow

### `worktree-provision.sh <path>` — fail-fast pipeline

```
 #  step                                                   fail   idempotent / skip rule
──────────────────────────────────────────────────────────────────────────────────────────
 0  WT := abs(<path>); MAIN := git -C . rev-parse --show-toplevel
 1  guard: WT listed in `git worktree list --porcelain`     exit 2  n/a (pure check)
     AND WT != MAIN
 2  parse MAIN/.worktreeinclude                             exit 3  n/a (pure read)
 3  cp -a MAIN/<entry> -> WT/<entry> for each entry         exit 4  overwrite is safe (gitignored only)
     chmod 0600 WT/.env*        missing source -> warn only
 4  pnpm install  (cwd=WT)                                  exit 5  pnpm converges; no-op when current
 5  RUNTIME := first of podman|docker on PATH with compose  exit 6  n/a (pure detect)
 6  port 5432 free, or already held by THIS worktree stack  exit 7  passes when own stack is up
 7  $RUNTIME compose up -d  (cwd=WT)                        exit 8  compose no-ops when up
 8  poll pg_isready, timeout 60s                            exit 9  n/a (pure poll)
 9  pnpm exec prisma migrate deploy  (cwd=WT)               exit 10 deploy is idempotent by contract
10  [ -d WT/.codegraph ] || codegraph init WT               exit 11 SKIPPED when index exists
11  port 3000 free                                          exit 12 n/a (pure check)
12  pnpm dev & -> WT/.worktree-dev.log
     poll HTTP 200 / "Ready" line, timeout 120s             exit 13 n/a
       on fail: print log tail, kill dev, KEEP log
13  kill dev, rm WT/.worktree-dev.log, print summary        exit 0
```

Steps 10 is the only true *skip*; 3, 4, 7, 9 are convergent (safe to redo). Any non-zero exit leaves state as-is — no unwind.

### `worktree-cleanup.sh <path> [--force]`

```
 0  WT := abs(<path>)
 1  guard: WT in `git worktree list --porcelain` AND WT != MAIN   -> exit 2
 2  git -C WT status --porcelain non-empty AND no --force         -> exit 3
       (counts staged, unstaged AND untracked)
 3  $RUNTIME compose down  (cwd=WT)                               -> exit 4
 4  codegraph uninit -f WT                                        -> warn, continue
 5  git worktree remove WT   (+ --force only if step 2 passed via --force)
 6  git worktree prune                                            -> exit 0
       branch is NEVER touched
```

`codegraph uninit -f` is chosen over `codegraph daemon` control because it has a confirmed non-interactive flag.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `.worktreeinclude` | Modify | Add `.mcp.json` and `.claude/skills/agent-browser`; header comments document the format |
| `scripts/worktree-provision.sh` | Create | 13-step idempotent provisioning pipeline above |
| `scripts/worktree-cleanup.sh` | Create | Guarded teardown above |
| `.claude/rules/worktrees.md` | Create | Decision guide (structure below) |
| `CLAUDE.md` | Modify | `## Worktrees` section referencing the rule file; two command rows; fix stale `docker compose up -d` row (only `podman` is installed) |
| `.gitignore` | Modify | Add `/.worktree-dev.log` (failure-path artifact) |

## Interfaces / Contracts

### `.worktreeinclude` format

```
# Comments and blank lines are ignored.
# One repo-relative path per line. Directories are copied recursively.
.env
.env.local
.mcp.json
.claude/skills/agent-browser
```

Parser contract:

- Read with `while IFS= read -r line` — no `eval`, no `source`, no word-splitting, no glob expansion.
- Skip lines that are empty or whose first non-space character is `#`.
- **Reject** (hard error, exit 3) absolute paths and any path containing a `..` segment.
- Copy with `cp -a` so symlinks are preserved rather than dereferenced (`.claude/skills/agent-browser` is expected to be a link into the tracked `.agents/skills/` tree).
- After copy, `chmod 0600` every `WT/.env*` match.
- A missing *source* path is a warning, not a failure — the include list is shared across machines.

### Script CLI contract

| Script | Args | Success | Notable failures |
|---|---|---|---|
| `worktree-provision.sh` | `<path>` | `0` — worktree runnable, summary prints `pnpm dev` as next step | see exit table above (2–13) |
| `worktree-cleanup.sh` | `<path> [--force]` | `0` — stack down, index gone, worktree removed, branch intact | `2` not a worktree, `3` dirty without `--force`, `4` compose down failed |

## Documentation Structure — `.claude/rules/worktrees.md`

Applying `cognitive-doc-design` (lead with the answer, progressive disclosure, recognition over recall):

1. **One-paragraph purpose** — what a provisioned worktree gives you.
2. **"Which mechanism?" decision table first** (the answer, before any procedure):

   | Trigger | Mechanism |
   |---|---|
   | Another session has uncommitted work in the main checkout; task needs an isolated DB/env; parallel Claude + OpenCode on unrelated changes | **Manual sibling worktree + `worktree-provision.sh`** (primary) |
   | One-off Claude-Code-only isolation, no DB/env, no OpenCode involvement | `EnterWorktree` / `ExitWorktree` — lands in `.claude/worktrees/`, no provisioning, does not satisfy the CodeGraph sibling-dir rule |
   | A single delegated sub-task that must not touch the checkout | `Agent(isolation:"worktree")` — auto-cleans only if the agent changed nothing |
   | Small in-place fix already covered by the normal `/sdd-apply` loop | No worktree |

3. **Quick path** — four commands: `git worktree add` → `worktree-provision.sh` → work → `worktree-cleanup.sh`.
4. **Triggers vs non-triggers** table (expanded from row 1).
5. **Naming convention** — `/`→`-`, with `shared-form-state-contrast` called out as the one documented historical exception.
6. **`.worktreeinclude`** — format block plus "never add anything that duplicates a secret outside `.env*`".
7. **CodeGraph per worktree** — one line restating the global rule.
8. **Known limits** — an explicitly labelled `Unverified` callout: OpenCode has no native worktree tool and must be pointed at the worktree path manually; **how it controls its working directory when delegating was not verified** — confirm during implementation, do not assert a mechanism. Same section notes `ExitWorktree` does not apply here (it only tracks worktrees it created in the same session).
9. **Cleanup checklist** — what cleanup removes and what it deliberately does not (the branch).

## Testing Strategy

Automated tests and CI wiring for the scripts are out of scope per the proposal, so the applicable threat-matrix cases become **named manual scenario checks** with exact commands and expected exit codes, carried unchanged into `tasks.md`.

| Layer | What to Test | Approach |
|---|---|---|
| Static | Bash correctness | `shellcheck scripts/worktree-*.sh` |
| Scenario (RED-equivalent) | Guard rejections | Throwaway worktree `test/worktree-strategy`; assert each guard's exit code (non-worktree path, main checkout, absolute/`..` include entry, occupied 5432, occupied 3000, dirty cleanup without `--force`) |
| Integration | Happy path + idempotency | Full run against the throwaway worktree, then an immediate second run — expect `0` both times and step 10 reported as skipped |
| E2E | Backfill | Run against `shared-form-state-contrast`; compare `git -C <wt> status --short` before/after |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | **Applicable** — `.worktreeinclude` entries are data read by a shell script | Parse with `while IFS= read -r`; never `eval`/`source`; quote all expansions; no glob expansion; reject absolute paths and `..` segments (exit 3) | Entries `../../etc/passwd`, `/etc/passwd`, `; rm -rf /`, and a path containing spaces — each must abort or copy literally, never execute |
| Git repository selection | **Applicable** — both scripts shell out to git | `<path>` normalised to absolute (`cd … && pwd`); every git call uses explicit `git -C "$MAIN"` or `git -C "$WT"`; membership validated against `git worktree list --porcelain` | Relative path, trailing-slash path, path that is not a worktree, path equal to the main checkout |
| Commit state | **Applicable** — cleanup guard | `git -C "$WT" status --porcelain` treated as dirty when non-empty, counting staged, unstaged *and* untracked; refuse without `--force` | Staged-only, untracked-only, clean — first two must exit 3 |
| Push state | **N/A** | Neither script pushes, fetches, or resolves a remote ref | — |
| PR commands | **N/A** | No PR or `gh` automation in this change | — |

## Migration / Rollout

No data migration. Rollout is: write and `shellcheck` the scripts → dry-run against a throwaway worktree (`test/worktree-strategy`) including the occupied-port case → run cleanup on that throwaway → write the docs last → backfill.

**Backfill guard for `shared-form-state-contrast`**: capture `git -C <wt> status --short` to a file *before* the run, run `worktree-provision.sh`, capture it again, and diff the two snapshots — they must be byte-identical. The modified-but-uncommitted `tailwind.config.ts` and the untracked `openspec/changes/shared-form-state-contrast/` must appear unchanged in both. Every path the script writes is gitignored (`.env*`, `.mcp.json`, `.claude/skills/`, `node_modules/`, `postgres/`, `.codegraph/`), and the dev log is deleted on success, so the snapshot is expected to be stable. If the diff is non-empty, the backfill is a failure regardless of the script's exit code. The compile check is expected to fail here on the pre-existing Tailwind bug — that non-zero exit is the correct, in-scope outcome, and the snapshot check still applies.

## Open Questions

- [ ] How OpenCode sets the working directory when delegating to a worktree — documented as `Unverified` in the rule file; confirm during implementation rather than asserting a mechanism.
- [ ] Whether `.claude/skills/agent-browser` is a symlink with a *relative* target (resolves inside the worktree, correct) or an *absolute* one (would point back at the main checkout). `cp -a` preserves either; verify after the first copy and warn if the link escapes the worktree.
