# Delta for Worktree Provisioning

## MODIFIED Requirements

### Requirement: Runtime Detection and Port Guard

The script MUST detect an available `podman` or `docker` with `compose`. Instead of refusing on a bound default port, the script MUST scan for the first free host port for Postgres in the range 5433–5443 and for the dev server in the range 3001–3011, scanning upward from the start of each range with a bounded number of attempts. The script MUST persist the assigned pair in a worktree-local, gitignored `.worktree-port` file and MUST reuse those exact values on re-provision rather than re-scanning, preserving idempotency for a worktree whose own stack already holds its assigned port (generalized from the prior literal-5432 check). If no free port is found within a scanned range, the script MUST fail hard and MUST report the exact scanned range in the error message, with no fallback to the old refuse-with-message guard. The main checkout's default behavior (host port `5432` for Postgres, `3000` for the dev server) MUST remain unchanged, and running the script against the main checkout MUST NOT create or read a `.worktree-port` file.
(Previously: MUST detect whether port 5432 is already bound, refusing with an actionable message rather than auto-assigning another port.)

#### Scenario: Compose starts on the resolved port

- GIVEN a detected runtime and a resolved host port (literal `5432` for the main checkout, or the assigned value from `.worktree-port` for a worktree)
- WHEN infrastructure starts
- THEN `compose up -d` runs against that resolved port

#### Scenario: Fresh worktree scans and assigns ports

- GIVEN a new worktree with no `.worktree-port` file and ports 5433 and 3001 are free
- WHEN provisioning runs
- THEN the script assigns Postgres port 5433 and dev-server port 3001
- AND persists both values to a gitignored `.worktree-port` file in the worktree

#### Scenario: Scan skips occupied ports within range

- GIVEN 5433 is already bound by another worktree's stack and 5434 is free
- WHEN the Postgres port scan runs
- THEN the script assigns 5434 and persists it

#### Scenario: Re-provision reuses persisted ports

- GIVEN a worktree already has a `.worktree-port` file from a prior successful provision
- WHEN the script re-runs
- THEN it reads and reuses the exact persisted port pair without re-scanning
- AND it tolerates its own stack already holding that assigned port, without treating that as a collision

#### Scenario: Exhausted range fails hard with the scanned range reported

- GIVEN every port in 5433–5443 (or 3001–3011) is already bound
- WHEN the scan completes its bounded attempts
- THEN the script exits non-zero
- AND the error message states the exact range that was scanned
- AND no fallback to the old refuse-with-message guard occurs

#### Scenario: Main checkout keeps literal defaults

- GIVEN the script (or its port-assignment logic) is invoked against the main checkout
- WHEN it resolves ports
- THEN it resolves to literal Postgres port `5432` and dev-server port `3000`
- AND no `.worktree-port` file is created or read

### Requirement: Per-Worktree Env Rewrite

After the manifest copy step, the script MUST rewrite the worktree's copied `.env` to reflect its assigned Postgres port: `POSTGRES_HOST_PORT` MUST be set to the assigned port, and the port segment embedded in `POSTGRES_URL` MUST match it. The `POSTGRES_URL` port-segment rewrite MUST additionally apply to every other copied `.env*` file (e.g. `.env.local`) in the manifest that also contains a `POSTGRES_URL=` line, since Next.js resolves `.env.local` ahead of `.env`; `POSTGRES_HOST_PORT` itself is only ever set in `.env`, since that is the file the container runtime reads. This rewrite MUST apply only inside the worktree's own copied files and MUST NOT modify any file in the main checkout.

#### Scenario: Worktree env reflects assigned port

- GIVEN a worktree assigned Postgres port 5435
- WHEN the `.env` rewrite step runs
- THEN the copied `.env`'s `POSTGRES_HOST_PORT` is `5435`
- AND the port segment in `POSTGRES_URL` is also `5435`

#### Scenario: .env.local also gets its POSTGRES_URL port rewritten

- GIVEN a worktree assigned Postgres port 5435 and a copied `.env.local` that also contains a `POSTGRES_URL=` line
- WHEN the env rewrite step runs
- THEN the port segment in `.env.local`'s `POSTGRES_URL` is also `5435`
- AND `.env.local` gains no `POSTGRES_HOST_PORT` line

#### Scenario: Main checkout env untouched

- GIVEN the main checkout's own `.env` and `.env.local`
- WHEN provisioning logic runs elsewhere
- THEN neither file in the main checkout is ever modified by this rewrite step

### Requirement: Dev Server Health Check Defines Success

The script MUST verify HTTP 200 or a "Ready" log line within a bounded timeout against the worktree's assigned dev-server port (read from `.worktree-port`), not a hardcoded `3000`, and MUST exit non-zero if this check fails for any reason, including the pre-existing `tailwind.config.ts` CJS/ESM bug. A reported success MUST always correspond to a genuinely healthy, responding dev server on the assigned port. The dev-server port MUST be passed to the `pnpm dev`/`next dev` process as a real process environment variable, never via `.env`, since Next.js reads `PORT` only from the real process environment. The `package.json` `dev` script MUST NOT be modified to accommodate this.
(Previously: MUST verify HTTP 200 or a "Ready" log line within a bounded timeout, and MUST exit non-zero if this check fails for any reason, including the pre-existing `tailwind.config.ts` CJS/ESM bug. A reported success MUST always correspond to a genuinely healthy, responding dev server.)

#### Scenario: Healthy server on assigned port

- GIVEN the worktree's dev server responds on its assigned port (e.g. 3002) within the timeout
- WHEN the check completes
- THEN the script exits zero and reports success

#### Scenario: Health check fails

- GIVEN the dev server never responds on its assigned port within the timeout, for any reason
- WHEN the check completes
- THEN the script exits non-zero and MUST NOT report success

#### Scenario: Port passed as real process env, not via .env

- GIVEN a worktree assigned dev-server port 3002
- WHEN the script launches `pnpm dev`/`next dev` for the health check
- THEN `PORT=3002` is set in the real process environment of that invocation
- AND `.env` is not used to carry the dev-server port
- AND `package.json`'s `dev` script remains unmodified
