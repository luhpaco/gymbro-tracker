#!/usr/bin/env bash
#
# worktree-provision.sh <path>
#
# Turns a freshly created sibling git worktree into a runnable checkout:
# copies gitignored files listed in .worktreeinclude, installs deps, starts
# the container runtime, waits for Postgres, runs migrations, initializes a
# per-worktree CodeGraph index if missing, then proves the dev server
# actually compiles and responds before reporting success.
#
# Idempotent: re-running skips or converges every step. On a mid-pipeline
# failure the script leaves partial state as-is; recovery is re-running.
#
# Port isolation: each worktree gets its own Postgres host port (range
# 5433-5443) and dev-server port (range 3001-3011), scanned on first run and
# persisted to a gitignored .worktree-port file, reused on every re-run. The
# main checkout is never affected: it keeps the literal defaults (5432, 3000)
# and never creates or reads .worktree-port.
#
# Exit codes:
#   2  precondition guard failed (main checkout or unknown worktree)
#   3  .worktreeinclude parse/validation failed
#   4  file copy step failed
#   5  pnpm install failed
#   6  no container runtime with compose found
#   7  Postgres host port: scan exhausted, persisted port held by another
#      process/stack, or the copied .env's POSTGRES_URL rewrite could not be
#      verified
#   8  compose up failed
#   9  Postgres never became ready within the timeout
#  10  prisma migrate deploy failed
#  11  codegraph init failed
#  12  dev-server port: scan exhausted, or persisted port held by another
#      process/stack
#  13  dev server health check failed

set -euo pipefail

PG_READY_TIMEOUT=60
PG_READY_INTERVAL=2
DEV_HEALTH_TIMEOUT=120
DEV_HEALTH_INTERVAL=2

log() { printf '[worktree-provision] %s\n' "$*"; }
warn() { printf '[worktree-provision] WARNING: %s\n' "$*" >&2; }
err() { printf '[worktree-provision] ERROR: %s\n' "$*" >&2; }

usage() {
  printf 'Usage: %s <path-to-worktree>\n' "$(basename "$0")" >&2
}

# --- step 0: resolve args, WT, MAIN --------------------------------------

if [ "$#" -ne 1 ]; then
  usage
  exit 2
fi

TARGET_ARG="$1"

if [ ! -d "$TARGET_ARG" ]; then
  err "path does not exist or is not a directory: $TARGET_ARG"
  exit 2
fi

WT="$(cd "$TARGET_ARG" && pwd)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Any worktree shares the same repository metadata, so `git worktree list`
# run from this script's own location (whichever worktree it was invoked
# from) still enumerates every worktree, including the main one.
WORKTREE_LIST="$(git -C "$SCRIPT_DIR" worktree list --porcelain)"

MAIN="$(printf '%s\n' "$WORKTREE_LIST" | awk '/^worktree /{print $2; exit}')"

if [ -z "$MAIN" ]; then
  err "could not determine the main git checkout"
  exit 2
fi

if ! printf '%s\n' "$WORKTREE_LIST" | awk '/^worktree /{print $2}' | grep -qxF "$WT"; then
  err "$WT is not a registered git worktree (run 'git worktree add' first)"
  exit 2
fi

if [ "$WT" = "$MAIN" ]; then
  err "refusing to run against the main checkout ($MAIN)"
  exit 2
fi

log "main checkout: $MAIN"
log "target worktree: $WT"

# --- step 2/3: parse .worktreeinclude and copy entries --------------------

MANIFEST="$MAIN/.worktreeinclude"

if [ ! -f "$MANIFEST" ]; then
  err "manifest not found: $MANIFEST"
  exit 3
fi

COPIED_ENV_FILES=()

copy_manifest_entries() {
  local raw entry src dst resolved
  while IFS= read -r raw || [ -n "$raw" ]; do
    # trim leading/trailing whitespace
    entry="${raw#"${raw%%[![:space:]]*}"}"
    entry="${entry%"${entry##*[![:space:]]}"}"

    [ -z "$entry" ] && continue
    case "$entry" in
      \#*) continue ;;
    esac

    if [[ "$entry" == /* ]]; then
      err "manifest entry must be repo-relative, not absolute: $entry"
      exit 3
    fi

    if [[ "$entry" =~ (^|/)\.\.(/|$) ]]; then
      err "manifest entry must not contain '..' segments: $entry"
      exit 3
    fi

    src="$MAIN/$entry"
    dst="$WT/$entry"

    if [ ! -e "$src" ] && [ ! -L "$src" ]; then
      warn "manifest source missing, skipping: $entry"
      continue
    fi

    mkdir -p "$(dirname "$dst")"
    if ! cp -a "$src" "$dst"; then
      err "failed to copy manifest entry: $entry"
      exit 4
    fi

    if [ -L "$dst" ]; then
      resolved="$(readlink -f "$dst" 2>/dev/null || true)"
      case "$resolved" in
        "$WT"/*) : ;;
        *) warn "symlink '$entry' resolves outside the worktree ($resolved) — verify it does not point back at the main checkout" ;;
      esac
    fi

    case "$(basename "$entry")" in
      .env*) COPIED_ENV_FILES+=("$dst") ;;
    esac
  done < "$MANIFEST"
}

copy_manifest_entries

# chmod only the .env* files this run actually copied (not any pre-existing
# tracked file that happens to match .env*, e.g. .env.template)
if [ "${#COPIED_ENV_FILES[@]}" -gt 0 ]; then
  chmod 0600 "${COPIED_ENV_FILES[@]}"
  log "chmod 0600 applied to: ${COPIED_ENV_FILES[*]}"
fi

log "manifest copy complete"

# --- step 4: pnpm install --------------------------------------------------

log "running pnpm install"
if ! (cd "$WT" && pnpm install); then
  err "pnpm install failed"
  exit 5
fi

# --- step 5: detect container runtime --------------------------------------

RUNTIME=""
if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
  RUNTIME="podman"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  RUNTIME="docker"
else
  err "no container runtime with compose found (checked: podman, docker)"
  exit 6
fi

log "using container runtime: $RUNTIME"

# --- step 6: resolve ports (Postgres + dev server) --------------------------

port_in_use() {
  local port="$1"
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null
  local result=$?
  # Scoped to its own subshell: fd 3 only ever existed inside the probe
  # subshell above, so this close is a no-op either way. Left unscoped, a
  # bare `exec 3>&- 2>/dev/null` (no subshell) would permanently redirect
  # this script's own stderr to /dev/null on every direct (non-subshelled)
  # call to this function — silently swallowing every err()/warn() printed
  # afterward for the rest of the run.
  (exec 3>&-) 2>/dev/null || true
  return "$result"
}

scan_free_port() {                 # $1 start, $2 end -> prints port, or returns 1
  local port
  for ((port = $1; port <= $2; port++)); do
    port_in_use "$port" || { printf '%s\n' "$port"; return 0; }
  done
  return 1
}

# Match dev-server processes by actual working directory (/proc/<pid>/cwd)
# rather than by cmdline substring: `next dev`/`next-server` command lines do
# not reliably include the worktree path, but every process spawned via
# `(cd "$WT" && ... nohup pnpm dev ...)` keeps that exact cwd.
find_dev_pids() {
  local pid cwd
  for pid in $(pgrep -f 'next' 2>/dev/null || true); do
    [ -d "/proc/$pid" ] || continue
    cwd="$(readlink -f "/proc/$pid/cwd" 2>/dev/null || true)"
    [ "$cwd" = "$WT" ] || continue
    printf '%s\n' "$pid"
  done
}

kill_dev_pids() {
  local pid
  find_dev_pids | while IFS= read -r pid; do
    [ -z "$pid" ] && continue
    kill "$pid" 2>/dev/null || true
  done
}

PG_PORT_RANGE_START=5433
PG_PORT_RANGE_END=5443
DEV_PORT_RANGE_START=3001
DEV_PORT_RANGE_END=3011

WORKTREE_PORT_FILE="$WT/.worktree-port"

# Anchored parse, never sourced/eval'd: a malformed, non-numeric, or
# out-of-range value is treated as absent, which safely falls through to a
# fresh scan rather than executing untrusted file content.
read_persisted_value() {
  grep -E "^$1=[0-9]+\$" "$WORKTREE_PORT_FILE" 2>/dev/null | tail -n 1 | cut -d= -f2 || true
}

value_in_range() {
  local v="$1" lo="$2" hi="$3"
  [[ "$v" =~ ^[0-9]+$ ]] && [ "$v" -ge "$lo" ] && [ "$v" -le "$hi" ]
}

PG_PORT=""
DEV_PORT=""

if [ -f "$WORKTREE_PORT_FILE" ]; then
  persisted_pg="$(read_persisted_value POSTGRES_HOST_PORT)"
  persisted_dev="$(read_persisted_value DEV_PORT)"
  if value_in_range "${persisted_pg:-}" "$PG_PORT_RANGE_START" "$PG_PORT_RANGE_END"; then
    PG_PORT="$persisted_pg"
  fi
  if value_in_range "${persisted_dev:-}" "$DEV_PORT_RANGE_START" "$DEV_PORT_RANGE_END"; then
    DEV_PORT="$persisted_dev"
  fi
fi

if [ -n "$PG_PORT" ]; then
  if port_in_use "$PG_PORT"; then
    owned_by_this_worktree="$(cd "$WT" && "$RUNTIME" compose ps -q 2>/dev/null || true)"
    if [ -z "$owned_by_this_worktree" ]; then
      err "assigned Postgres port $PG_PORT (from .worktree-port) is held by another process/stack; free it, or delete .worktree-port to re-scan"
      exit 7
    fi
    log "Postgres port $PG_PORT already in use by this worktree's own stack, reusing"
  else
    log "reusing persisted, free Postgres port $PG_PORT"
  fi
else
  if ! PG_PORT="$(scan_free_port "$PG_PORT_RANGE_START" "$PG_PORT_RANGE_END")"; then
    err "no free Postgres host port found in range ${PG_PORT_RANGE_START}-${PG_PORT_RANGE_END} (11 ports scanned); free one and re-run"
    exit 7
  fi
  log "assigned Postgres host port $PG_PORT"
fi

if [ -n "$DEV_PORT" ]; then
  if port_in_use "$DEV_PORT"; then
    if [ -z "$(find_dev_pids)" ]; then
      err "assigned dev-server port $DEV_PORT (from .worktree-port) is held by another process/stack; free it, or delete .worktree-port to re-scan"
      exit 12
    fi
    log "dev-server port $DEV_PORT already in use by this worktree's own dev server, reusing"
  else
    log "reusing persisted, free dev-server port $DEV_PORT"
  fi
else
  if ! DEV_PORT="$(scan_free_port "$DEV_PORT_RANGE_START" "$DEV_PORT_RANGE_END")"; then
    err "no free dev-server port found in range ${DEV_PORT_RANGE_START}-${DEV_PORT_RANGE_END} (11 ports scanned); free one and re-run"
    exit 12
  fi
  log "assigned dev-server port $DEV_PORT"
fi

# Persist both keys together in one atomic write, so a mid-pipeline failure
# plus re-run reuses the identical pair rather than re-scanning.
WORKTREE_PORT_TMP="$(mktemp "$WT/.worktree-port.XXXXXX")"
{
  printf 'POSTGRES_HOST_PORT=%s\n' "$PG_PORT"
  printf 'DEV_PORT=%s\n' "$DEV_PORT"
} >"$WORKTREE_PORT_TMP"
chmod 0600 "$WORKTREE_PORT_TMP"
mv "$WORKTREE_PORT_TMP" "$WORKTREE_PORT_FILE"

log "worktree ports: Postgres=$PG_PORT dev=$DEV_PORT (persisted to $WORKTREE_PORT_FILE)"

# --- step 6b: rewrite copied .env* files with the assigned Postgres port ---

# POSTGRES_HOST_PORT is only ever set in .env itself (the file the container
# runtime reads). The POSTGRES_URL host-port segment rewrite applies to
# every copied .env* file that contains one, since Next.js resolves
# .env.local ahead of .env. Written to a 0600 temp file inside the worktree
# and swapped in atomically; the rewrite is verified immediately after.
rewrite_env_postgres_port() {
  local file="$1" tmp
  tmp="$(mktemp "$WT/.env-rewrite.XXXXXX")"
  cp "$file" "$tmp"

  if [ "$(basename "$file")" = ".env" ]; then
    if grep -qE '^[[:space:]]*POSTGRES_HOST_PORT=' "$tmp"; then
      sed -i -E "s|^[[:space:]]*POSTGRES_HOST_PORT=.*|POSTGRES_HOST_PORT=${PG_PORT}|" "$tmp"
    else
      # A source file with no trailing newline would otherwise get the new
      # key silently concatenated onto its last existing line.
      if [ -s "$tmp" ] && [ "$(tail -c1 "$tmp" | wc -l)" -eq 0 ]; then
        printf '\n' >>"$tmp"
      fi
      printf 'POSTGRES_HOST_PORT=%s\n' "$PG_PORT" >>"$tmp"
    fi
  fi

  if grep -qE '^[[:space:]]*POSTGRES_URL=' "$tmp"; then
    sed -i -E "s|^([[:space:]]*POSTGRES_URL=.*@[^:/@]+):[0-9]+/|\1:${PG_PORT}/|" "$tmp"
  fi

  chmod 0600 "$tmp"
  mv "$tmp" "$file"

  if grep -qE '^[[:space:]]*POSTGRES_URL=' "$file" && ! grep -qE "^[[:space:]]*POSTGRES_URL=.*:${PG_PORT}/" "$file"; then
    err "could not verify $file's POSTGRES_URL carries the assigned Postgres port ${PG_PORT}; POSTGRES_URL must include an explicit :<port>/ segment"
    exit 7
  fi
}

if [ "${#COPIED_ENV_FILES[@]}" -gt 0 ]; then
  for env_file in "${COPIED_ENV_FILES[@]}"; do
    rewrite_env_postgres_port "$env_file"
  done
  log "rewrote assigned Postgres port ${PG_PORT} into: ${COPIED_ENV_FILES[*]}"
fi

# --- step 7: compose up -----------------------------------------------------

# On SELinux-enforcing hosts, rootless podman needs the bind-mounted Postgres
# data directory pre-labeled container_file_t (what a `:Z` mount flag would
# do); otherwise the postgres image's own chown/chmod bootstrap fails inside
# the container and Postgres never becomes ready. This relabeling step does
# not itself require any docker-compose.yml change; that file stays shared
# with the main checkout (its only change for port isolation is the
# ${POSTGRES_HOST_PORT:-5432} default read below) and this step only
# prepares the target worktree's own directory before it is first mounted.
if [ "$RUNTIME" = "podman" ] && command -v selinuxenabled >/dev/null 2>&1 && selinuxenabled 2>/dev/null; then
  mkdir -p "$WT/postgres"
  if ! chcon -Rt container_file_t "$WT/postgres" 2>/dev/null; then
    warn "could not SELinux-relabel $WT/postgres; Postgres startup may fail"
  fi
fi

log "starting container stack on Postgres host port $PG_PORT"
if ! (cd "$WT" && POSTGRES_HOST_PORT="$PG_PORT" "$RUNTIME" compose up -d); then
  err "$RUNTIME compose up failed"
  exit 8
fi

# --- step 8: wait for postgres readiness ------------------------------------

log "waiting for Postgres readiness (timeout ${PG_READY_TIMEOUT}s)"
waited=0
pg_ready=false
while [ "$waited" -lt "$PG_READY_TIMEOUT" ]; do
  if (cd "$WT" && "$RUNTIME" compose exec -T postgres-db pg_isready) >/dev/null 2>&1; then
    pg_ready=true
    break
  fi
  sleep "$PG_READY_INTERVAL"
  waited=$((waited + PG_READY_INTERVAL))
done

if [ "$pg_ready" != true ]; then
  err "Postgres never became ready within ${PG_READY_TIMEOUT}s; containers left running for retry"
  exit 9
fi

log "Postgres is ready"

# --- step 9: prisma migrate deploy ------------------------------------------

log "running prisma migrate deploy"
if ! (cd "$WT" && pnpm exec prisma migrate deploy); then
  err "prisma migrate deploy failed"
  exit 10
fi

# --- step 10: conditional codegraph init ------------------------------------

if [ -d "$WT/.codegraph" ]; then
  log "CodeGraph index already present, skipping init"
else
  log "initializing CodeGraph index"
  if ! codegraph init "$WT"; then
    err "codegraph init failed"
    exit 11
  fi
fi

# --- step 11: kill any stale dev server this worktree previously left ------
# running, so it does not shadow the freshly assigned dev port. No-op when
# none is running.

kill_dev_pids

# --- step 12: dev server health check ---------------------------------------

DEV_LOG="$WT/.worktree-dev.log"

log "starting dev server for health check on port $DEV_PORT (log: $DEV_LOG)"
(cd "$WT" && PORT="$DEV_PORT" nohup pnpm dev >"$DEV_LOG" 2>&1 &)

healthy=false
dev_failed=false
waited=0
while [ "$waited" -lt "$DEV_HEALTH_TIMEOUT" ]; do
  # Failure signature checked first and independently of the success check
  # below: a genuine crash line (e.g. Next.js 15's immediate EADDRINUSE
  # abort, which does NOT silently shift to another port) must never be
  # shadowed by a coincidental success-substring match in the same log
  # (notably "ready" inside "address already in use").
  if grep -qiE 'eaddrinuse|address already in use|port .* is in use' "$DEV_LOG" 2>/dev/null; then
    dev_failed=true
    break
  fi
  if curl -fsS -o /dev/null -w '%{http_code}' "http://127.0.0.1:${DEV_PORT}" 2>/dev/null | grep -q '^200$'; then
    healthy=true
    break
  fi
  # Anchored on Next.js's actual success line (" ✓ Ready in <n>ms") via a
  # word-boundary match so "ready" never matches inside "already".
  if grep -qiE '\bready\b|compiled successfully' "$DEV_LOG" 2>/dev/null; then
    healthy=true
    break
  fi
  sleep "$DEV_HEALTH_INTERVAL"
  waited=$((waited + DEV_HEALTH_INTERVAL))
done

if [ "$dev_failed" = true ]; then
  err "dev server failed to start on port ${DEV_PORT} (EADDRINUSE / address already in use); it did not silently shift to another port"
  err "--- tail of $DEV_LOG ---"
  tail -n 40 "$DEV_LOG" >&2 2>/dev/null || true
  kill_dev_pids
  exit 13
fi

if [ "$healthy" != true ]; then
  err "dev server health check failed within ${DEV_HEALTH_TIMEOUT}s"
  err "--- tail of $DEV_LOG ---"
  tail -n 40 "$DEV_LOG" >&2 2>/dev/null || true
  kill_dev_pids
  # dev log is kept on failure for diagnosis
  exit 13
fi

log "dev server responded healthy on port $DEV_PORT"

# --- step 13: success cleanup -----------------------------------------------

kill_dev_pids
rm -f "$DEV_LOG"

log "worktree provisioned successfully: $WT"
log "assigned ports — Postgres: $PG_PORT, dev server: $DEV_PORT"
log "next step: cd \"$WT\" && PORT=\$(grep -E '^DEV_PORT=[0-9]+\$' .worktree-port | cut -d= -f2) pnpm dev"

exit 0
