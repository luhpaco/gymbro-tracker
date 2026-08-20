## Exploration: tape-wrap-tag-sibling

### Current State
`TornStrip` already implements the intended paint/content split: a clipped, aria-hidden paint `<span>` is a sibling of an unclipped padded content `<div>`. However, its `children` are rendered wholesale inside that padded div. Both existing `TornStrip.Tag` instances therefore position from the content layer rather than from the `torn-strip-root` container, despite the original design specifying the tag after the content div as a sibling.

The root is `relative isolate` and has no clipping rule, while the torn `clip-path` is restricted to the aria-hidden paint span. Moving a tag to a root-level sibling therefore gives its existing `absolute -top-2 -right-2` classes the intended real corner overhang without changing the public component API, tag semantics, paint layer, or content padding.

### Affected Areas
- `src/components/ui/torn-strip.tsx` — partition direct `TornStrip.Tag` children from ordinary content, then render them after the padded content div.
- `src/components/workout/SummaryWorkout.tsx` — its ghost-row class currently uses `[&>span]:bg-transparent`; after `Tag` becomes a direct span sibling, this would also clear the pending tag background. Narrow the selector to the paint span only.
- `src/components/workout/AddExerciseForm.tsx` — no source change is necessary; its direct `SERIE n` tag will acquire the intended overhang and requires visual regression validation.
- `openspec/specs/visual-design-system/spec.md` — no delta requirement is required: this restores the already-documented two-layer design contract rather than changing product behavior.

### Approaches
1. **Partition direct compound tags inside `TornStrip`** — use React child inspection to render direct `TornStrip.Tag` elements after the content sibling, leaving all other direct children in the content div.
   - Pros: Preserves the existing JSX API and current consumer markup; limits implementation to the primitive plus the ghost selector safeguard; restores the original documented DOM arrangement.
   - Cons: A tag nested in a Fragment or wrapper will remain content-layered; direct-child composition must be treated as the supported pattern.
   - Effort: Low

2. **Add an explicit tag slot prop or separate subcomponent channel** — introduce a `tag` prop or restructure callers around a named slot.
   - Pros: Makes the ownership and placement contract explicit for arbitrary nesting.
   - Cons: Changes the public API and every current consumer for a presentation-only housekeeping correction; disproportionate to the confirmed scope.
   - Effort: Medium

### Recommendation
Use direct-child partitioning in `TornStrip` and adjust only the ghost paint selector in `SummaryWorkout`. The two existing consumers already provide `TornStrip.Tag` directly, so this is the smallest alignment that recreates the original two-layer structure. Keep the tag as a normal textual span; do not add `aria-hidden`, change labels, alter layout reservations, or modify `AddExerciseForm` markup.

### Risks
- The `SummaryWorkout` ghost selector will make the `pending` tag transparent if it remains broad after the tag becomes a direct root span; target the paint layer specifically.
- Direct child inspection does not extract a tag wrapped in a Fragment or another element. The implementation should preserve all non-direct tags as normal content and document/validate the direct-child compound pattern used by current consumers.
- The sibling order moves tag text after the content in DOM reading order, matching the original design. Verify that form labels, set values, and the `pending` state remain understandable with a screen reader and visually at desktop/mobile widths.

### Ready for Proposal
Yes — propose a presentation-only, two-file code change (`torn-strip.tsx` and `SummaryWorkout.tsx`) with manual visual/accessibility checks plus `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build`. The expected diff is well below the 800-line review budget and does not require a chained delivery decision.
