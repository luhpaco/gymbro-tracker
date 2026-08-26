# Design: Worktree Port Isolation

## Technical Approach

Replace the two refuse-guards in `worktree-provision.sh` (step 6 / port 5432, step 11 / port 3000) with a single **resolve-ports** step that reuses the script's existing `/dev/tcp` probe to scan upward for a free port, persists the assigned pair in a worktree-local `.worktree-port`, and reuses it on re-provision. `docker-compose.yml` gains a defaulted variable host port. The copied `.env` is rewritten in place, inside the worktree only. No application code, schema, migration, or `package.json` change.

## Architecture Decisions

### Decision 1: Scan with the existing `/dev/tcp` probe, resolved once after runtime detection

**Choice**: Keep `port_in_use()` verbatim and add a bounded upward scan over a closed range:

```bash
PG_PORT_RANGE_START=5433;  PG_PORT_RANGE_END=5443    # 11 attempts
DEV_PORT_RANGE_START=3001; DEV_PORT_RANGE_END=3011   # 11 attempts

scan_free_port() {                 # $1 start, $2 end -> prints port, or returns 1
  local port
  for ((port = $1; port <= $2; port++)); do
    port_in_use "$port" || { printf '%s\n' "$port"; return 0; }
  done
  return 1
}
```

Both ports resolve in one new **step 6**, placed after runtime detection (step 5) and before `compose up` (step 7); the old steps 6 and 11 guards are deleted outright.

**Alternatives considered**: `ss`/`lsof`/`nc` probing; resolving the dev port later, at the old step 11.
**Rationale**: `port_in_use()` is already proven in this script and needs no new binary on PATH. Step 6 is the earliest point where `$RUNTIME` exists (required by the own-stack tolerance branch) and the latest point still before the `.env` rewrite and `compose up`. Resolving both ports together makes `.worktree-port` a single atomic write, so a mid-pipeline failure plus re-run reuses the identical pair. The cost — the dev port is reserved earlier than it is used — widens an already-accepted race window the proposal rates Low.

### Decision 2: `.worktree-port` is one `KEY=VALUE` file, parsed by anchored grep, never sourced

**Choice**: `$WT/.worktree-port`, exactly two lines:

```
POSTGRES_HOST_PORT=5433
DEV_PORT=3001
```

Read back with `grep -E "^${key}=[0-9]+$" | tail -n 1 | cut -d= -f2`, then validated to fall inside its own declared range. A missing, malformed, or out-of-range value is treated as **absent** → re-scan.

Reuse logic, generalizing the old "own stack holds the port" branch:

```
persisted value present?
├─ no                      -> scan range; exhausted -> hard fail
└─ yes, in range
   ├─ port free            -> reuse
   ├─ port held by us      -> reuse   (pg: `compose ps -q` non-empty
   │                                   dev: find_dev_pids non-empty)
   └─ port held by other   -> hard fail, naming the port and .worktree-port
```

The Postgres tolerance test is the existing `(cd "$WT" && "$RUNTIME" compose ps -q)` check. The dev tolerance test is `find_dev_pids` (existing, matches on `/proc/<pid>/cwd == $WT`), which must be **moved above** the resolve step to be defined before use; a stale own dev server is then killed by the existing `kill_dev_pids` before the health-check launch.

**Alternatives considered**: two separate files; two bare unlabelled numbers; `source .worktree-port`.
**Rationale**: One file means one `.gitignore` entry and no half-written pair. Labelled keys are self-describing and order-independent. Sourcing is barred by this repo's established shell convention (`.worktreeinclude` is parsed with `while IFS= read -r`, never `eval`/`source`) and would additionally leak `POSTGRES_HOST_PORT` into the caller's shell. Range validation, not just `[0-9]+`, rejects a hand-mangled `999999`. Failing *open* to a re-scan is safe because a re-scan is idempotent; failing *closed* on a stolen port is required because silently moving to a different port would orphan the running stack's data directory.

### Decision 3: `.env` rewrite — anchored `sed`, temp-file swap, verified after write

**Choice**: After the manifest copy, for the worktree's copied `.env`:

1. **`POSTGRES_HOST_PORT`** — replace the line if `^[[:space:]]*POSTGRES_HOST_PORT=` matches, else append `POSTGRES_HOST_PORT=<pg_port>`.
2. **`POSTGRES_URL`** — rewrite only the host-port segment:
   `sed -E "s|^([[:space:]]*POSTGRES_URL=.*@[^:/@]+):[0-9]+/|\1:${PG_PORT}/|"`
3. Write to a temp file inside `$WT`, `chmod 0600` it, then `mv` (same-filesystem, atomic).
4. **Verify**: `grep -qE "^[[:space:]]*POSTGRES_URL=.*:${PG_PORT}/"`. If it fails, exit 7 with a message telling the human that `.env`'s `POSTGRES_URL` needs an explicit `:<port>/` segment.

Step 2 is additionally applied to **every** copied `.env*` in the existing `COPIED_ENV_FILES` array that contains a `POSTGRES_URL=` line — `.env.local` is in `.worktreeinclude` and Next.js gives it higher precedence than `.env`. Step 1 targets `.env` only, because that is the file compose reads.

**Assumed `.env` shape**: `POSTGRES_URL=postgresql://<user>:<pass>@<host>:5432/<db>[?params]`. Evidence: `prisma/schema.prisma:13` reads `env("POSTGRES_URL")`; `.github/workflows/ci.yml:18` uses that exact shape. **`.env`/`.env.template` are unreadable to agent tooling** — see Open Items.

**Alternatives considered**: a blanket `s/5432/<port>/g`; rewriting in place with `sed -i`; regenerating `.env` from `.env.template`.
**Rationale**: A global `5432` substitution would corrupt any unrelated value containing that digit string. `sed -i` on a `0600` secrets file can leave a partial file on failure; a temp-file swap cannot. Regenerating from the template would discard the human's real credentials. The greedy `.*@` correctly binds to the **last** `@`, so a password containing `@` is handled. The post-write verification is the load-bearing part: it converts a wrong assumption about `.env`'s format from silent misconfiguration into a loud, actionable failure.

### Decision 4: `${POSTGRES_HOST_PORT:-5432}` plus an explicit export at `compose up`

**Choice**: `docker-compose.yml:15` becomes `- "${POSTGRES_HOST_PORT:-5432}:5432"` (quoted, since it is now an interpolated string), and the provision step exports the value into the real process environment anyway:

```bash
(cd "$WT" && POSTGRES_HOST_PORT="$PG_PORT" "$RUNTIME" compose up -d)
```

**Verified, not assumed**: the installed runtime already auto-loads the project-directory `.env`. `docker-compose.yml` lines 8–11 interpolate `${DB_HOST}`, `${DB_USER}`, `${DB_NAME}`, `${DB_PASSWORD}` today, and the stack demonstrably reaches `pg_isready` — with no `.env` load, `POSTGRES_PASSWORD` would be empty and the `postgres:15.3` entrypoint would abort with "Database is uninitialized and superuser password is not specified". So auto-load is confirmed by observed behavior rather than by version inspection (this agent has no shell access to run `podman compose version`).

**Alternatives considered**: relying on `.env` auto-load alone; `--env-file`; a per-worktree compose override file.
**Rationale**: The explicit export costs one assignment, takes precedence over `.env` in compose's own variable resolution, and removes the dependency on auto-load entirely — cheap belt-and-suspenders regardless. `:-5432` is what keeps the main checkout and every already-provisioned worktree on the current behavior with no `.env` edit.

### Decision 5: `PORT` as real process env, both internally and in the documented one-liner

**Choice**: Internal health-check launch:

```bash
(cd "$WT" && PORT="$DEV_PORT" nohup pnpm dev >"$DEV_LOG" 2>&1 &)
```

Probe `http://127.0.0.1:$DEV_PORT` (aligning the curl target with `port_in_use`'s `127.0.0.1`, removing an IPv6-`localhost` resolution mismatch). The log-line branch of the health check gains a guard: if the log matches `port .* is in use`, fail immediately rather than accept a `Ready` line from a server that silently shifted ports.

Documented human one-liner for `.claude/rules/worktrees.md`:

```bash
PORT=$(grep -E '^DEV_PORT=[0-9]+$' .worktree-port | cut -d= -f2) pnpm dev
```

**Alternatives considered**: `pnpm dev -- --port N`; `PORT=$(cat .worktree-port)`; `source .worktree-port`.
**Rationale**: The spec mandates `PORT` in the real process environment (Next.js does not read `PORT` from `.env`) and forbids touching `package.json`. `cat` is wrong because the file has two labelled lines. `source` is barred by Decision 2's rationale. The "port in use" log guard preserves the archived design's rule that there must be no "succeeded but app broken" exit path.

### Decision 6: No new main-checkout guard — the existing step-0 guard already makes port logic unreachable

**Choice**: Add nothing. `worktree-provision.sh:78-81` already exits 2 when `$WT = $MAIN`, before any port code runs, so scan-and-assign is structurally unreachable for the main checkout and no `.worktree-port` can be created or read there. The main checkout's Postgres port comes from the compose `:-5432` default; its dev port comes from `next dev`'s own default when `PORT` is unset. Every rewrite path is built from `$WT`, never `$MAIN`.

**Alternatives considered**: wrapping port resolution in `if [ "$WT" != "$MAIN" ]`.
**Rationale**: That conditional would be dead code, and worse, it would imply a reachable main-checkout path through the port logic that does not exist — misleading a future reader into thinking the guard is what protects the main checkout.

### Decision 7: Reuse exit codes 7 and 12; error names the exact range

**Choice**: Exit **7** for any Postgres-port failure (range exhausted, persisted port stolen, `.env` rewrite unverifiable); exit **12** for any dev-port failure. Exact messages:

```
[worktree-provision] ERROR: no free Postgres host port found in range 5433-5443 (11 ports scanned); free one and re-run
[worktree-provision] ERROR: no free dev-server port found in range 3001-3011 (11 ports scanned); free one and re-run
[worktree-provision] ERROR: assigned Postgres port 5435 (from .worktree-port) is held by another process/stack; free it, or delete .worktree-port to re-scan
```

**Alternatives considered**: new codes 14/15.
**Rationale**: Exit codes are a published contract in the script header and `.claude/rules/worktrees.md`. 7 and 12 already mean "port unavailable" for their respective ports; the *reason* changed, the *meaning* did not. New codes would orphan 7/12 and force renumbering documentation for no added information.

## Data Flow — revised `worktree-provision.sh` pipeline

```
 #  step                                                  fail   idempotency
────────────────────────────────────────────────────────────────────────────
 0  WT / MAIN resolve; WT != MAIN guard                   exit 2  pure check
 2  parse MAIN/.worktreeinclude                           exit 3  pure read
 3  cp -a entries; chmod 0600 WT/.env*                    exit 4  convergent
 4  pnpm install (cwd=WT)                                 exit 5  convergent
 5  RUNTIME := podman | docker                            exit 6  pure detect
 6  RESOLVE PORTS  (new — replaces old 6 and 11)          exit 7  reuses .worktree-port
      read .worktree-port -> validate -> reuse | re-scan  /12
      write .worktree-port (both keys, one write)
 6b .env rewrite: POSTGRES_HOST_PORT + POSTGRES_URL       exit 7  same bytes on re-run
      temp file -> chmod 0600 -> mv -> verify
 7  SELinux relabel; POSTGRES_HOST_PORT=$PG compose up -d exit 8  compose no-ops when up
 8  poll pg_isready, 60s                                  exit 9  pure poll
 9  prisma migrate deploy                                 exit 10 idempotent by contract
10  [ -d WT/.codegraph ] || codegraph init                exit 11 SKIPPED when present
11  kill_dev_pids (stale own dev server on $DEV_PORT)      —      no-op when none
12  PORT=$DEV nohup pnpm dev -> .worktree-dev.log         exit 13 n/a
      poll http://127.0.0.1:$DEV / "Ready" log line
      "port ... is in use" in log -> immediate fail
13  kill dev, rm dev log, print summary + both ports      exit 0
```

Any non-zero exit leaves state as-is — no unwind, unchanged from the prior design.

## File Changes

| File | Action | Description |
|---|---|---|
| `docker-compose.yml` | Modify | Line 15 → `- "${POSTGRES_HOST_PORT:-5432}:5432"` |
| `scripts/worktree-provision.sh` | Modify | New steps 6/6b/11; delete both refuse-guards; hoist `find_dev_pids`/`kill_dev_pids`; `PORT=` launch; `127.0.0.1` probe; port-in-use log guard; summary prints both ports and the one-liner; header exit-code comments updated |
| `.gitignore` | Modify | Add `/.worktree-port` |
| `.env.template` | Modify | Add commented `POSTGRES_HOST_PORT` line — placement human-confirmed (unreadable to tooling) |
| `.claude/rules/worktrees.md` | Modify | Document assignment, ranges, `.worktree-port`, the `pnpm dev` one-liner, revised exit codes, and the pre-existing-branch caveat below |
| `scripts/worktree-cleanup.sh` | **Unchanged** | See below |

**`worktree-cleanup.sh` needs no change, confirmed on two points.** (a) `compose down` resolves the stack by project name and labels, not by published-port mapping, so it is port-agnostic; the worktree's own `.env` still carries `POSTGRES_HOST_PORT` even for a config-parsing implementation. (b) `.worktree-port` needs **no explicit removal** — it is deleted with the directory by `git worktree remove`, exactly like the already-present `.env`, `node_modules/`, and `.codegraph/`.

**Documented consequence**: `git status --porcelain` excludes ignored files, so `.worktree-port` is invisible to cleanup's dirty check *only on a branch that carries the new `/.worktree-port` line*. A worktree on an older branch will see it as untracked and cleanup will correctly refuse without `--force`. This is the same class of issue the archived design solved for `.worktree-dev.log` by deleting on success; that escape is unavailable here because `.worktree-port` is deliberately persistent state. Record it under Known limits rather than engineering around it.

## Interfaces / Contracts

### `.worktree-port`

| Property | Value |
|---|---|
| Location | `$WT/.worktree-port` (worktree root), gitignored as `/.worktree-port` |
| Format | Exactly two lines, `KEY=VALUE`, no quoting, no comments |
| Keys | `POSTGRES_HOST_PORT` (5433–5443), `DEV_PORT` (3001–3011) |
| Parser | `grep -E '^KEY=[0-9]+$'` + range check; never `source`, never `eval` |
| Invalid value | Treated as absent → re-scan (fail-open; a re-scan is idempotent) |
| Written | Once per run, both keys together, in step 6 |
| Removed | Never by the scripts; dies with the worktree directory |

## Testing Strategy

Automated tests for shell remain out of scope per the prior design; applicable cases become named manual scenarios with exact exit codes, carried unchanged into `tasks.md`.

| Layer | What to test | Approach |
|---|---|---|
| Static | Bash correctness | `shellcheck scripts/worktree-*.sh` |
| Scenario (RED-equivalent) | Fresh scan; occupied-port skip; persisted reuse; stolen persisted port; exhausted range; malformed/out-of-range `.worktree-port` | Throwaway worktree; occupy ports with `nc -l`; assert exits 0 / 7 / 12 and exact message text |
| Integration | Two sibling worktrees concurrently | Provision A, leave its stack up, provision B; assert distinct ports, both stacks live, both `.env` files internally consistent |
| Regression | Main checkout unaffected | `compose up -d` in `$MAIN` with no `POSTGRES_HOST_PORT` set → binds 5432; `pnpm dev` → 3000; no `.worktree-port` created |
| E2E | Idempotency | Re-run provisioning on a live worktree → exit 0, same ports, `.env` byte-identical |

## Threat Matrix

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | **Applicable** — `.worktree-port` and `.env` are data files read by a shell script | Anchored `grep -E '^KEY=[0-9]+$'` plus range validation; never `source`/`eval`; all expansions quoted; `.env` edited via anchored `sed` to a `0600` temp file then `mv`, with a post-write verification grep | `.worktree-port` containing `DEV_PORT=$(touch pwned)`, `POSTGRES_HOST_PORT=3001; rm -rf /`, `POSTGRES_HOST_PORT=999999`, an empty file, and a duplicated key — each must re-scan or fail, never execute |
| Git repository selection | **Applicable** — both scripts shell out to git | Unchanged: absolute-path normalisation, explicit `git -C "$MAIN"` / `git -C "$WT"`, membership validated against `git worktree list --porcelain`; port logic sits *after* the `$WT != $MAIN` guard | Main-checkout path still exits 2 before any port code and creates no `.worktree-port` |
| Commit state | **Applicable** — cleanup's dirty guard now faces a new persistent file | `/.worktree-port` added to `.gitignore` so it never counts as untracked on branches carrying the line | Provision then `worktree-cleanup.sh` without `--force` on a branch with the new `.gitignore` → exit 0; on a branch without it → exit 3 (expected, documented) |
| Push state | **N/A** | Neither script pushes, fetches, or resolves a remote ref | — |
| PR commands | **N/A** | No `gh` or PR automation in this change | — |

## Migration / Rollout

No data migration. Already-provisioned worktrees have no `.worktree-port`; their next provisioning run scans, assigns, rewrites `.env`, and recreates the container with a new published port against the same `./postgres` bind mount — data is preserved because only the host-side mapping changes. Rollout order: edit `docker-compose.yml` and `.gitignore` → rewrite the script → `shellcheck` → dry-run the scenario matrix on a throwaway worktree → concurrency test with two worktrees → main-checkout regression check → docs last.

Rollback is reverting the five files; a stale `.worktree-port` becomes inert once nothing reads it.

## Open items requiring human confirmation

- [x] **`.env` / `.env.template` exact keys and `POSTGRES_URL` format.** User-confirmed 2026-08-26: `POSTGRES_URL` carries an explicit `:5432` port segment, matching the assumed shape (`postgresql://<user>:<pass>@<host>:<port>/<db>`). Decision 3's anchored `sed` and post-write verification apply as designed, no adjustment needed.
- [x] **Whether the human's `.env.local` (if any) carries a `POSTGRES_URL`.** User-confirmed 2026-08-26: `.env.local` exists and does carry its own `POSTGRES_URL`. Decision 3's generic rewrite over every `POSTGRES_URL`-bearing `.env*` file is load-bearing, not theoretical — `tasks.md` must include an explicit `.env.local` rewrite test case, not just `.env`.
- [x] **`POSTGRES_HOST_PORT` key collision in `.env.template`.** User-confirmed 2026-08-26: the key does not exist yet. `tasks.md` adds it fresh per Decision 4/File Changes, no rename or dedup needed.
- [ ] **`next dev` behavior when `PORT` is set and that port is taken.** Not verifiable without shell access. If Next silently shifts, the "port ... is in use" log guard in Decision 5 must catch it; verify the exact log wording during apply and adjust the pattern if it differs.
- [ ] **`podman compose version`.** Not run (no shell access). `.env` auto-load is inferred from the existing working `${DB_*}` interpolation; the explicit export in Decision 4 makes this non-blocking either way.

## Key Learnings

1. The existing `${DB_USER}` interpolation in `docker-compose.yml` already proves the installed runtime auto-loads the project `.env`.
2. Reusing exit codes 7 and 12 preserves the published contract because the port-unavailable meaning is unchanged.
3. Copied `.env.local` also needs the port rewrite since Next.js ranks it above `.env`.
4. A post-write verification grep converts an unreadable-file assumption into a loud failure instead of silent misconfiguration.
5. The existing step-0 `$WT != $MAIN` guard already makes all port logic unreachable from the main checkout.
