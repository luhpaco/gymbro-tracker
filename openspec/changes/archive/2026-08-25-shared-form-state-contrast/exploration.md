# Exploration: Shared Form State Contrast

### Current State

The selected uncommitted diff is a presentation-only seven-file slice: 11 additions and 13 deletions. It removes feature-local disabled opacity overrides, replaces disabled opacity in `Command`, `Input`, `Select`, and `Textarea` with semantic muted surface/foreground classes, and adds explicit invalid, placeholder, and icon colors.

`FormControl` already forwards React Hook Form field errors as `aria-invalid`; the new primitive classes only render that existing state. Form schemas, submit handlers, values, routes, Zustand updates, server actions, and Radix/cmdk event wiring are unchanged.

The slice is intentionally outside `audit-dark-form-surface-contrast`, whose approved boundary is five workout-create files: `globals.css`, `button.tsx`, `calendar.tsx`, `SummaryWorkout.tsx`, and `SummaryWorkoutForm.tsx`. However, the two feature-form disabled-button edits rely on the uncommitted semantic disabled style now in `button.tsx`, which belongs to the audit slice. A standalone branch must therefore be based on the completed audit commit, not the current base commit.

### Affected Areas

- `src/components/exercise/CreateExerciseForm.tsx` — removes its submit button's local `disabled:opacity-35` override; route caller: `exercises/create`.
- `src/components/exercise/UpdateExerciseForm.tsx` — removes its submit button's local `disabled:opacity-35` override; route caller: `exercises/update/[id]`.
- `src/components/workout/AddExerciseForm.tsx` — gives the combobox icon an explicit muted color and lets set-stepper buttons inherit shared disabled presentation; caller: `DialogAddExercise`.
- `src/components/ui/command.tsx` — changes command search/icon and disabled-item presentation; current application consumer: `AddExerciseForm`.
- `src/components/ui/input.tsx` — standardizes disabled and invalid presentation for every consumer, including exercise and authentication forms.
- `src/components/ui/select.tsx` — standardizes placeholder, open, invalid, icon, and disabled-item presentation; consumers include exercise create/update forms and `FilterExercises`.
- `src/components/ui/textarea.tsx` — standardizes disabled and invalid presentation for exercise description fields.
- `src/components/ui/form.tsx` — unchanged dependency: it supplies `aria-invalid` from existing React Hook Form errors.
- `src/components/ui/button.tsx` — excluded from this change but required as a committed base dependency for the removed local button-opacity overrides.

### Approaches

1. **Base the shared change on the completed audit commit** — preserve the selected paths, finish and commit the audit five-file slice, then apply the preserved shared slice in a new worktree created from that commit.
   - Pros: keeps the approved audit boundary intact, preserves the intended semantic disabled-button appearance, and yields a clean seven-source-file PR diff.
   - Cons: the shared change cannot be finalized before the audit dependency is committed.
   - Effort: Low.

2. **Copy `button.tsx` into the shared change** — move the semantic button-disabled rules with the feature-form overrides.
   - Pros: makes the shared branch independently based on the current commit.
   - Cons: violates the explicit separation, duplicates shared-style ownership, and risks conflicting button rules when the audit branch lands.
   - Effort: Medium.

### Recommendation

Use approach 1. The future handoff should first create a path-limited stash containing the seven source files and this new change folder, retaining the stash after application. Commit the audit slice unchanged in the primary worktree. Then create `gymbro-tracker-worktrees/shared-form-state-contrast` from that audit commit, apply the stash there (do not pop it), and verify that the shared diff contains only the seven source files plus `openspec/changes/shared-form-state-contrast/`. This preserves both uncommitted slices without moving audit artifacts or losing a recovery point.

### Risks

- Creating the shared branch from `3d78b58` before the audit commit would remove the semantic disabled-button treatment that the two feature forms are meant to inherit.
- The shared primitives have consumers beyond the three named forms, notably authentication inputs and the exercise filter select; visual regression checks must include representative enabled, disabled, invalid, placeholder, and keyboard-focus states.
- No automated tests cover these forms or primitives. Verification must use `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm build`, and focused manual browser checks.
- The current workspace has unrelated audit edits and untracked audit artifacts; any transfer command without explicit pathspecs could accidentally carry them into the shared branch.

### Ready for Proposal

Yes — propose a presentation-only `visual-design-system` delta for semantic form states, with the completed audit commit recorded as a prerequisite and a path-limited worktree transfer plan.
