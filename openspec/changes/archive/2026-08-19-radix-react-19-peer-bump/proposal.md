# Proposal: Radix UI React 19 Peer Bump

## Intent

Eliminate the `Accessing element.ref was removed in React 19` console warning. Root cause: the six direct `@radix-ui/*` packages resolve onto the pre-React-19 internal line — `react-slot@1.0.2` reads `children.ref` in `SlotClone`, an access React 19 removed. Fix is dependency-only: bump all six to latest stable React-19-peer-safe versions. Product behavior must stay identical.

## Scope

### In Scope
- Bump in `package.json` (keep caret ranges): `react-slot` 1.0.2→1.3.3, `react-dialog` 1.0.5→1.1.23, `react-label` 2.0.2→2.1.15, `react-popover` 1.0.7→1.1.23, `react-select` 2.0.0→2.3.7, `react-toast` 1.2.1→1.2.23
- Regenerate `pnpm-lock.yaml` via `pnpm install`
- Regression across all affected experiences: forms (Login/Register/FilterExercises), DialogAddExercise, popovers (AddExerciseForm/SummaryWorkoutForm), Select (+Icon asChild), Button asChild, toasts
- Gates: `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build`; browser smoke check for warning absence
- No application code changes (shadcn/ui wrappers already React-19-compatible)

### Out of Scope
- `cmdk@1.0.0`'s pinned old Radix subtree — dormant (used Command tree renders no Slot/asChild); documented as follow-up
- Replacing `cmdk` or its pre-existing `react: ^18` peer mismatch
- Any new product capability or visual change

## Capabilities

### New Capabilities
None — no new spec surface.

### Modified Capabilities
None — no requirement-level behavior change. Checked: `visual-design-system` "Presentation-Only Boundary" (MUST NOT change Radix/shadcn behavior) stays satisfied because the bump preserves behavior; `reference-data-provisioning` is unrelated.

## Approach

Exploration Approach 1 (recommended): bump all six to verified latest stable; all declare `react: ^19` in peerDependencies and resolve onto the new internal line (`react-primitive@2.1.10`, `react-slot@1.3.3`). Approach 2 (slot-only) rejected: old-line dialog/popover/select would keep `react-slot@1.0.2` and still warn. No app edits required.

## Affected Areas

| Area | Impact | Description |
| --- | --- | --- |
| `package.json` | Modified | Six `@radix-ui/*` ranges bumped |
| `pnpm-lock.yaml` | Modified | Regenerated; old Radix line remains only under `cmdk` |
| `src/components/ui/*` | None | Wrappers unchanged (form, button, dialog, popover, select, toast, label) |

## Risks

| Risk | Likelihood | Mitigation |
| --- | --- | --- |
| cmdk-pinned old Radix line stays bundled | High | Dormant — no Slot render in used Command tree; follow-up documented |
| Behavior drift in bumped packages | Low | Full regression of affected callers + tsc/lint/build gates |
| No test runner → manual regression | Med | Scripted smoke list covering every affected experience |

## Rollback Plan

`git revert` the bump commit (package.json + lockfile) and re-run `pnpm install`. Dependency-only change reverts cleanly; no code or data migration involved.

## Dependencies

- npm registry availability for the six target versions (verified stable)
- `pnpm install` for lockfile regeneration

## Success Criteria

- [ ] `Accessing element.ref...` warning absent from browser console across all affected experiences
- [ ] `pnpm exec tsc --noEmit`, `pnpm lint`, `pnpm build` all pass
- [ ] All affected flows behave identically pre/post bump
- [ ] Lockfile shows the six packages on the new internal line; old line only under `cmdk`