# Design: Vercel Prisma Deploy Fix

## Technical Approach

Make the repository build script the single generation boundary required by the proposal and the Build and Deployment Reliability specification. Change `pnpm build` to execute `prisma generate && next build`, pin `prisma` and `@prisma/client` to exact `5.18.0`, and regenerate only the Prisma-related lockfile entries. This preserves application behavior and adds no Node.js, Vercel configuration, route, authentication, or Prisma schema changes.

## Architecture Decisions

| Option | Tradeoff | Decision |
|---|---|---|
| Inline `prisma generate && next build` in `scripts.build` | Adds generation time to every production build, but makes ordering and failure propagation explicit in the command Vercel must invoke. | **Selected** because it is the smallest cache-independent implementation of the specified build contract. |
| `postinstall` or `prebuild` generation | Valid alternatives, but generation becomes less visible or depends on a separate lifecycle hook. | **Rejected** because the requirement targets the standard build command directly. |
| Exact `prisma` and `@prisma/client` `5.18.0` pins | Requires deliberate future upgrades, but prevents CLI/client drift. | **Selected** because the current install is demonstrably split between CLI `5.18.0` and client `5.16.1`. |
| Repository `vercel.json` or application-code changes | Could encode platform behavior or work around build collection, but expands ownership and scope. | **Rejected** because Vercel settings and application behavior are explicitly out of scope. |

## Data Flow

```text
Vercel or local operator
        |
        v
    pnpm build
        |
        v
 prisma generate --failure--> stop with non-zero status
        |
      success
        v
    next build
        |
        v
 deployment artifact
```

The `&&` boundary guarantees that Next.js cannot start after a failed Prisma Client generation.

## File Changes

| File | Action | Description |
|---|---|---|
| `package.json` | Modify | Set `build` to `prisma generate && next build`; set both Prisma packages to exact `5.18.0`. |
| `pnpm-lock.yaml` | Modify | Align importer specifiers/resolutions and the client package snapshot to `5.18.0`; retain matching Prisma engine entries and reject unrelated dependency churn. |

## Interfaces / Contracts

```json
{
  "scripts": { "build": "prisma generate && next build" },
  "dependencies": { "@prisma/client": "5.18.0" },
  "devDependencies": { "prisma": "5.18.0" }
}
```

No runtime API, data model, route, or authentication contract changes.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static | Exact manifest and lockfile alignment | Inspect the focused diff; run `pnpm install --frozen-lockfile` and `pnpm exec prisma version`, requiring both packages to report `5.18.0`. |
| Local build | Generation ordering and production build | Run `pnpm build`; verify Prisma generation succeeds before Next.js output. Run `pnpm lint` and `pnpm exec tsc --noEmit` as existing quality gates. |
| Failure contract | Next.js is skipped when generation fails | Verify the committed `&&` chain and capture a controlled negative smoke check during implementation; no automated test runner exists. |
| External acceptance | Preview and production deployment behavior | Redeploy the same accepted commit to both environments; inspect logs for `pnpm build`, successful Prisma generation before Next.js, and successful deployment completion. |

A manual Vercel Build Command that bypasses `pnpm build` is an acceptance blocker even if another command deploys successfully. Identify the bypassing environment and correct the project-level setting outside this repository before re-evaluation.

## Threat Matrix

The matrix is reviewed because a package shell command changes; none of its specialized execution boundaries apply.

| Boundary | Applicability | Design response | Planned RED tests |
|---|---|---|---|
| Documentation-like paths | N/A — no executable-file classification or path dispatch | None | None |
| Git repository selection | N/A — no Git command or cwd selection | None | None |
| Commit state | N/A — no commit automation | None | None |
| Push state | N/A — no push automation | None | None |
| PR commands | N/A — no PR command composition | None | None |

## Migration / Rollout

No data migration required. Commit `package.json` and `pnpm-lock.yaml` together, validate locally, then redeploy preview followed by production. Roll back both files together and redeploy the last known-good commit if generation or build regresses.

## Open Questions

None.
