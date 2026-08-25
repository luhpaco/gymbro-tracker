# Tasks: Worktree Strategy

**TDD note**: `strict_tdd: true` applies to Vitest-covered TS, not bash/docs. No test suite exists or should be invented for these scripts. Phase 4's dry-run scenario checks (explicit command + expected exit code per spec scenario) substitute for RED/GREEN and are the sole verification evidence `sdd-apply`/`sdd-verify` should expect.

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~450–550 (2 new scripts ~180–220 + ~80–100 lines; new docs file ~150–200 lines; CLAUDE.md +~25; manifest/gitignore +~7) |
| 400-line budget risk | High |
| Chained PRs recommended | Yes |
| Suggested split | PR 1 (foundation) → PR 2 (provision.sh) → PR 3 (cleanup.sh) → PR 4 (docs + backfill evidence) |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: Yes
Chained PRs recommended: Yes
Chain strategy: pending
400-line budget risk: High

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | `.worktreeinclude` + `.gitignore` edits | PR 1 | `git diff -- .worktreeinclude .gitignore` (read-check) | N/A — no executable code yet | Revert 2 file diffs independently |
| 2 | `scripts/worktree-provision.sh`, 13-step pipeline | PR 2 | `shellcheck scripts/worktree-provision.sh` | Dry run: `scripts/worktree-provision.sh ../gymbro-tracker-worktrees/worktree-strategy-test` (Phase 4.1–4.5) | Delete the one new file |
| 3 | `scripts/worktree-cleanup.sh` | PR 3 | `shellcheck scripts/worktree-cleanup.sh` | Dry run: `scripts/worktree-cleanup.sh ../gymbro-tracker-worktrees/worktree-strategy-test --force` (Phase 4.6) | Delete the one new file |
| 4 | `.claude/rules/worktrees.md` + `CLAUDE.md`, plus backfill verification evidence | PR 4 | N/A — no linter for `.claude/rules/`; manual proofread against Phase 4 evidence | Backfill run (Phase 6): `scripts/worktree-provision.sh ../gymbro-tracker-worktrees/shared-form-state-contrast` + before/after `git status --short` diff | Revert 2 file diffs; scripts unaffected |

## Phase 0: Investigation

- [x] 0.1 Inspect `.claude/skills/agent-browser` in the main checkout (`ls -la`, `readlink -f`) to confirm relative vs. absolute symlink target; result drives task 2.4's warn-not-fail copy logic.

## Phase 1: Foundation

- [x] 1.1 Edit `.worktreeinclude`: add `.mcp.json`, `.claude/skills/agent-browser`; add header comments documenting the format (Req: Manifest Format and File Copy).
- [x] 1.2 Edit `.gitignore`: add `/.worktree-dev.log` (design: dev log deleted on success, kept on failure).

## Phase 2: `scripts/worktree-provision.sh`

- [x] 2.1 Create file: `set -euo pipefail`, `<path>` arg, resolve `WT`/`MAIN` absolute paths (step 0).
- [x] 2.2 Guard: `WT` in `git worktree list --porcelain` AND `WT != MAIN`, else exit 2 (Req: Provisioning Preconditions; scenarios: Refuse main checkout, Unknown worktree).
- [x] 2.3 Parse `.worktreeinclude`: `while IFS= read -r`, skip blank/`#`, reject absolute or `..`-segment paths, exit 3 (Req: Manifest Format; threat matrix: documentation-like paths — test `../../etc/passwd`, `/etc/passwd`, `; rm -rf /`, spaced path).
- [x] 2.4 Copy step: `cp -a` per entry, `chmod 0600 WT/.env*`, missing source = warn only, agent-browser link warn-not-fail per 0.1's finding, exit 4.
- [x] 2.5 `pnpm install` (cwd=WT), exit 5.
- [x] 2.6 Detect `podman`/`docker` with `compose` on PATH, exit 6.
- [x] 2.7 Port 5432 guard: free or owned by this worktree's own stack, else exit 7 (Req: Runtime Detection and Port Guard; scenario: Port already in use).
- [x] 2.8 `$RUNTIME compose up -d` (cwd=WT), exit 8.
- [x] 2.9 Poll `pg_isready`, 60s timeout, exit 9 (Req: Database Readiness; scenarios: Database ready in time / never ready).
- [x] 2.10 `pnpm exec prisma migrate deploy` (cwd=WT, never `migrate dev`), exit 10.
- [x] 2.11 `[ -d WT/.codegraph ] || codegraph init WT`, exit 11 (Req: Conditional CodeGraph Init; scenarios: Index absent/present).
- [x] 2.12 Port 3000 guard, exit 12.
- [x] 2.13 Health check: `pnpm dev &` → `WT/.worktree-dev.log`, poll HTTP 200 / "Ready" line, 120s timeout, exit 13; on failure print log tail, kill dev, keep log (Req: Dev Server Health Check; scenarios: Healthy server, Health check fails).
- [x] 2.14 Success path: kill dev, `rm WT/.worktree-dev.log`, print summary naming `pnpm dev` as next step, exit 0.
- [x] 2.15 `shellcheck scripts/worktree-provision.sh`; fix findings.

## Phase 3: `scripts/worktree-cleanup.sh`

- [x] 3.1 Create file: `<path> [--force]` args, guard `WT` known worktree and `!= MAIN`, exit 2.
- [x] 3.2 Dirty check: `git -C WT status --porcelain` (staged + unstaged + untracked) non-empty and no `--force`, exit 3 (Req: Cleanup Guard; threat matrix: commit state — staged-only, untracked-only, clean).
- [x] 3.3 Teardown order: `$RUNTIME compose down` (exit 4) → `codegraph uninit -f WT` (warn, continue) → `git worktree remove WT` (propagate `--force`) → `git worktree prune`, exit 0; branch never touched (Req: Cleanup Guard, Teardown Order, Branch Preservation).
- [x] 3.4 `shellcheck scripts/worktree-cleanup.sh`; fix findings.

## Phase 4: Dry-Run Verification (RED-equivalent — proves docs before they're written)

- [x] 4.1 `git worktree add ../gymbro-tracker-worktrees/worktree-strategy-test -b test/worktree-strategy`.
- [x] 4.2 Guard scenarios: run against main checkout path, a non-worktree path, an absolute/`..` manifest entry — assert exits 2/2/3, no side effects.
- [x] 4.3 Port-collision case: with the main stack already up on 5432, run provision against the test worktree — assert exit 7, no containers started.
- [x] 4.4 Happy-path run: full provision against the test worktree — assert exit 0, dev log deleted, summary printed.
- [x] 4.5 Idempotency/partial-failure: re-run immediately — assert exit 0, step 10 reported skipped; stop Postgres before migrate, re-run — assert it resumes without repeating earlier steps.
- [x] 4.6 Cleanup guard: dirty worktree without `--force` — assert exit 3, nothing removed; with `--force` — assert exit 0, `test/worktree-strategy` still listed in `git branch`.

## Phase 5: Documentation

- [x] 5.1 Create `.claude/rules/worktrees.md` per design's 9-section structure (purpose, decision table, quick path, triggers, naming exception, `.worktreeinclude` format, CodeGraph rule, `Unverified` OpenCode-cwd callout, cleanup checklist); describe only behavior proven in Phase 4.
- [x] 5.2 Edit `CLAUDE.md`: add `## Worktrees` section referencing the rule file; add two command-table rows for the two scripts; correct the stale `docker compose up -d` row to `podman compose up -d`.

## Phase 6: Backfill (gated — start only after Phase 4 passes)

- [x] 6.1 Capture `git -C ../gymbro-tracker-worktrees/shared-form-state-contrast status --short` as before-snapshot.
- [x] 6.2 Run `scripts/worktree-provision.sh ../gymbro-tracker-worktrees/shared-form-state-contrast`. A non-zero exit from the known Tailwind CJS/ESM bug at the health-check step is EXPECTED and is NOT a task failure. (Actual result: exit 0 — the worktree's uncommitted, in-progress `tailwind.config.ts` edit apparently already works around the bug; not a task failure either way per the success criterion below.)
- [x] 6.3 Capture `git status --short` again; diff before/after. **Success criterion (sole judge, ignore script exit code)**: snapshots are byte-identical — the uncommitted `tailwind.config.ts`/`openspec/config.yaml` diffs and untracked `openspec/changes/shared-form-state-contrast/` entry unchanged in both. CONFIRMED byte-identical.

## Phase 7: Test Scaffolding Cleanup

- [x] 7.1 `scripts/worktree-cleanup.sh ../gymbro-tracker-worktrees/worktree-strategy-test --force` (or manual `git worktree remove` if the script under test is unusable); confirm `test/worktree-strategy` still exists via `git branch`.
