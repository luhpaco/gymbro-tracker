# Dependency Maintenance Specification (No Functional Capability Delta)

## Purpose

No-delta confirmation for the dependency-only maintenance change `radix-react-19-peer-bump`. This change bumps six `@radix-ui/*` packages to React-19-peer-safe stable versions to eliminate the `Accessing element.ref was removed in React 19` console warning. It introduces NO new capability and modifies NO existing requirement.

## Delta Declaration

| Section | Disposition |
| --- | --- |
| ADDED Requirements | None |
| MODIFIED Requirements | None |
| REMOVED Requirements | None |
| RENAMED Requirements | None |

## Existing Requirements Check

The only specification that could plausibly interact is `visual-design-system` → `Presentation-Only Boundary` (the rollout MUST NOT change Radix/shadcn component behavior). That requirement remains SATISFIED — the bump preserves behavior and introduces no logic, route, data, or schema change, so no MODIFIED block is warranted. `reference-data-provisioning` is unrelated.

## Regression Contract (handoff to design and verify)

This contract is the change's acceptance surface; it adds no product requirements. The change MUST:

1. Remove the warning — `Accessing element.ref was removed in React 19` MUST NOT appear in the browser console across all affected experiences.
2. Preserve behavior — all affected flows MUST render and behave identically pre/post bump.
3. Pass gates — `pnpm exec tsc --noEmit`, `pnpm lint`, and `pnpm build` MUST pass.
4. Resolve the lockfile — the six bumped packages MUST resolve onto the new internal line; the old line remains only under `cmdk`.

## Out of Scope

- `cmdk@1.0.0`'s pinned old Radix subtree (dormant) and its pre-existing `react: ^18` peer mismatch — documented as a separate follow-up, not part of this change.
