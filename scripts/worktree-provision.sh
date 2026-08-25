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
# Exit codes:
#   2  precondition guard failed (main checkout or unknown worktree)
#   3  .worktreeinclude parse/validation failed
#   4  file copy step failed
#   5  pnpm install failed
#   6  no container runtime with compose found
#   7  port 5432 already in use by another stack
#   8  compose up failed
#   9  Postgres never became ready within the timeout
#  10  prisma migrate deploy failed
#  11  codegraph init failed
#  12  port 3000 already in use
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

# --- step 6: port 5432 guard ------------------------------------------------

port_in_use() {
  local port="$1"
  (exec 3<>"/dev/tcp/127.0.0.1/$port") 2>/dev/null
  local result=$?
  exec 3>&- 2>/dev/null || true
  return "$result"
}

if port_in_use 5432; then
  owned_by_this_worktree="$(cd "$WT" && "$RUNTIME" compose ps -q 2>/dev/null || true)"
  if [ -z "$owned_by_this_worktree" ]; then
    err "port 5432 is already in use by another process/stack. Stop it before provisioning this worktree (e.g. '$RUNTIME compose down' in whichever checkout owns it), or free the port manually."
    exit 7
  fi
  log "port 5432 already in use by this worktree's own stack, continuing"
fi

# --- step 7: compose up -----------------------------------------------------

# On SELinux-enforcing hosts, rootless podman needs the bind-mounted Postgres
# data directory pre-labeled container_file_t (what a `:Z` mount flag would
# do); otherwise the postgres image's own chown/chmod bootstrap fails inside
# the container and Postgres never becomes ready. docker-compose.yml is
# shared with the main checkout and is not modified; this only prepares the
# target worktree's own directory before it is first mounted.
if [ "$RUNTIME" = "podman" ] && command -v selinuxenabled >/dev/null 2>&1 && selinuxenabled 2>/dev/null; then
  mkdir -p "$WT/postgres"
  if ! chcon -Rt container_file_t "$WT/postgres" 2>/dev/null; then
    warn "could not SELinux-relabel $WT/postgres; Postgres startup may fail"
  fi
fi

log "starting container stack"
if ! (cd "$WT" && "$RUNTIME" compose up -d); then
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

# --- step 11: port 3000 guard -----------------------------------------------

if port_in_use 3000; then
  err "port 3000 is already in use. Stop whatever is bound to it before provisioning this worktree's dev server."
  exit 12
fi

# --- step 12: dev server health check ---------------------------------------

DEV_LOG="$WT/.worktree-dev.log"

log "starting dev server for health check (log: $DEV_LOG)"
(cd "$WT" && nohup pnpm dev >"$DEV_LOG" 2>&1 &)

healthy=false
waited=0
while [ "$waited" -lt "$DEV_HEALTH_TIMEOUT" ]; do
  if curl -fsS -o /dev/null -w '%{http_code}' "http://localhost:3000" 2>/dev/null | grep -q '^200$'; then
    healthy=true
    break
  fi
  if grep -qiE 'ready|compiled successfully' "$DEV_LOG" 2>/dev/null; then
    healthy=true
    break
  fi
  sleep "$DEV_HEALTH_INTERVAL"
  waited=$((waited + DEV_HEALTH_INTERVAL))
done

# Match dev-server processes by actual working directory (/proc/<pid>/cwd)
# rather than by cmdline substring: `next dev`/`next-server` command lines do
# not reliably include the worktree path, but every process spawned via
# `(cd "$WT" && nohup pnpm dev ...)` keeps that exact cwd.
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

if [ "$healthy" != true ]; then
  err "dev server health check failed within ${DEV_HEALTH_TIMEOUT}s"
  err "--- tail of $DEV_LOG ---"
  tail -n 40 "$DEV_LOG" >&2 2>/dev/null || true
  kill_dev_pids
  # dev log is kept on failure for diagnosis
  exit 13
fi

log "dev server responded healthy"

# --- step 13: success cleanup -----------------------------------------------

kill_dev_pids
rm -f "$DEV_LOG"

log "worktree provisioned successfully: $WT"
log "next step: cd \"$WT\" && pnpm dev"

exit 0
