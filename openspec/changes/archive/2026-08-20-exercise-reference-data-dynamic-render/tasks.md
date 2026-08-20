# Tasks: Request-Time Delivery of Muscle-Group Reference Data

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | ~3 (1 import line + 1 `await connection()` statement, plus re-indent of existing `try` body) |
| 400-line budget risk | Low |
| Chained PRs recommended | No |
| Suggested split | Single PR |
| Delivery strategy | ask-on-risk |
| Chain strategy | pending |

Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: pending
400-line budget risk: Low

### Suggested Work Units

| Unit | Goal | Likely PR | Focused test command | Runtime harness | Rollback boundary |
|------|------|-----------|----------------------|-----------------|-------------------|
| 1 | Force request-time execution of `getMuscleGroups()` | PR 1 | `pnpm build` (read route table for `/exercises/create`) | `pnpm dev` → visit `/exercises/create`, confirm 14 muscle groups render | Revert the single commit touching `src/actions/muscle/get-muscle-groups.ts` |

## Phase 1: Core Implementation

- [x] 1.1 In `src/actions/muscle/get-muscle-groups.ts`, add `import { connection } from "next/server";` below the existing `import prisma from "@/lib/prisma";` line.
- [x] 1.2 In the same file, insert `await connection();` as the first statement of `getMuscleGroups()`, **before and outside** the existing `try { ... } catch (error) { ... }` block — do not place it inside `try`.
- [x] 1.3 Self-check the diff: confirm `await connection()` appears above the `try` keyword, at the same indentation level as `try`, not nested inside it. This ordering is load-bearing per design (`catch (error) { console.error(error); return []; }` would otherwise swallow the `DynamicServerError` Next.js throws on the legacy prerender path).
- [x] 1.4 Confirm no other files require changes: `src/actions/index.ts` still re-exports `getMuscleGroups` by name, and `src/app/(routes)/exercises/create/page.tsx` still awaits `Promise<MuscleGroup[]>` unchanged.

## Phase 2: Verification

- [x] 2.1 Run `pnpm exec tsc --noEmit` and `pnpm lint`; both must pass with zero errors.
- [x] 2.2 Run `pnpm build` and read the printed route table's legend line for `/exercises/create` specifically — do not rely on the process exit code, which is 0 either way. Pass = the row is prefixed `ƒ (Dynamic)  server-rendered on demand`. Fail = the row is prefixed `○ (Static)  prerendered as static content` (the pre-fix state); `●` is unrelated (SSG via `generateStaticParams`, never applicable here).
- [x] 2.3 Manually verify: `pnpm dev`, navigate to `/exercises/create`, confirm the muscle-group `<Select>` lists all 14 rows from the database. Done by orchestrator via `agent-browser` (user's explicit choice): registered a disposable account (`sdd-verify-20260820@example.invalid`), logged in, opened the combobox on `/exercises/create` — all 14 canonical rows rendered (Pecho, Espalda, Hombros, Bíceps, Tríceps, Piernas, Glúteos, Abdominales, Trapecio, Antebrazo, Gemelos, Isquiotibiales, Cuádriceps, Deltoides). Local `pnpm dev` connected to the shared Supabase DB (no local Docker Postgres available in this environment). Dev server stopped after verification.

## Key Learnings

1. `await connection()` must sit outside the existing try/catch to avoid the catch swallowing the internal `DynamicServerError` Next.js throws on the legacy prerender path.
2. `pnpm build` exit code is 0 regardless of static or dynamic classification, so verification must read the printed route table legend for the specific route.
3. A single-file, ~3-line diff stays well under the 400-line review budget, so no chained PRs or delivery-strategy decision is needed before apply.
4. `next/server` re-exports `connection` in the installed Next 15.5.23, avoiding a deep internal import from `next/dist/server/request/connection`.
5. No caller-side files require changes because the freshness guarantee lives entirely in the data-layer action, not the page.
