# Proposal: Shared Form State Contrast

## Intent

Make form states consistently legible across the application. Users must be able to distinguish placeholder, invalid, disabled, and icon states without changing how forms validate, submit, or store data.

## Scope

### In Scope
- Normalize semantic presentation for placeholder, invalid, disabled, and icon states in shared form primitives.
- Remove feature-local disabled opacity overrides so exercise and workout forms inherit shared presentation.
- Keep disabled controls readable while visibly attenuated.
- Correct the Tailwind runtime configuration's CommonJS module loads to ESM imports so Next can load the existing configuration while compiling affected routes.

### Out of Scope
- Validation rules, form values, data, routes, server actions, events, and accessibility wiring.
- A prescribed WCAG contrast ratio, theme redesign, or the audit change's shared button styling.
- Tailwind token, content-glob, theme-extension, or plugin-behavior redesign beyond the module-format correction.

## Capabilities

### New Capabilities
None.

### Modified Capabilities
- `visual-design-system`: standardize legible presentation of shared form states while preserving existing behavior.

## Approach

Base this change on the completed `audit-dark-form-surface-contrast` commit, which owns the shared button disabled treatment. Apply the preserved seven-file shared slice in a dedicated worktree. Use Tailwind semantic muted, destructive, and foreground classes in primitives; consume existing `aria-invalid` output from `FormControl` without changing validation logic. Also replace the existing `require(...)` loads in `tailwind.config.ts` with typed ESM imports for `tailwindcss/defaultTheme` and `tailwindcss-animate`, retaining the same font-family extension and animation plugin.

## Affected Areas

| Area | Impact | Description |
|------|--------|-------------|
| `src/components/ui/{command,input,select,textarea}.tsx` | Modified | Normalize shared state colors and disabled presentation. |
| `src/components/exercise/{CreateExerciseForm,UpdateExerciseForm}.tsx` | Modified | Remove local disabled button opacity overrides. |
| `src/components/workout/AddExerciseForm.tsx` | Modified | Normalize combobox icon and inherited disabled states. |
| `tailwind.config.ts` | Modified | Use ESM imports for the existing default theme and animation plugin so Next's ESM config loader can compile routes. |

## Risks

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| Audit base is incomplete | Med | Do not create/apply the shared worktree until the audit commit exists. |
| Primitive consumers regress visually | Med | Check representative auth, exercise, filter, and workout states manually. |
| Unrelated edits transfer | Med | Use explicit pathspecs and verify the resulting diff. |
| Tailwind config loads as ESM during Next compilation | Low | Preserve all existing configuration values and validate with the production build, including `/workouts/create`. |

## Rollback Plan

Revert the dedicated seven-file commit and the import-only `tailwind.config.ts` correction as a single change if delivery must be withdrawn. The audit commit remains intact; no migration, persisted data, or behavior rollback is required.

## Dependencies

- Completed `audit-dark-form-surface-contrast` commit containing `src/components/ui/button.tsx` disabled-state styling.

## Success Criteria

- [ ] Placeholder, invalid, disabled, and icon states are visually consistent across affected forms.
- [ ] Disabled controls remain legible and attenuated in representative manual checks.
- [ ] The diff changes presentation only; validation, data, routes, server actions, and behavior remain unchanged.
- [ ] Next loads `tailwind.config.ts` without a CommonJS `require` runtime error while retaining the configured default-theme font families and animation plugin.
