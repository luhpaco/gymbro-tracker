# Design: Athletic Tape & Wrap Design System

## Technical Approach

Foundation (tokens, fonts, Tailwind families) is committed. This change adds **one paint primitive** (`TornStrip`), **one interaction primitive** (`EditableStat`), **one layout mechanism** (reserved-slot region), then migrates every hand-rolled card site onto them. Everything is presentation-layer: JSX/className/CSS plus one Zustand mutator. No Prisma, no route, no Radix structural change.

Build order: `globals.css` component layer → `TornStrip` → `ResumeCard` becomes a thin adapter (zero consumer churn) → per-route slices → `EditableStat` + fixed-region → Header/Sidebar → delete `ResumeCard`.

## Architecture Decisions

### Decision: New `ui/torn-strip.tsx`, not shadcn `card.tsx`

| Option | Tradeoff | Verdict |
|---|---|---|
| Add stock shadcn `card.tsx`, then override | Inherits `rounded-lg shadow-sm` API we immediately fight; two layers of abstraction | Rejected |
| Extend existing `card.tsx` | **No `card.tsx` exists** in `src/components/ui/` (13 primitives, none is a card) | Impossible |
| New CVA sibling `torn-strip.tsx` | Matches `button.tsx` conventions (`cva` + `cn`); owns its own API | **Chosen** |

### Decision: Two-layer paint/content split (solves variable height AND clipping)

`clip-path` clips **all** descendants — focus rings, `box-shadow`, overhanging tags. A single clipped `<div>` breaks the corner set-tag and a11y focus visibility. Structure instead:

```tsx
<Tag className="relative isolate" style={{ "--strip-rot": rot }}>
  <span aria-hidden className="torn-strip absolute inset-0 -z-10" />  {/* clipped paint */}
  <div className="relative p-6">{children}</div>                       {/* unclipped */}
  {tag && <TornStrip.Tag ... />}                                       {/* may overhang */}
</Tag>
```

`absolute inset-0` makes the paint layer track content height exactly — no fixed size, works at any height.

### Decision: Tear amplitude in `px`, tooth positions in `%`

`polygon()` accepts mixed units. X in `%`, Y in `px` via `--tear` means a 600px-tall strip and a 56px row have **identical** tooth depth; a pure-percentage polygon would stretch teeth into spikes on tall cards. Declared once in `globals.css`:

```css
@layer components {
  .torn-strip { --tear: 6px; clip-path: polygon(
      0 var(--tear), 7% 0, 14% calc(var(--tear)*.6), 23% 1px, /* … ~16 pts … */
      100% calc(100% - var(--tear)), 91% 100%, /* … */ );
    filter: drop-shadow(0 2px 0 hsl(var(--background))); }
  .torn-strip--b, .torn-strip--c { /* re-seeded polygons */ }
  .torn-strip--edge-bottom { /* straight top, torn bottom — Header/Sidebar */ }
}
```

`filter: drop-shadow` (not `box-shadow`) so the shadow follows the torn silhouette.

**Rejected**: SVG `mask-image` data-URI (asset-like, violates the "real CSS" risk mitigation); `repeating-linear-gradient` teeth on a pseudo-element (perfectly periodic → reads machine-perforated, not hand-torn; also cannot cut the real corner). Keep the gradient approach documented as the fallback if `clip-path` focus-ring clipping ever regresses.

### Decision: Variance is deterministic, never random

`Math.random()` for rotation/tear-seed produces **SSR/CSR hydration mismatch** and non-reproducible screenshots. `seed?: string | number` prop → stable hash → `variant ∈ {a,b,c}` and `--strip-rot ∈ {-0.6deg, 0.35deg, -0.25deg, 0.5deg}`. Callers pass `workout.id` / list index. Rotation capped at 0.6deg and the region gets `overflow-x-clip`; dense rows use `flat` (rotation off).

### Decision: `ResumeCard` becomes an adapter before it is deleted

Slice 1 rewrites `ResumeCard.tsx` internals to render `TornStrip` while keeping the exact `Header/Body/Link` compound API. Its six consumers (dashboard ×2, `ExerciseSection`, `WorkoutsSection`, login, register) change **zero lines**, so the whole app re-skins in one small diff. Route slices then swap to `TornStrip` directly; the final slice deletes `ResumeCard.tsx`. Big-bang rename first was rejected: it inflates every slice's diff against the 800-line budget.

### Decision: Heading base rule must drop `font-bold`

`globals.css` currently does `h1..h6 { @apply font-bold }`. Anton ships a single 400 weight, so `font-bold` triggers **synthetic faux-bold** (smeared strokes). Replace with `@apply font-display uppercase tracking-wide`.

### Decision: Marker face is scoped to a `Stat` element, never a global rule

Permanent Marker has no tabular figures, so numerals of differing widths jitter — directly hostile to the fixed-region requirement. Numerals render through `<Stat>` with a **reserved character box** (`w-[4ch] text-center tabular-nums`) rather than relying on `font-variant-numeric`. Scoping to a component also enforces risk-register mitigation #2 (marker never reaches body copy).

### Decision: Inline edit = tap-to-swap button↔input, same box

Display mode is a native `<button type="button">` (free Enter/Space + focus a11y) showing the numeral with a dashed "write here" underline. Single tap enters edit; `<input type="number" inputMode="numeric">` mounts into an **identically sized box**, autofocus + `select()` so one tap overwrites. Commit on `blur`/`Enter`; `Escape` cancels. Validation reuses the existing `setSchema` fields exported from `AddExerciseForm.tsx` — no new validation logic. Invalid → stay in edit, `aria-invalid`, red tape border, no commit.

**Rejected**: always-mounted inputs (mobile keyboard traps, every row looks like a form); pencil-icon affordance (extra tap target in a one-handed context, clutters dense rows); long-press (undiscoverable, fights native text selection).

```ts
interface EditableStatProps {
  value: number; label: string;          // label = a11y ("Peso, serie 2, Press banca")
  unit?: string; width?: "2ch"|"3ch"|"4ch";
  onCommit: (next: number) => void;
  validate?: (n: number) => string | null;
  disabled?: boolean;
}
```

### Decision: Fixed region = reserved slots + `contain`, not `min-height` guessing

Creation-summary set list becomes an `<ol>` (ordered semantics carry set order) inside a region with:

1. **Fixed row height** `h-14` on every `<li>` (`TornStrip flat`) — a hard height, not `min-h`.
2. **Reserved slots**: `rowsReserved = max(3, sets.length)`; empty slots render as dashed *ghost* strips with the `pending` tag. Adding a set **writes into an already-visible slot** instead of pushing content — the visual payoff of the mechanism, and the Zod `.max(5)` cap bounds it.
3. `[contain:layout_paint]` on the region so internal churn cannot relayout ancestors.
4. Numerals in reserved `ch` boxes (see `Stat`) so `5 → 100` kg cannot widen a row.
5. **No height transitions** — animating height *is* reflow. Opacity only.

### Decision: Inline edit needs `updateSet` in the Zustand store (unavoidable)

Creation-summary state lives in `workout-store.ts`, which exposes only `addExercise` / `removeExercise` / `resetExercises`. `addExercise` **appends**, so "edit" via remove+re-add reorders the list and breaks the fixed-region requirement. A minimal pure-reducer `updateSet(exerciseValue, setIndex, patch)` is the only way to satisfy the spec. This is client presentation state — no server, schema, or action impact — but it does contradict the proposal's literal "no Zustand change" exclusion. Documented, not hidden.

### Decision: Detail-view inline edit — **persistence is an open fork** (see Open Questions)

No `update-set`/`update-workout` server action exists. The design ships `WorkoutDetailSets.tsx` (client) rendering `EditableStat` with an injected `onCommit`; the page supplies it. Which `onCommit` is the fork.

## Data Flow

```
CREATION SUMMARY (client only, no server)
  EditableStat.onCommit ──► workoutStore.updateSet(exId, i, {weight|reps})
        │                              │
        └── optimistic re-render ◄─────┘ (row height fixed → no reflow)
                                        └──► SummaryWorkoutForm ──► createWorkout()  [unchanged]

DETAIL VIEW (RSC page)
  getWorkoutBySlug ──► <WorkoutDetailSets sets onCommit?> ──► EditableStat
                                                 │
                                    option A: updateSet action + revalidatePath
                                    option B: onCommit undefined → read-only
```

Inline-edit sequence:

```
User        EditableStat            Store/Action        Region
 │  tap ───────►│ setEditing(true), input mounts same box
 │  type ──────►│ (local state; box width fixed)
 │  Enter ─────►│ validate(setSchema)
 │              │──fail──► aria-invalid, stay editing, no commit
 │              │──ok────► onCommit(n) ──►│ updateSet / action
 │              │◄──────── new value ─────│──────────────► no layout shift
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/app/globals.css` | Modify | `@layer components` torn-strip polygons (`a/b/c`, `edge-bottom`); drop `font-bold` from heading rule → `font-display uppercase tracking-wide` |
| `src/components/ui/torn-strip.tsx` | Create | `TornStrip` + `.Header/.Body/.Link/.Tag`, CVA `tone`/`flat`/`seed` |
| `src/components/ui/stat.tsx` | Create | `Stat` — marker-face numeral in reserved `ch` box |
| `src/components/ui/editable-stat.tsx` | Create | Tap-to-edit numeral, same-box swap |
| `src/components/ResumeCard.tsx` | Modify → Delete | Adapter over `TornStrip` (slice 1); removed in final slice |
| `src/components/Header.tsx` | Modify | Drop `bg-white`, `border-gray-400`, `hover:bg-slate-300 hover:text-black`; `bg-background` + `torn-strip--edge-bottom`; wordmark `font-display uppercase` |
| `src/components/Sidebar.tsx` | Modify | Drop `bg-white dark:bg-gray-500`, `hover:bg-gray-100 dark:hover:bg-gray-800`; `bg-secondary` + `edge-bottom`; merge the two duplicate overlay `div`s into one `bg-black/60 backdrop-blur-sm`; active link = `border-l-2 border-primary` |
| `src/components/workout/SummaryWorkout.tsx` | Modify | `TornStrip` shell + reserved-slot `<ol>`; `EditableStat` per set; drop `bg-red-500` button → `text-destructive` |
| `src/components/workout/AddExerciseForm.tsx` | Modify | Set-count `span` → `Stat`; per-set block → `TornStrip` w/ `SERIE n` tag; export `setSchema` |
| `src/store/workout/workout-store.ts` | Modify | Add `updateSet(exerciseValue, setIndex, patch)` reducer |
| `src/app/(routes)/dashboard/page.tsx` | Modify | `ResumeCard` → `TornStrip`, `text-gray-400` → `text-muted-foreground` |
| `src/app/(routes)/exercises/{page,create/page,update/[id]/page}.tsx`, `components/{ExerciseSection,FilterExercises}.tsx` | Modify | Inline `border-gray-300 shadow-md rounded-md` divs → `TornStrip` |
| `src/app/(routes)/workouts/{page,create/page}.tsx`, `components/WorkoutsSection.tsx` | Modify | Same; workout cards get `seed={workout.id}` |
| `src/app/(routes)/workouts/[slug]/page.tsx` | Modify | shadcn `Table` → one `TornStrip` per exercise with `Stat` rows (mobile-first; a 4-col table is unusable one-handed) |
| `src/components/workout/WorkoutDetailSets.tsx` | Create | Client sets list w/ `EditableStat` + injected `onCommit` |
| `src/app/auth/{layout,login/page,register/page}.tsx` + `ui/{LoginForm,RegisterForm}.tsx` | Modify | Full-strength treatment: `TornStrip`, Anton wordmark, `text-muted-foreground` |
| `src/actions/workout/update-set.ts` | **Conditional** | Only if Open Question #1 resolves to A |

## Component Inventory (duplicated card sites → replacement)

| # | Site | Today | Replacement |
|---|---|---|---|
| 1 | `ResumeCard.tsx` | `border-gray-300 p-6 shadow-md rounded-md` | `TornStrip` (adapter, then deleted) |
| 2 | `SummaryWorkout.tsx` | `section` same classes | `TornStrip tone=charcoal` + reserved-slot `<ol>` |
| 3 | `AddExerciseForm.tsx` | `span border-gray-300 text-2xl` | `Stat` + per-set `TornStrip` |
| 4 | `workouts/create/page.tsx` | inline card div | `TornStrip` |
| 5 | `exercises/create/page.tsx` | inline card div | `TornStrip` |
| 6 | `exercises/update/[id]/page.tsx` | inline card div | `TornStrip` |
| 7 | `WorkoutsSection.tsx` | `ResumeCard` + `text-gray-400` | `TornStrip seed={id}` |
| 8 | `ExerciseSection.tsx` | `ResumeCard` | `TornStrip seed={index}` |
| 9 | `dashboard/page.tsx` | `ResumeCard` ×2 | `TornStrip` ×2 |
| 10 | `workouts/[slug]/page.tsx` | shadcn `Table` | `TornStrip` per exercise + `WorkoutDetailSets` |
| 11 | `auth/login`, `auth/register` | `ResumeCard` | `TornStrip` full strength |

## Testing Strategy

No test runner exists (`openspec/config.yaml` `strict_tdd: false`). Gates are:

| Layer | What | How |
|---|---|---|
| Type | Primitive props, `updateSet` reducer, `EditableStat` contract | `pnpm exec tsc --noEmit` |
| Lint | Hook rules, unused imports left by removed `dark:` markup | `pnpm lint` |
| Build | RSC/client boundary correctness (`WorkoutDetailSets`, `SummaryWorkout`) | `pnpm build` |
| Visual | Torn edge at min/max content height; tag not clipped; focus ring visible; numeral legibility at arm's length | Manual + screenshot per route slice |
| Layout | Add/edit/remove a set → nothing outside the region moves | Manual, DevTools *Layout Shift Regions* overlay |
| Boundary | `git diff --stat src/actions src/data prisma middleware.ts src/app/api` empty (modulo OQ#1) | Per-PR check |

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary. Presentation-layer only.

## Migration / Rollout

No data migration. Chained PRs by slice, each independently revertible: (1) CSS layer + `TornStrip` + `ResumeCard` adapter; (2) `Stat` + typography; (3) exercises routes; (4) workouts list/create + reserved-slot region; (5) `EditableStat` + store `updateSet`; (6) detail view; (7) auth; (8) Header/Sidebar + `ResumeCard` deletion. Slices 1 and 8 touch every screen and should ship first and last respectively.

## Open Questions

- [ ] **#1 (blocking for slice 6)** Detail-view inline edit persistence. **A** — add `src/actions/workout/update-set.ts` (Zod-validated, `revalidatePath`); satisfies the spec requirement fully but breaks the proposal's "no server-action change" boundary and success criterion 5. **B** — ship `EditableStat` in the detail view with `onCommit` unwired (read-only affordance) and defer persistence to a follow-up change; keeps the boundary but the requirement's scenario cannot pass. **Recommended: A**, as a single narrow, explicitly-acked exception — B ships a control that visibly lies. Needs the user's decision before slice 6.
- [ ] **#2** Anton's uppercase-only rhythm on long Spanish labels ("Crear nuevo entrenamiento") — confirm it does not wrap badly at 360px during slice 2; fall back to `normal-case` if it does.
- [ ] **#3** Whether the Sidebar active-route indicator (needs `usePathname`) is in scope or deferred — trivially presentational but adds a hook.
