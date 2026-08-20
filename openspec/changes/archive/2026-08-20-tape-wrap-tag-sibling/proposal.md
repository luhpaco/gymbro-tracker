# Proposal: Align TornStrip Tag as a Content Sibling

## Intent

Restore the documented two-layer TornStrip structure so direct compound tags can overhang the torn surface corner. Tags currently render inside the padded content layer, preventing their existing absolute positioning from anchoring to the unclipped root.

## Scope

### In Scope
- Partition direct `TornStrip.Tag` children from ordinary content.
- Render extracted tags after the padded content div as root-level siblings.
- Narrow the SummaryWorkout ghost selector to transparent only the paint span.

### Out of Scope
- Public API, consumer markup, tag labels, semantics, or layout reservations.
- Extracting tags nested in Fragments or wrapper elements.
- Changes to AddExerciseForm source, data, routes, server actions, or styles outside the real overhang.

## Capabilities

### New Capabilities
None — this is a presentation-contract restoration, not a product capability.

### Modified Capabilities
None — `visual-design-system` already documents the two-layer TornStrip contract; no behavioral delta spec is required.

## Approach

Use React child inspection in `TornStrip` to split only direct `TornStrip.Tag` elements from ordinary children. Keep non-tag and nested-tag content in the padded layer; render extracted tags as subsequent root siblings. In `SummaryWorkout`, replace the broad direct-span transparency selector with one that targets only the aria-hidden paint span. Preserve the tag as textual content and the current paint/content layers.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/ui/torn-strip.tsx` | Modified | Partition direct tags and render them beside content. |
| `src/components/workout/SummaryWorkout.tsx` | Modified | Limit ghost transparency to the paint layer. |
| `src/components/workout/AddExerciseForm.tsx` | Validated | Confirm the direct set tag gains the intended overhang. |
| `openspec/specs/visual-design-system/spec.md` | Unchanged | Existing contract remains authoritative. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Ghost tag loses background | Low | Target only the paint span selector. |
| Wrapped tags remain content-layered | Medium | Support and validate direct-child composition only. |
| Changed DOM order affects reading flow | Low | Manually check labels, values, and pending state with a screen reader. |

## Rollback Plan

Revert the two component changes; tags return to the padded content layer and the ghost selector returns to its prior behavior. No data migration or API rollback is needed.

## Dependencies

- Existing direct `TornStrip.Tag` composition in current consumers.

## Success Criteria

- [ ] Direct tags overhang the root corner while ordinary content remains padded and unclipped.
- [ ] Ghost rows keep pending tag backgrounds while paint remains transparent.
- [ ] Desktop/mobile visual and accessibility checks pass; `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` pass.
