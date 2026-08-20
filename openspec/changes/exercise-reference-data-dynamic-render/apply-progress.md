# Apply Progress: Request-Time Delivery of Muscle-Group Reference Data

## Status

4/5 tasks complete (Phase 1 fully done, Phase 2 automated gates done, one manual/visual task pending a user decision).

## Completed Tasks

- [x] 1.1–1.4 — `src/actions/muscle/get-muscle-groups.ts` updated: added `import { connection } from "next/server";` and `await connection();` as the first statement of `getMuscleGroups()`, before and outside the existing `try { ... } catch (error) { ... }` block. No other files required changes (confirmed `src/actions/index.ts` re-export and `src/app/(routes)/exercises/create/page.tsx` caller are unaffected).
- [x] 2.1 — `pnpm exec tsc --noEmit`: zero output, zero errors.
- [x] 2.2 — `pnpm lint`: zero errors. Only pre-existing warning present, unrelated to this change:
  `./src/app/auth/login/ui/LoginForm.tsx: 65:5  Warning: React Hook useEffect has missing dependencies...`
- [x] 2.2 (build) — `pnpm build` route table output (relevant line quoted verbatim):
  ```
  ├ ƒ /exercises/create                      245 B         228 kB
  ```
  Legend: `ƒ  (Dynamic)  server-rendered on demand`. This matches the pass condition exactly (`ƒ (Dynamic)`), not the fail condition (`○ (Static)`). Exit code was not relied upon per task instruction; the printed row prefix is the evidence.

  Note: the build log also shows `Error: Dynamic server usage: ... headers` for `/workouts/create` and `/exercises` during static-page generation — these are pre-existing, expected `auth()`/`headers()`-driven dynamic routes unrelated to this change, not new failures introduced by this diff.

## Pending Tasks

- [ ] 2.3 — Manual visual verification (`pnpm dev` → navigate to `/exercises/create` → confirm 14 muscle groups render in the `<Select>`). Per prior-session convention (never assume who performs visual/app-access checks), this is left pending a user decision on whether Claude or the user performs it.

## Diff Summary

`src/actions/muscle/get-muscle-groups.ts` (3 lines added):

```diff
 import prisma from "@/lib/prisma";
+import { connection } from "next/server";

 export const getMuscleGroups = async () => {
+	await connection();
+
 	try {
```

## Key Learnings

1. `await connection()` must sit outside the existing try/catch to avoid the catch swallowing the internal `DynamicServerError` Next.js throws on the legacy prerender path.
2. `pnpm build` exit code is 0 regardless of static or dynamic classification, so verification must read the printed route table legend for the specific route.
3. The build log's `Dynamic server usage: headers` errors for `/workouts/create` and `/exercises` are pre-existing and unrelated to this change; only the `/exercises/create` row's `ƒ`/`○` prefix is the relevant evidence.
4. `next/server` re-exports `connection` in the installed Next 15.5.23, confirming no deep internal import was needed.
5. No caller-side files required changes because the freshness guarantee lives entirely in the data-layer action, not the page, consistent with the design decision.
