# Archive Report: Worktree Port Isolation

**Change**: worktree-port-isolation  
**Archived**: 2026-08-26  
**Status**: Complete and closed  
**Mode**: hybrid (OpenSpec + Engram)

## Executive Summary

The worktree-port-isolation change replaces the refuse-on-collision port guards in `worktree-provision.sh` with adaptive scan-and-assign logic, enabling concurrent agent sessions (Claude Code + OpenCode) to run in sibling worktrees without port conflicts. The change underwent a two-pass verification cycle: an initial FAIL due to a dev-server health-check false-positive bug (loose regex matching "ready" inside "already"), followed by a targeted correction and successful re-verification. This change is part of the parent `worktree-strategy` feature (PR #30, unmerged as of archive date).

## Artifact Traceability (Engram)

| Artifact | ID | Type | Created |
|----------|----|----|---------|
| Proposal | #339 | architecture | 2026-08-26 10:33:38 |
| Spec (delta) | #340 | architecture | 2026-08-26 10:38:23 |
| Design | #341 | architecture | 2026-08-26 10:42:39 |
| Tasks | #342 | architecture | 2026-08-26 10:49:03 |
| Verify-Report (initial) | #344 | architecture | 2026-08-26 11:23:22 |

## Specs Synced

| Domain | Action | Details |
|--------|--------|---------|
| worktree-provisioning | Updated | 1 MODIFIED + 1 ADDED requirements (total 10 requirements → 11 after merge) |

### Requirements merged into `openspec/specs/worktree-provisioning/spec.md`:

1. **Runtime Detection and Port Guard** (MODIFIED)
   - Changed from refuse-on-bound-port to scan-and-assign logic
   - Introduces `.worktree-port` persistent state file
   - Preserves main checkout defaults (5432, 3000)
   - Adds 6 new scenarios (previously 2, now 8)

2. **Per-Worktree Env Rewrite** (ADDED)
   - New requirement: rewrite `.env` and `.env*` files to reflect assigned ports
   - Handles `POSTGRES_HOST_PORT` and `POSTGRES_URL` port segments
   - 3 scenarios: worktree env assignment, `.env.local` treatment, main checkout isolation

3. **Dev Server Health Check Defines Success** (MODIFIED)
   - Changed to probe assigned port instead of hardcoded 3000
   - Requires `PORT` as real process environment variable
   - Preserves `package.json` `dev` script untouched
   - Adds 1 new scenario (previously 2, now 3)

## Implementation Completeness

**Tasks**: 40/40 complete

- Phase 1 (Shared Config): 3/3 tasks ✓
- Phase 2 (Resolve-Ports Step): 5/5 tasks ✓
- Phase 3 (Env Rewrite): 4/4 tasks ✓
- Phase 4 (Runtime Wiring): 5/5 tasks ✓
- Phase 5 (Header & Summary): 2/2 tasks ✓
- Phase 6 (Static Verification): 1/1 task ✓
- Phase 7 (Scenario Verification): 9/9 tasks ✓ (one nuance: malformed-key test 7.6 flagged tail-n1 "last wins" parse determinism)
- Phase 8 (Main-Checkout Regression): 1/1 task ✓
- Phase 9 (Documentation): 1/1 task ✓
- Phase 10 (Targeted Correction): 2/2 tasks ✓

**Files changed**:
- `docker-compose.yml:15` (1 line)
- `.gitignore` (1 line)
- `.env.template` (1 line, added by human)
- `scripts/worktree-provision.sh` (~220 lines)
- `.claude/rules/worktrees.md` (~60 lines)

## Verification History: Two-Pass Cycle

### First Verification: FAIL with CRITICAL Finding

**Report**: Engram #344 (initial verdict)  
**Date**: 2026-08-26 11:23:22  
**Finding**: CRITICAL — dev-server health-check false-positive on Next.js EADDRINUSE crash

**Root Cause** (per verify-report):
The health-check loop had two issues in sequence:
1. The pre-existing `port .* is in use` failure guard did not match Next.js 15's real EADDRINUSE crash text (`Error: listen EADDRINUSE: address already in use :::PORT`)
2. Execution fell through to the loose success check with pattern `grep -qiE 'ready|compiled successfully'`, which matched the substring `"ready"` inside the crash line's `"already"`, reporting false success

**Evidence**:
- Real Next.js crash log: `Error: listen EADDRINUSE: address already in use :::3999`
- Old success pattern: `ready|compiled successfully` (case-insensitive substring match)
- Match result: NOMATCH for "port ... is in use", then MATCH for "ready" (silent false positive)

### Targeted Correction (Phase 10)

**Date**: 2026-08-26  
**Applied to**: `scripts/worktree-provision.sh` (health-check loop, lines 442–464)

**Fix**:
1. Extended failure pattern to `eaddrinuse|address already in use|port .* is in use` (case-insensitive)
2. Placed failure check **first** in poll loop, unconditionally `break`s before any success check
3. Tightened success pattern to `\bready\b|compiled successfully` (GNU grep word-boundary anchors)
4. Renamed `port_stolen` flag to `dev_failed` for semantic clarity

**Verification Evidence** (from targeted fix verification):
- Crash log `Error: listen EADDRINUSE: address already in use :::3999` against extended failure pattern → MATCH ✓
- Same crash log against old pattern → NOMATCH (confirms root cause)
- Real success log ` ✓ Ready in 1998ms` against tightened pattern → MATCH (no regression) ✓
- Real success log against loose pattern: `ready` NOMATCH inside "already" (bug fixed) ✓
- Control-flow order: failure check runs first and breaks before success checks (structural proof) ✓
- `shellcheck` re-run: exit 0, zero warnings ✓

### Second Verification: PASS

**Report**: Engram #344 (re-verification, same observation ID)  
**Date**: 2026-08-26 (after correction)  
**Status**: PASS  
**Evidence**:
- All 40 tasks remain checked ✓
- 3/3 "Runtime Detection and Port Guard" scenarios PASS ✓
- 3/3 "Per-Worktree Env Rewrite" scenarios PASS ✓
- 3/3 "Dev Server Health Check Defines Success" scenarios PASS (was 2/3 before fix) ✓
- **Total**: 9/9 spec scenarios PASS, 0 CRITICAL findings ✓
- Build & tests: `pnpm test` 22/22 ✓, `pnpm build` exit 0 ✓, `pnpm lint` exit 0 ✓, `tsc --noEmit` exit 0 ✓

## Risks and Findings

**CRITICAL** (resolved):
- Dev-server health-check false-positive bug (false exit 0 on EADDRINUSE crash) — fixed in Phase 10, re-verified as PASS

**WARNING** (pre-existing, out of scope):
- `opencode.json` contains unrelated drift (`concise-output.md` added to instructions array), not touched by this change, flagged as WARNING in verify-report

**SUGGESTION** (optional, low-confidence gap):
- Full live throwaway-worktree EADDRINUSE reproduction (occupy assigned port with `nc`, run full provision end-to-end) was not performed in re-verify pass; static regex + control-flow inspection already meets stated verification bar

## Discovered and Fixed Bugs (Beyond Original Scope)

During scenario verification (Phase 7–8), two pre-existing bugs in the script were exposed and fixed:

1. **`port_in_use()` stderr redirect scope bug**: The cleanup `exec 3>&-` ran outside any subshell, permanently redirecting the script's own stderr to `/dev/null` on every direct call, silently swallowing error messages. Fixed by scoping the close: `(exec 3>&-) 2>/dev/null`.

2. **`.env` rewrite newline bug**: The append-if-absent branch did not check for a trailing newline on the source `.env` file. With the real `.env` having no trailing newline after `AUTH_SECRET=...`, the appended `POSTGRES_HOST_PORT=` concatenated onto the last line instead of starting a new one. Fixed by checking `tail -c1 | wc -l` and inserting a newline first when needed.

Both bugs were load-bearing for the implementation to pass scenario verification; no silent failures remain.

## Parent Feature Context

This change is part of the broader `worktree-strategy` feature (branch `feat/worktree-strategy`, PR #30, unmerged at archive date). The worktree-strategy SDD proposal and design were archived 2026-08-25; the worktree-port-isolation change was discovered during soak-testing of that feature's provision/cleanup scripts and belongs to the same deliverable rather than being independent.

## Delivery Strategy

- **Route**: single-pr  
- **Review Budget**: Low risk (~250–320 lines) — well under 400-line budget  
- **Chaining**: None recommended

## Final State Authority Ranking

Per the archive protocol, final-state facts are ranked by source:

1. **Native review authority**: None (receipt-driven development is disabled for this repository)
2. **Persisted tasks artifact**: `openspec/changes/archive/2026-08-26-worktree-port-isolation/tasks.md` — all 40 implementation tasks checked ✓
3. **Explicit final-state facts from orchestrator launch prompt**: Two-pass verify cycle (initial FAIL → targeted correction → PASS); parent feature context (PR #30) — recorded above
4. **Verify-report snapshots**: #344 (two revisions: initial FAIL with CRITICAL, re-verify PASS) — used to establish root cause and final disposition

## Completeness Checklist

- [x] Main specs updated correctly (`openspec/specs/worktree-provisioning/spec.md` merged)
- [x] Change folder moved to archive (`openspec/changes/archive/2026-08-26-worktree-port-isolation/`)
- [x] Archive contains all artifacts (proposal, specs, design, tasks, verify-report)
- [x] Archived `tasks.md` has no unchecked implementation tasks (40/40 ✓)
- [x] Active changes directory no longer has this change (verified via `git mv`)
- [x] Verbatim `diff -r` readback output confirms no truncation or alteration
- [x] Archive report (this file) recorded all observation IDs for traceability

## Spec Merge Diff Summary

The main spec `openspec/specs/worktree-provisioning/spec.md` now has:
- 3 MODIFIED requirements (Runtime Detection and Port Guard, Dev Server Health Check Defines Success)
- 1 ADDED requirement (Per-Worktree Env Rewrite)
- 6 unchanged requirements (Manifest Format, Provisioning Preconditions, Database Readiness, Conditional CodeGraph Init, Idempotency, Cleanup Guard, Worktree Documentation, Backfill Verification)
- **Total scenarios**: increased from 20 (before merge) to 29 (after merge: +9 new scenarios from the port-isolation changes)

## Key Learnings

1. Loose regex patterns in health checks can silently pass false positives when checking for crash states, requiring both negative tests and word-boundary anchors.

2. Script stderr redirection outside a subshell scope can permanently mute error messages for the entire remaining execution, masking problems until new error paths are added.

3. File append operations without prior newline checks will silently concatenate to the previous line, corrupting structured config files with no trailing newline.

4. Two-worktree concurrency testing revealed a pre-existing dev-port race window (both assigned same port after health-check teardown), which is accepted low-risk behavior matching existing guard semantics.

5. Persistent per-worktree state (`.worktree-port`) combined with idempotent re-scan logic enables adaptive resource allocation without a global cross-repo registry, keeping infra reasoning local per worktree like `.codegraph/` and `postgres/`.
