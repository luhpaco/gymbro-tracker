# Design: Request-Time Delivery of Muscle-Group Reference Data

## Technical Approach

Add `await connection()` to `getMuscleGroups()`, **before and outside** the existing `try` block, so the request-time-freshness guarantee lives in the data layer (spec: *Request-Time Freshness for Global Reference Data*). No signature, caller, or export changes. One file, one import, one statement.

```ts
"use server";

import { connection } from "next/server";
import prisma from "@/lib/prisma";

export const getMuscleGroups = async () => {
	await connection();
	try {
		const muscleGroups = await prisma.muscleGroup.findMany();
		return muscleGroups;
	} catch (error) {
		console.error(error);
		return [];
	}
};
```

## Architecture Decisions

### Decision: `await connection()` sits outside the `try`, not inside it

**Choice**: First statement of the function body, above `try`.
**Alternatives considered**: Inside `try` (adjacent to the query it guards); page-level `export const dynamic = "force-dynamic"`.
**Rationale**: Verified in `node_modules/next/dist/server/request/connection.js`. This project has no PPR and no `cacheComponents` (`next.config.mjs` sets neither), so `next build` takes the `prerender-legacy` branch, which calls `throwToInterruptStaticGeneration()` — that function **throws** a `DynamicServerError` (`dynamic-rendering.js:239-247`). Inside the `try`, that framework control-flow signal would be caught by a `catch` written for Prisma failures, logged as a spurious error, and converted to `return []`.

Next sets `prerenderStore.revalidate = 0` *before* throwing, so a swallowed bailout **might** still be salvaged into a dynamic classification. The design deliberately refuses to depend on that: it is an undocumented internal that can shift between patch releases, and Next explicitly warns against catching this error (`nextjs.org/docs/messages/dynamic-server-error`). Correctness must not rest on a side effect set one line before a throw we swallow.

Two independent reasons reinforce the placement: `connection()` must gate *subsequent* code on a real request, so it must precede the query regardless; and if `cacheComponents` is ever enabled, the `prerender` branch returns a **hanging promise** instead of throwing (`connection.js:74-79`), where `try` placement is meaningless but explicit intent still reads correctly.

Page-level `force-dynamic` was rejected in the proposal: it puts the guarantee on the caller, so the next page calling `getMuscleGroups()` reintroduces the bug.

### Decision: import `connection` from `next/server`

**Choice**: `import { connection } from "next/server";`
**Alternatives considered**: `next/dist/server/request/connection` (deep internal); `unstable_noStore` from `next/cache`.
**Rationale**: Verified against installed **next 15.5.23** — `node_modules/next/server.d.ts:18` re-exports `connection`. `unstable_noStore` is deprecated in favour of `connection` in Next 15. Deep imports are unstable across releases.

### Decision: `"use server"` file is safe for a dynamic API

**Choice**: Leave the directive untouched.
**Rationale**: Called directly from `CreateExercisePage`, the function runs inline in render scope, so the work/work-unit async storage `connection()` reads is present. Invoked as a true Server Action, the store type is `'request'`, which resolves immediately (`connection.js:88-97`). Both call shapes are correct.

## Data Flow

    Request ──→ CreateExercisePage ──→ getMuscleGroups()
                                            │
                                    await connection()   ← bails out of static prerender
                                            │
                                    prisma.muscleGroup.findMany()
                                            │
                                    CreateExerciseForm (listMuscleGroups)

A sequence diagram adds nothing over this for a single linear call chain.

## File Changes

| File | Action | Description |
|------|--------|-------------|
| `src/actions/muscle/get-muscle-groups.ts` | Modify | Add `connection` import; `await connection()` before `try` |

**Confirmed unchanged** (read, not assumed): `src/actions/index.ts:7` re-exports the binding by name — unaffected. `src/app/(routes)/exercises/create/page.tsx:6` awaits the same `Promise<MuscleGroup[]>`. `CreateExerciseForm`'s `listMuscleGroups` prop type is untouched. Return type is inferred and both branches still yield `MuscleGroup[]`.

## Interfaces / Contracts

Unchanged: `getMuscleGroups(): Promise<MuscleGroup[]>`.

## Testing Strategy

No test runner exists (CLAUDE.md). Verification is build- and runtime-observation based.

| Layer | What to Test | Approach |
|-------|-------------|----------|
| Build | Route render mode | `pnpm build`; in the route table, `/exercises/create` must be prefixed `ƒ` and the legend must show `ƒ  (Dynamic)  server-rendered on demand` |
| Static | Types / lint | `pnpm exec tsc --noEmit` and `pnpm lint` pass |
| Manual | Populated selector | `/exercises/create` lists all 14 groups; create an exercise end-to-end |

**Correction to the proposal's symbol**: the pre-fix state is `○ (Static)`, not `●`. Verified in `next/dist/build/utils.js:676-696` — `●` means `(SSG)  prerendered as static HTML (uses generateStaticParams)`, which this route never had. The pass condition is the presence of `ƒ`; the fail condition is `○`.

## Threat Matrix

N/A — no shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. No route is added, removed, or redirected; only the render timing of an existing route changes.

## Migration / Rollout

No migration required. Stateless code change, effective on deploy. Rollback: revert the single commit.

## Open Questions

None.
