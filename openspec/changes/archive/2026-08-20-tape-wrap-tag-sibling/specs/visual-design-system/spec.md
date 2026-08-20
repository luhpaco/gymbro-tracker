# Spec Phase: Tape-Wrap Tag Sibling (No Capability Delta)

## Purpose

This file is the native OpenSpec phase marker for `tape-wrap-tag-sibling`. The change restores the existing `visual-design-system` presentation contract; it introduces no capability and changes no requirement. The authoritative totals are **0 requirements** and **0 scenarios**.

## Delta Declaration

| Delta section | Disposition |
| --- | --- |
| ADDED Requirements | None |
| MODIFIED Requirements | None |
| REMOVED Requirements | None |
| RENAMED Requirements | None |

`openspec/specs/visual-design-system/spec.md` remains unchanged. Archival of this marker MUST be a requirement-level no-op.

## Verification Contract

These Given/When/Then checks define regression evidence only; they do not add product requirements or scenarios.

| Area | GIVEN | WHEN | THEN |
| --- | --- | --- | --- |
| Direct tag | A `TornStrip.Tag` is a direct `TornStrip` child beside ordinary content | The surface is rendered and its structure inspected | The tag MUST follow the padded content as a root-level sibling, MUST overhang the root corner, and ordinary content MUST remain padded and unclipped. |
| Wrapped tag edge | A tag is nested in a Fragment or wrapper | The surface is rendered | The nested tag MUST remain in the content layer; only direct tags are extracted. |
| Ghost selector | A pending `SummaryWorkout` ghost row renders its paint span and tag | Transparency rules are inspected and the row is viewed | Only the aria-hidden paint span MUST become transparent; the pending tag background and text MUST remain visible. |
| Accessibility | A surface contains labels, values, and a textual tag | DOM order and the accessibility tree are inspected, then the flow is checked with a screen reader | The paint span MUST remain hidden, the tag MUST remain exposed as text, and labels, values, and pending state MUST remain understandable. |
| Visual regression | `AddExerciseForm` and normal/pending `SummaryWorkout` states are shown at desktop and mobile widths | Before/after screenshots are compared | The intended tag overhang MUST appear without regressions to torn clipping, content padding, text legibility, or layout reservation. |
| Scope and gates | The completed change is ready for verification | The diff and quality commands are checked | `AddExerciseForm` and non-presentation areas MUST remain unchanged; `pnpm lint`, `pnpm exec tsc --noEmit`, and `pnpm build` MUST pass. |

## Out of Scope

- Public API, consumer markup, tag copy, semantics, or layout-reservation changes.
- Extraction of tags nested in Fragments or wrappers.
- New or modified product requirements.
