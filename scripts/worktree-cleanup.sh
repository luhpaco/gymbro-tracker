#!/usr/bin/env bash
#
# worktree-cleanup.sh <path> [--force]
#
# Tears down the disposable infrastructure of a sibling git worktree:
# container stack, then CodeGraph index, then the worktree directory itself.
# Never deletes the associated git branch — the branch is work product,
# the worktree is disposable.
#
# Exit codes:
#   2  precondition guard failed (main checkout or unknown worktree)
#   3  worktree has uncommitted changes and --force was not given
#   4  container teardown failed

set -euo pipefail

log() { printf '[worktree-cleanup] %s\n' "$*"; }
warn() { printf '[worktree-cleanup] WARNING: %s\n' "$*" >&2; }
err() { printf '[worktree-cleanup] ERROR: %s\n' "$*" >&2; }

usage() {
  printf 'Usage: %s <path-to-worktree> [--force]\n' "$(basename "$0")" >&2
}

# --- arg parsing -------------------------------------------------------

TARGET_ARG=""
FORCE=false

for arg in "$@"; do
  case "$arg" in
    --force)
      FORCE=true
      ;;
    -*)
      err "unknown option: $arg"
      usage
      exit 2
      ;;
    *)
      if [ -n "$TARGET_ARG" ]; then
        err "unexpected extra argument: $arg"
        usage
        exit 2
      fi
      TARGET_ARG="$arg"
      ;;
  esac
done

if [ -z "$TARGET_ARG" ]; then
  usage
  exit 2
fi

if [ ! -d "$TARGET_ARG" ]; then
  err "path does not exist or is not a directory: $TARGET_ARG"
  exit 2
fi

WT="$(cd "$TARGET_ARG" && pwd)"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

WORKTREE_LIST="$(git -C "$SCRIPT_DIR" worktree list --porcelain)"

MAIN="$(printf '%s\n' "$WORKTREE_LIST" | awk '/^worktree /{print $2; exit}')"

if [ -z "$MAIN" ]; then
  err "could not determine the main git checkout"
  exit 2
fi

if ! printf '%s\n' "$WORKTREE_LIST" | awk '/^worktree /{print $2}' | grep -qxF "$WT"; then
  err "$WT is not a registered git worktree"
  exit 2
fi

if [ "$WT" = "$MAIN" ]; then
  err "refusing to run against the main checkout ($MAIN)"
  exit 2
fi

log "target worktree: $WT"

# --- dirty check ---------------------------------------------------------

STATUS_OUTPUT="$(git -C "$WT" status --porcelain)"

if [ -n "$STATUS_OUTPUT" ] && [ "$FORCE" != true ]; then
  err "worktree has uncommitted changes (staged, unstaged, or untracked); re-run with --force to discard them"
  printf '%s\n' "$STATUS_OUTPUT" >&2
  exit 3
fi

if [ -n "$STATUS_OUTPUT" ] && [ "$FORCE" = true ]; then
  warn "worktree has uncommitted changes; proceeding because --force was given"
fi

# --- detect container runtime ---------------------------------------------

RUNTIME=""
if command -v podman >/dev/null 2>&1 && podman compose version >/dev/null 2>&1; then
  RUNTIME="podman"
elif command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  RUNTIME="docker"
fi

# --- teardown order: compose down -> codegraph uninit -> worktree remove --

if [ -f "$WT/docker-compose.yml" ]; then
  if [ -z "$RUNTIME" ]; then
    err "docker-compose.yml exists but no compatible container runtime was detected; refusing to remove the worktree"
    exit 4
  fi

  log "tearing down container stack ($RUNTIME compose down)"
  if ! (cd "$WT" && "$RUNTIME" compose down); then
    err "$RUNTIME compose down failed"
    exit 4
  fi
else
  warn "no docker-compose.yml in worktree, skipping compose down"
fi

if [ -d "$WT/.codegraph" ]; then
  log "removing CodeGraph index"
  if ! codegraph uninit -f "$WT"; then
    warn "codegraph uninit failed, continuing"
  fi
else
  log "no CodeGraph index present, skipping"
fi

# `compose down` stops and removes containers but never deletes the bind-mounted
# Postgres data directory. Under rootless podman that directory's contents are
# owned by the container's mapped UID inside the user namespace, so a plain
# `rm -rf` (and therefore `git worktree remove`) cannot delete them and would
# otherwise fail with "Directory not empty". Remove it explicitly first,
# entering the podman user namespace when available.
if [ -d "$WT/postgres" ]; then
  log "removing container-owned Postgres data directory"
  if [ "$RUNTIME" = "podman" ] && command -v podman >/dev/null 2>&1; then
    podman unshare rm -rf "$WT/postgres" 2>/dev/null || rm -rf "$WT/postgres" 2>/dev/null || true
  else
    rm -rf "$WT/postgres" 2>/dev/null || true
  fi
  if [ -d "$WT/postgres" ]; then
    warn "could not fully remove $WT/postgres; 'git worktree remove' may fail below"
  fi
fi

log "removing worktree: $WT"
if [ "$FORCE" = true ]; then
  git -C "$MAIN" worktree remove --force "$WT"
else
  git -C "$MAIN" worktree remove "$WT"
fi

git -C "$MAIN" worktree prune

log "worktree removed. Branch was left intact (cleanup never deletes branches)."

exit 0
