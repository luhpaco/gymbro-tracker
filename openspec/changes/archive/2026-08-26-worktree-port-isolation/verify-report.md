```yaml
schema: gentle-ai.verify-result/v1
evidence_revision: sha256:32523f31569b2d749b38634be56b45a99f299e87ccd77141153564acdbbdad51
verdict: fail
blockers: 1
critical_findings: 1
requirements: 2/3
scenarios: 11/12
test_command: pnpm test
test_exit_code: 0
test_output_hash: sha256:3ab38afaee97f43d42ea6a908eabec5c4a1ce25f2284a5db98f12b3b454ce952
build_command: pnpm build
build_exit_code: 0
build_output_hash: sha256:6747d0893b554f3fea8fafc9ab1b6b926295607113ed8007d1e5b5dd6565c2ac
```

## Verification Report

**Change**: worktree-port-isolation
**Version**: N/A (infra script change, no app version)
**Mode**: Standard

### Completeness
| Metric | Value |
|--------|-------|
| Tasks total | 39 |
| Tasks complete | 38 |
| Tasks incomplete | 1 (Task 1.3, `.env.template` line — `git diff .env.template` confirms the human has already added the exact confirmed line, but the tasks.md checkbox is stale and still shows it BLOCKED/unchecked) |

### Build & Tests Execution
**Build**: PASSED
```text
$ pnpm build
exit 0. Two expected "Dynamic server usage" notices for /workouts/create and
/exercises (pre-existing dynamic-route behavior, not a regression) — Next.js
completed static generation (14/14) and finished the production build.
```

**Tests**: 22 passed / 0 failed / 0 skipped
```text
$ pnpm test
Test Files  6 passed (6)
     Tests  22 passed (22)
```

**Lint**: exit 0 (`pnpm lint`) — one pre-existing unrelated warning in
`src/app/auth/login/ui/LoginForm.tsx` (react-hooks/exhaustive-deps), untouched
by this change.

**Typecheck**: exit 0 (`pnpm exec tsc --noEmit`)

**Shellcheck** (independent re-run, not trusted from the apply report):
```text
$ podman run --rm -v "$PWD:/mnt:ro,Z" koalaman/shellcheck:stable \
    /mnt/scripts/worktree-provision.sh /mnt/scripts/worktree-cleanup.sh
exit 0, zero warnings on both scripts
```

**Coverage**: N/A — Stage 1 Vitest scope is pure-logic units only; this
change touches no `src/**` application code, so coverage is not applicable.

### Spec Compliance Matrix
| Requirement | Scenario | Test | Result |
|-------------|----------|------|--------|
| Runtime Detection and Port Guard | Compose starts on the resolved port | Phase 7.1/7.3/7.9 (podman ps confirmed live containers on resolved ports) | COMPLIANT |
| Runtime Detection and Port Guard | Fresh worktree scans and assigns ports | Phase 7.1 (real worktree) + my independent spot-check (extracted `scan_free_port`/`port_in_use` run against real free ports, verified 5433 assigned) | COMPLIANT |
| Runtime Detection and Port Guard | Scan skips occupied ports within range | Phase 7.2 (real worktree, `nc -lk` on 5433) + my independent spot-check (extracted function run against `ncat -l 5433`, verified 5434 assigned) | COMPLIANT |
| Runtime Detection and Port Guard | Re-provision reuses persisted ports | Phase 7.3 + 7.8 (`sha256sum` identical `.worktree-port`/`.env` before/after re-run) | COMPLIANT |
| Runtime Detection and Port Guard | Exhausted range fails hard with the scanned range reported | Phase 7.5 (both ranges independently exhausted, exact message matched design) | COMPLIANT |
| Runtime Detection and Port Guard | Main checkout keeps literal defaults | Phase 8.1 (`podman compose config` resolved `5432:5432` with the var unset; script's own `WT != MAIN` guard exits 2 before any port code — confirmed by source read, lines 87-90) | COMPLIANT |
| Per-Worktree Env Rewrite | Worktree env reflects assigned port | Phase 7.7/7.8 (direct file read of the worktree's copied `.env`, `POSTGRES_HOST_PORT`/`POSTGRES_URL` both correct) | COMPLIANT |
| Per-Worktree Env Rewrite | `.env.local` also gets its `POSTGRES_URL` port rewritten | Phase 7.7 (direct file read confirmed rewrite, no stray `POSTGRES_HOST_PORT` line added) | COMPLIANT |
| Per-Worktree Env Rewrite | Main checkout env untouched | Static: rewrite step (6b) sits after the same `WT != MAIN` guard as port-resolve (source read, lines 87-90, 317-360) — structurally unreachable for MAIN; corroborated by `git status --short` showing no unexpected `.env`/`.env.local` modification | COMPLIANT (static + guard evidence) |
| Dev Server Health Check Defines Success | Healthy server on assigned port | Every successful Phase 7 run (7.1/7.3/7.8/7.9) reached step 13 "provisioned successfully," which requires the health probe against `127.0.0.1:$DEV_PORT` to have passed | COMPLIANT |
| Dev Server Health Check Defines Success | Health check fails | **I ran this scenario myself** — extracted the real health-check loop (script lines 439-474) verbatim, occupied the assigned dev port with `nc` first, then launched the real `pnpm dev` on that port exactly as the script does. Next.js crashed immediately with `Error: listen EADDRINUSE: address already in use`. The script's own `grep -qiE 'ready\|compiled successfully'` line then matched the substring "ready" **inside the word "already"** (`address alREADY in use`) and set `healthy=true`, causing the harness to report success (exit 0) for a dev server that had actually crashed and served nothing. Reproduced twice, confirmed in isolation (`echo "already in use" \| grep -qiE 'ready\|compiled successfully'` matches). | **FAILING** |
| Dev Server Health Check Defines Success | Port passed as real process env, not via `.env` | Source read confirms `PORT="$DEV_PORT" nohup pnpm dev` (never via `.env`); confirmed empirically in the same reproduction above — `next dev` correctly received `PORT=3999` and attempted to bind it (that is what produced the real `EADDRINUSE` on exactly that port) | COMPLIANT |

**Compliance summary**: 11/12 scenarios COMPLIANT, 1/12 FAILING

### Correctness (Static Evidence)
| Requirement | Status | Notes |
|------------|--------|-------|
| `docker-compose.yml` port parametrization | Implemented | Line 15: `"${POSTGRES_HOST_PORT:-5432}:5432"`, matches design Decision 4 exactly |
| `.gitignore` | Implemented | `/.worktree-port` present at line 57 |
| `scripts/worktree-provision.sh` — port-resolve step | Implemented | Matches design Decision 1/2/7 verbatim: same range constants, same `scan_free_port`/`port_in_use`, same anchored-grep parse, same reuse/hard-fail branching, same exit codes 7/12 |
| `scripts/worktree-provision.sh` — `.env`/`.env.local` rewrite | Implemented | Matches design Decision 3: temp-file + `chmod 0600` + atomic `mv` + post-write verify grep, applied to `.env` and every `POSTGRES_URL`-bearing `COPIED_ENV_FILES` entry |
| `scripts/worktree-provision.sh` — runtime wiring | Implemented, but with a real defect (see CRITICAL below) | Matches design Decision 4/5's shape (explicit `POSTGRES_HOST_PORT` export, `PORT=` real-env launch, `127.0.0.1` probe, "port in use" log guard) but the log-based success heuristic is unsound |
| Bug fix 1 — `port_in_use()` stderr-closing subshell scoping | Confirmed present | Line 201: `(exec 3>&-) 2>/dev/null \|\| true`, with explanatory comment at lines 195-200 |
| Bug fix 2 — trailing-newline check before `.env` append | Confirmed present | Line 335: `[ "$(tail -c1 "$tmp" \| wc -l)" -eq 0 ]` guard before `printf '\n'` |
| `.claude/rules/worktrees.md` — Port isolation section | Implemented | New section (lines 26-43) documents ranges, `.worktree-port` format, `.env` rewrite scope, exit-code generalization, main-checkout unaffected note — matches design and script behavior |
| `.env.template` (Task 1.3) | Implemented, but not reflected in tasks.md | `git diff .env.template` confirms the human added `# POSTGRES_HOST_PORT=5432` (commented, correct placement) after the `AUTH_SECRET` line |

### Coherence (Design)
| Decision | Followed? | Notes |
|----------|-----------|-------|
| D1 — scan with existing `/dev/tcp` probe, resolved once after runtime detection | Yes | Step 6 placement matches exactly |
| D2 — `.worktree-port` as one `KEY=VALUE` file, anchored grep, never sourced | Yes | Verified via source read and a malformed-file spot-check (injection line correctly rejected, no code execution) |
| D3 — `.env` rewrite via anchored `sed`, temp-file swap, verified after write | Yes | Verified via source read and Phase 7.7/7.8 evidence |
| D4 — `${POSTGRES_HOST_PORT:-5432}` plus explicit export at `compose up` | Yes | Both present |
| D5 — `PORT` as real process env, both internally and in the documented one-liner | Partially — the env-var mechanism is correct, but the design's own stated purpose ("preserves the archived design's rule that there must be no 'succeeded but app broken' exit path") is **not achieved**: the port-conflict log guard the design added does not match Next's actual `EADDRINUSE` wording, and the pre-existing `ready` substring check produces a false positive on that exact crash text | See CRITICAL finding |
| D6 — no new main-checkout guard; existing step-0 guard suffices | Yes | Confirmed unreachable for MAIN by source read |
| D7 — reuse exit codes 7/12, generalized meaning | Yes | Header comments and messages match exactly |

### Issues Found

**CRITICAL**:
1. **Health-check false positive on a crashed dev server** (`scripts/worktree-provision.sh`, lines 447-474, pre-existing `grep -qiE 'ready|compiled successfully'` line, exposed by this change's PORT-targeting logic). When the assigned `DEV_PORT` is actually occupied, Next.js 15 does not silently shift ports (contrary to `design.md`'s stated concern) — it crashes immediately with `Error: listen EADDRINUSE: address already in use`. The word "already" contains the literal substring "ready", so the existing case-insensitive `ready|compiled successfully` grep matches this crash message and the script reports success (exit 0, "worktree provisioned successfully") for a dev server that never actually started or served anything. This directly violates the change's own modified requirement text: "A reported success MUST always correspond to a genuinely healthy, responding dev server" and "MUST exit non-zero if this check fails for any reason." It is also directly relevant to this change's own accepted "Low-risk" concurrent-worktree dev-port collision noted in task 7.9 — a second worktree racing onto the same `DEV_PORT` would now be falsely reported healthy instead of failing loudly. Reproduced independently and deterministically (see Spec Compliance Matrix row above); not a flake. **Recommended fix**: tighten the log match (e.g. Next's actual startup line is `- Local:` / `✓ Ready in Nms`, so match on `✓ Ready` or a word-boundary `\bready\b` that excludes "already"), and/or extend the port-conflict guard to also match `EADDRINUSE|address already in use`, not only `port .* is in use`.

**WARNING**:
1. `tasks.md` still shows Task 1.3 (`.env.template`) as unchecked/BLOCKED, but `git diff .env.template` shows the human has already added the exact confirmed line. Stale bookkeeping, not a functional gap — flip the checkbox once the CRITICAL finding above is resolved and this change is re-verified.
2. `opencode.json` is modified in the working tree (`concise-output.md` added to the `instructions` array, trailing-newline change) but is not mentioned in this change's tasks.md or apply-progress as an intended edit. Confirmed out of scope for `worktree-port-isolation` — likely drift from a concurrent/unrelated session. Not this change's responsibility to resolve, but should not be silently absorbed into this change's commit.

**SUGGESTION**:
1. Once the CRITICAL finding is fixed, add a permanent Phase-7-style scenario ("dev port already occupied by an unrelated process at launch time → script must exit 13, not 0") to `tasks.md` so this exact regression cannot resurface silently.

### Verdict
FAIL
One CRITICAL finding: the dev-server health check can report false success (exit 0) for a crashed server due to a `ready`-substring collision with Next's real `EADDRINUSE` crash message, directly contradicting this change's own "must always correspond to a genuinely healthy, responding dev server" requirement — route back to sdd-apply for a targeted fix and re-verification before archive.
