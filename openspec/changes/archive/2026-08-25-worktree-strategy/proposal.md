# Proposal: Worktree Strategy

## Intent

Worktrees are already used ad hoc (`gymbro-tracker-worktrees/shared-form-state-contrast`) with no provisioning: gitignored files never arrive (missing `AUTH_SECRET` → Auth.js 500), no database or migrations, and no per-worktree `.codegraph/` index — which violates an existing rule. Only a hand-written `.worktreeinclude` (`.env`, `.env.local`) exists, and nothing reads it. Each new worktree therefore repeats the same manual debugging, for both Claude Code and OpenCode.

## Scope

### In Scope

- `.worktreeinclude`: add `.mcp.json` and `.claude/skills/agent-browser`; define format (one relative path per line, `#` and blank lines ignored).
- `scripts/worktree-provision.sh` (bash, idempotent): precondition checks → copy includes (`cp -a`, `chmod 0600` on `.env*`) → `pnpm install` → podman/docker detection, port 5432/3000 detect-and-refuse, `compose up -d`, readiness wait → `prisma migrate deploy` → `codegraph init` when absent → real compile verification (HTTP 200 or "Ready" log line within timeout, not "process alive") → summary.
- `scripts/worktree-cleanup.sh`: known-worktree check, refuse on uncommitted changes unless `--force`, `compose down`, `codegraph uninit -f`, `git worktree remove`, `git worktree prune`.
- `.claude/rules/worktrees.md`: the three mechanisms and when to use each, triggers/non-triggers, naming (flatten `/`→`-`), `.worktreeinclude` format, CodeGraph-per-worktree rule, OpenCode cwd caveat (unverified — confirm during implementation, never invent), cleanup.
- `CLAUDE.md`: short `## Worktrees` section referencing the rule file, two script rows in Useful commands, and fix the stale `docker compose up -d` row (only `podman` is installed).
- Backfill: run the tested script against `shared-form-state-contrast` without touching its uncommitted `tailwind.config.ts` or untracked `openspec/changes/shared-form-state-contrast/`.

### Out of Scope

- `WorktreeCreate`/`WorktreeRemove` hooks — dead code here (repo is always a git repo).
- Port parameterization / auto-assign per worktree.
- Fixing the `tailwind.config.ts` CJS/ESM bug (detected only).
- Automated tests or CI wiring for the scripts.

## Capabilities

### New Capabilities

- `worktree-provisioning`: provisioning, verification, and cleanup contract for isolated worktrees.

### Modified Capabilities

- None

## Approach

Keep the manual sibling-directory convention primary: it is the only mechanism usable by both Claude Code and OpenCode and matches the existing CodeGraph sibling-dir rule; native `EnterWorktree` and `Agent(isolation:"worktree")` are documented alternatives. Bash, not TypeScript — steps run before `node_modules` exists. Fail-fast per step with clear logs. Docs written last, after `shellcheck` and a dry run against a throwaway worktree.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `.worktreeinclude` | Modified | Two entries + documented format |
| `scripts/worktree-provision.sh` | New | Idempotent provisioning + compile check |
| `scripts/worktree-cleanup.sh` | New | Guarded teardown |
| `.claude/rules/worktrees.md` | New | Convention guide |
| `CLAUDE.md` | Modified | Worktrees section, command rows, runtime fix |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Backfill disturbs in-progress worktree | Low | Only gitignored paths; verify `git status --short` before/after |
| Compile check fails on the pre-existing Tailwind bug | Med | Expected; script reports log tail, fix stays out of scope |
| Port already in use | Med | Detect and refuse with actionable message |
| OpenCode cwd behavior unverified | Med | Documented as open item, not as a claimed mechanism |

## Rollback Plan

Trivial: delete the three new files and `git checkout` the two edited ones. Nothing touches production data, migrations, schema, or committed application behavior; provisioned worktree state is disposable via `scripts/worktree-cleanup.sh`.

## Dependencies

- `podman` (or `docker`) with `compose`, `pnpm`, `codegraph` CLI, git worktree support.

## Success Criteria

- [ ] A fresh worktree becomes runnable via one script invocation, with env files, DB, migrations, and CodeGraph index in place.
- [ ] Provisioning is idempotent and refuses port collisions instead of colliding.
- [ ] Compile verification fails loudly when the dev server does not compile.
- [ ] Cleanup refuses to discard uncommitted work without `--force`.
- [ ] Backfill leaves `shared-form-state-contrast`'s tracked diff and untracked files unchanged.
