## Exploration: Vercel Prisma Deploy Fix

### Current State
`package.json` runs `next build` without generating Prisma Client and defines no `postinstall` hook. The lockfile installs `prisma@5.18.0` but `@prisma/client@5.16.1`; `pnpm exec prisma version` confirms the mismatch. Next loads the `/api/seed` route during build collection, and that route imports the application-wide Prisma singleton, so a cached or ungenerated client fails the Vercel build before deployment. There is no repository Vercel configuration or custom build configuration. The default package `build` script therefore applies to both preview and production deployments.

### Affected Areas
- `package.json` — define a cache-independent Prisma Client generation step and pin the Prisma package pair.
- `pnpm-lock.yaml` — record the aligned, exact Prisma package resolution.
- `src/lib/prisma.ts` — consumes the generated client; no change is required.
- `src/app/api/seed/route.ts` — imports the singleton and exposes the failure during Next build collection; no change is required.

### Approaches
1. **Generate in the build script and pin the package pair** — change `build` to run `prisma generate && next build`, set both `prisma` and `@prisma/client` to exact `5.18.0`, then refresh the lockfile.
   - Pros: Generation is guaranteed for every default Vercel build, including previews and production; directly addresses dependency-cache reuse; keeps the current installed CLI version; has no application-code or platform-config change.
   - Cons: A custom Vercel build command that bypasses `pnpm build` would bypass the guarantee.
   - Effort: Low

2. **Use a postinstall hook and pin the package pair** — add `postinstall: prisma generate`, set both packages to exact `5.18.0`, then refresh the lockfile.
   - Pros: Matches Prisma's installation-lifecycle recommendation and also helps local installs.
   - Cons: Generation is coupled to install lifecycle behavior rather than the actual build command; it is less explicit for the acceptance criterion of every deploy.
   - Effort: Low

3. **Add a prebuild hook and pin the package pair** — add `prebuild: prisma generate`, preserve `build: next build`, set both packages to exact `5.18.0`, then refresh the lockfile.
   - Pros: Uses standard package-script lifecycle ordering and preserves the existing build command text.
   - Cons: Relies on Vercel invoking `pnpm build`, not a direct `next build` override; less self-evident in deployment logs than an explicit build chain.
   - Effort: Low

### Recommendation
Use approach 1. It is the smallest change that makes generation part of the actual build contract, so Vercel's dependency cache cannot skip it. Align to the already resolved `5.18.0` release and remove the CLI caret so `prisma` and `@prisma/client` remain in lockstep across future preview and production installs. Do not change Node, Prisma schema, route code, or Vercel configuration in this change.

### Risks
- A Vercel project-level Build Command that bypasses `pnpm build` would need manual confirmation; no repository configuration can override it.
- The successful redeploy is an external acceptance check and cannot be proven by local static validation alone.
- Regenerating the lockfile may update Prisma engine package entries, so implementation should review the resulting lockfile diff before committing.

### Ready for Proposal
Yes — propose a small deployment reliability fix: explicit Prisma Client generation before the default build, exact Prisma `5.18.0` package alignment, lockfile refresh, and Vercel preview/production redeploy verification. Node 24 remains an out-of-scope Vercel setting.
