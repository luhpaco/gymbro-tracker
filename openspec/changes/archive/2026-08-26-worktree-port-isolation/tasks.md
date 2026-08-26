# Tasks: Worktree Port Isolation

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~250–320 (compose ~1, .gitignore ~1, .env.template ~2, worktree-provision.sh ~180–220, worktrees.md ~40–60) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | single PR |
| Delivery strategy | single-pr |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

Single file-family change (1 compose line, 1 script, 3 config/doc files); confirmed no chaining needed.

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Full port-isolation change | PR 1 | `shellcheck scripts/worktree-provision.sh` | `scripts/worktree-provision.sh <throwaway-worktree-path>` | Revert the 5 touched files; a stale `.worktree-port` becomes inert once unread |

## Phase 1: Shared Config Foundation [HIGH RISK — files shared by every existing worktree]

- [x] 1.1 `docker-compose.yml:15` — `5432:5432` → `"${POSTGRES_HOST_PORT:-5432}:5432"`.
- [x] 1.2 `.gitignore` — add `/.worktree-port`.
- [x] 1.3 `.env.template` — add `POSTGRES_HOST_PORT` line (confirmed no existing key collision). Added by the human directly (agent tooling was permission-denied on this path); confirmed present via `git diff -- .env.template` (`# POSTGRES_HOST_PORT=5432`) during the targeted correction on 2026-08-26.

## Phase 2: Script — Resolve-Ports Step

- [x] 2.1 Add `PG_PORT_RANGE_START=5433`/`END=5443`, `DEV_PORT_RANGE_START=3001`/`END=3011`.
- [x] 2.2 Add `scan_free_port()`, reusing `port_in_use()` verbatim.
- [x] 2.3 Hoist `find_dev_pids()`/`kill_dev_pids()` above the new resolve step (currently ~L294-310).
- [x] 2.4 Delete old step-6 port-5432 refuse-guard (~L180-197).
- [x] 2.5 Delete old step-11 port-3000 refuse-guard (~L261-266).
- [x] 2.6 New step 6: read `.worktree-port`, anchored-grep parse + range-validate each key; reuse if free or held-by-us (`compose ps -q` / `find_dev_pids`); exit 7/12 naming port+file if held by another; else scan and write both keys atomically.

## Phase 3: Script — .env Rewrite Step (6b)

- [x] 3.1 `POSTGRES_HOST_PORT`: anchored replace/append, `.env` only.
- [x] 3.2 `POSTGRES_URL` port-segment `sed -E` rewrite applied to `.env` and every `COPIED_ENV_FILES` entry containing `POSTGRES_URL=`, explicitly including `.env.local` (its rewrite is load-bearing per spec; it gains no `POSTGRES_HOST_PORT` line).
- [x] 3.3 Temp file inside `$WT`, `chmod 0600`, atomic `mv`.
- [x] 3.4 Post-write verify `grep -qE "^[[:space:]]*POSTGRES_URL=.*:${PG_PORT}/"` per rewritten file; exit 7 with the documented message on failure.

## Phase 4: Script — Runtime Wiring

- [x] 4.1 Step 7: export `POSTGRES_HOST_PORT="$PG_PORT"` on `compose up -d`.
- [x] 4.2 Step 11: `kill_dev_pids` for any stale own dev server before launch.
- [x] 4.3 Step 12: launch with `PORT="$DEV_PORT" nohup pnpm dev` (never via `.env`); `package.json` untouched.
- [x] 4.4 Probe target `http://127.0.0.1:$DEV_PORT` (was `localhost:3000`).
- [x] 4.5 Add "port ... is in use" log-line guard → immediate fail.

## Phase 5: Script — Header & Summary

- [x] 5.1 Update header exit-code comments for 7 (Postgres port: scan/reuse/`.env`-verify failure) and 12 (dev port failure) — codes reused, meaning generalized.
- [x] 5.2 Step 13: print both assigned ports and the `PORT=$(...) pnpm dev` one-liner.

## Phase 6: Static Verification

- [x] 6.1 `shellcheck scripts/worktree-provision.sh` and `scripts/worktree-cleanup.sh` (unchanged) — zero warnings (ran via `podman run koalaman/shellcheck:stable`, shellcheck binary not installed on host).

## Phase 7: Scenario Verification (manual, throwaway worktree; exact exit codes)

- [x] 7.1 Fresh scan: no `.worktree-port`, 5433/3001 free → assigns+persists both, exit 0. **PASS** (throwaway worktree `wt-port-test-a`).
- [x] 7.2 Occupied-port skip: 5433 bound (`nc -lk`), 5434 free → assigns 5434, exit 0. **PASS**.
- [x] 7.3 Persisted reuse: existing `.worktree-port` → reused verbatim, no re-scan, exit 0. **PASS**.
- [x] 7.4 Stolen persisted port: file says 5435, held by unrelated process → exit 7, message names port + `.worktree-port`. **PASS** (exact message matched design after fixing the `port_in_use` stderr-closing bug below).
- [x] 7.5 Exhausted range: all of 5433-5443, then 3001-3011, bound → exit 7 / exit 12, message states exact range. **PASS** (tested both ranges independently, exact messages matched).
- [x] 7.6 Malformed `.worktree-port`: `DEV_PORT=$(touch pwned)`, `POSTGRES_HOST_PORT=999999`, empty file, duplicated key → each treated as absent, re-scans, nothing executes. **PASS** with one nuance: a duplicated *valid, in-range* key resolves deterministically via the design's own `tail -n1` "last line wins" parse (confirmed: picked the second of two `POSTGRES_HOST_PORT=` lines, safely reused it, no crash/injection) rather than being treated as absent — this matches the design's literal anchored-grep+tail-n1 algorithm, not the task line's plain-English gloss; flagged, not silently reinterpreted. The injection attempt (`$(touch pwned)`) and out-of-range value were both correctly treated as absent and re-scanned with no code execution (`pwned` file never created).
- [x] 7.7 `.env.local` rewrite: assigned port 5435 → `.env.local`'s `POSTGRES_URL` port becomes 5435, no `POSTGRES_HOST_PORT` line added. **PASS** — verified by direct file read of the worktree's copied `.env`/`.env.local` (readable, unlike the main checkout's `.env`/`.env.template`).
- [x] 7.8 Idempotent re-run: re-provision a live worktree → exit 0, same ports, `.env`/`.env.local` byte-identical. **PASS** — `sha256sum` identical across both files before/after re-run.
- [x] 7.9 Two-worktree concurrency: provision A, leave stack up, provision B → distinct ports, both stacks live, both `.env` files internally consistent. **PASS** for the persistent Postgres ports (5433 vs 5434, both containers verified live simultaneously via `podman ps`, both `.env` `POSTGRES_HOST_PORT`/`POSTGRES_URL` internally consistent). Note: both worktrees' `DEV_PORT` happened to resolve to 3001, because the health-check dev server is torn down on success in both runs (step 13), so dev-port occupancy is not held between runs — this is the accepted Low-risk race window Design Decision 1 already calls out, not a new defect.

## Phase 8: Main-Checkout Regression (must pass before declaring apply-complete)

- [x] 8.1 `compose up -d` in `$MAIN` with no `POSTGRES_HOST_PORT` set → binds `5432`; `pnpm dev` → `3000`; no `.worktree-port` created or read. **PASS** — `podman compose config` in main checkout resolved `5432:5432` with the var unset; running the script against the main checkout path still exits 2 before any port code; no `.worktree-port` present in main.

### Two real bugs found and fixed during scenario verification (beyond tasks.md's original scope, both required for the above scenarios to actually pass)

- The reused `port_in_use()` function's cleanup line `exec 3>&- 2>/dev/null || true` ran outside any subshell, so `exec`'s bare-redirection semantics permanently redirected the *script's own* stderr to `/dev/null` on every direct (non-subshelled) call — silently swallowing every subsequent `err()`/`warn()` message for the rest of the run. This pre-existed in the original script (same pattern in the old 5432/3000 guards) but was never exposed because those guards' `err()` calls were the last thing to happen before `exit`. My new reuse-check code path calls `port_in_use` directly and needed the exit-7/exit-12 messages to render, exposing it. Fixed by scoping the close to its own subshell: `(exec 3>&-) 2>/dev/null || true`.
- `rewrite_env_postgres_port`'s "append `POSTGRES_HOST_PORT=` if absent" branch appended without first checking for a trailing newline on the source file. The real `.env` in this repo has no trailing newline after its last line (`AUTH_SECRET=...`), so the appended key got silently concatenated onto that line instead of starting a new one — confirmed directly by reading the worktree's copied `.env` before the fix. Fixed by checking `tail -c1 | wc -l` and inserting a newline first when needed.

## Phase 9: Documentation

- [x] 9.1 `.claude/rules/worktrees.md` — document port ranges, `.worktree-port` format/reuse logic, revised exit-code meanings, the `pnpm dev` one-liner, and the pre-existing-branch `.gitignore` caveat.

## Phase 10: Targeted Correction (post-verify FAIL, 2026-08-26)

- [x] 10.1 Fixed the dev-server health-check false-success bug (verify report #344, CRITICAL finding): the loose `grep -qiE 'ready|compiled successfully'` success match matched the substring `"ready"` inside `"already"`, so Next.js 15's real `Error: listen EADDRINUSE: address already in use` crash text was reported as healthy. Root cause confirmed by reading the actual script (lines ~439-465): the pre-existing `port .* is in use` failure guard never matched this crash text (no literal word "port" adjacent to "is in use" in Next's real EADDRINUSE output), so execution fell through to the loose success check every time. Fix in `scripts/worktree-provision.sh`: (a) extended the failure guard to `eaddrinuse|address already in use|port .* is in use` (case-insensitive), checked first in each poll iteration and unconditionally `break`s before any success check can run; (b) tightened the success match to `\bready\b|compiled successfully` (GNU grep word-boundary), which no longer matches inside "already" but still matches Next's real ` ✓ Ready in <n>ms` line; renamed `port_stolen` to `dev_failed` for clarity since the flag now covers more than a stolen port.
- [x] 10.2 Updated task 1.3 checkbox from BLOCKED/unchecked to done — confirmed via `git diff -- .env.template` that the human already added `# POSTGRES_HOST_PORT=5432`.

### Verification Evidence (Phase 10)

- **Real Next.js 15.5.23 output captured directly** (not assumed): success line is ` ✓ Ready in 1998ms` (captured via `PORT=3999 pnpm dev` on a genuinely free port); crash line is `Error: listen EADDRINUSE: address already in use :::3999` plus `code: 'EADDRINUSE'` (captured via `PORT=3999 pnpm dev` after occupying 3999 with `nc -lk`). Both throwaway processes and the port were killed and confirmed free afterward.
- **Regex correctness confirmed in isolation** against the real captured text: `echo "address already in use" | grep -qiE '\bready\b'` → NOMATCH (old bug fixed); `echo " ✓ Ready in 1998ms" | grep -qiE '\bready\b'` → MATCH (happy path preserved, no regression to 7.1/7.2/7.9); `echo "Error: listen EADDRINUSE: address already in use :::3999" | grep -qiE 'eaddrinuse|address already in use'` → MATCH (new failure guard fires).
- **shellcheck re-run**: `podman run --rm -v "$PWD":/mnt koalaman/shellcheck:stable /mnt/scripts/worktree-provision.sh /mnt/scripts/worktree-cleanup.sh` — exit 0, zero warnings.
- **Order preserved**: the failure check (`eaddrinuse|...`) runs and `break`s before the HTTP-200 curl check and before the loose ready-text check within the same loop iteration, so a crash line can never be shadowed by a coincidental success-substring match.
