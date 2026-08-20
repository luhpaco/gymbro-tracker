# Design: Direct TornStrip Tag Sibling Alignment

## Technical Approach

Implement the proposal and the zero-delta `visual-design-system` verification contract as a two-file presentation correction. `TornStrip` will inspect only its immediate React child sequence, partition exact `TornStrip.Tag` elements from all remaining children, keep remaining children in the existing padded content div, and emit extracted tags after that div. `SummaryWorkout` will narrow ghost transparency from every direct span to the aria-hidden paint span. No consumer markup, public props, semantics, layout reservation, or data flow changes.

## Architecture Decisions

### React detection

| Option | Tradeoff | Decision |
|---|---|---|
| `React.isValidElement(child) && child.type === TornStripTag` during `React.Children.forEach` | Uses exact component identity; arrays participate in React's child traversal, but element children and Fragments are not traversed | **Chosen** |
| Match `displayName`, props, or DOM tag name | Spoofable or requires an API marker | Rejected |
| Recursively unwrap Fragments/wrappers | Expands scope and creates surprising ownership rules | Rejected |

The predicate remains module-local. It does not clone elements, inspect descendants, or add a test-only export. Wrapped, Fragment-contained, memoized, or otherwise non-identical elements remain ordinary content.

### DOM and accessibility order

| Option | Tradeoff | Decision |
|---|---|---|
| Paint span → padded content div → extracted tags | Restores the documented structure and places tag text after content in DOM/accessibility order | **Chosen** |
| Keep tags inside or before content | Preserves prior reading order but cannot satisfy the sibling contract | Rejected |
| Hide tags from accessibility APIs | Avoids order impact but removes meaningful textual state | Rejected |

Relative order is preserved within both partitions. The paint span remains `aria-hidden`; tags remain exposed textual spans. No ARIA remapping is introduced to disguise the required DOM move.

### Ghost selector

| Option | Tradeoff | Decision |
|---|---|---|
| `[&>span[aria-hidden]]:bg-transparent` | Selects the existing direct paint span by its semantic paint marker | **Chosen** |
| `[&>span]:bg-transparent` | Also clears extracted tag backgrounds | Rejected |
| Add a new paint prop or class contract | Unnecessary API/selector surface | Rejected |

### Testability and reversal

| Option | Tradeoff | Decision |
|---|---|---|
| Deterministic module-local predicate plus one-pass partition | Reviewable, future component-testable, and no production API growth | **Chosen** |
| Add a test runner or test-only export | Disproportionate to this correction | Rejected |
| Feature flag | Adds permanent branching for a two-file visual fix | Rejected |

Rollback is a direct revert of both component edits: child rendering returns wholesale to the padded div and the ghost selector returns to its previous breadth. No migration or compatibility shim is needed.

## Data Flow

```text
children ──React.Children.forEach──► direct exact Tag? ──yes──► tag bucket
                                      │
                                      no
                                      ▼
                                 content bucket

root ──► aria-hidden paint ──► padded content bucket ──► tag bucket
```

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/ui/torn-strip.tsx` | Modify | Partition exact direct compound tags and render them after padded content. |
| `src/components/workout/SummaryWorkout.tsx` | Modify | Scope ghost transparency to the direct aria-hidden paint span. |

`src/components/workout/AddExerciseForm.tsx` is validation-only and MUST remain unchanged.

## Interfaces / Contracts

`TornStripProps`, the compound `TornStrip.Tag` API, forwarded ref, root props, classes, and consumer JSX remain unchanged. The internal contract is: exact direct tag elements are extracted; every other `ReactNode` remains content-layered. Multiple direct tags are allowed and retain declaration order, with no new collision-management behavior.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Structural | Direct tags follow padded content; ordinary and wrapped/Fragment tags remain inside it | DOM inspection of current consumers plus a temporary uncommitted wrapper probe; final diff contains no fixture |
| Visual | Overhang, clipping, padding, pending background, text legibility | Desktop/mobile screenshots of `AddExerciseForm` and normal/pending `SummaryWorkout` |
| Accessibility | Paint hidden; tag text, labels, values, and pending state understandable in new order | Accessibility-tree inspection and screen-reader pass |
| Static/build | Types, lint, RSC/client build | `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` |

No automated test layer exists, so this change does not introduce test infrastructure.

## Threat Matrix

N/A — no routing, shell, subprocess, VCS/PR automation, executable-file classification, or process-integration boundary.

## Migration / Rollout

No migration or feature flag. Ship both source edits atomically so sibling extraction cannot land without the narrowed ghost selector.

## Open Questions

None.
