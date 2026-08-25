# Design: Shared Form State Contrast

## Technical Approach

Implement a presentation-only seven-source-file slice plus a narrow Tailwind runtime configuration correction. Shared primitives render existing placeholder, `aria-invalid`, disabled, open, and icon signals with semantic Tailwind classes; feature forms remove local opacity overrides and inherit the audit-owned Button treatment. `tailwind.config.ts` imports the default theme and animation plugin through typed ESM imports rather than CommonJS `require(...)`, preserving the existing theme extension and plugin array. Validation, values, events, Radix/cmdk, Zustand, actions, routes, and persistence remain unchanged. Conformance is qualitative; no numeric contrast ratio is required.

Implementation requires a committed `audit-dark-form-surface-contrast` revision containing `src/components/ui/button.tsx`. The prerequisite exists as `5aec36e9b90fa16ffbe38740f27a82b7a3ceab99`; the dedicated worktree and seven-file slice were created from that base. This included Tailwind runtime correction does not modify `button.tsx`.

## Architecture Decisions

| Option | Tradeoff | Decision and rationale |
|---|---|---|
| Semantic primitive classes | Broad consumer visibility | Use existing semantic tokens because primitives own state presentation. |
| Feature-local overrides | Narrower but duplicated | Reject except removal; Button styling remains in the audit commit. |
| Branch from the pre-audit base | Immediately available but loses inherited Button treatment | Reject; the audit commit MUST be the dedicated worktree base and ancestor. |
| Retained path-limited stash | Requires verification | Isolates the allowlist while preserving recovery. |

## Data Flow

    React Hook Form error → FormControl aria-invalid → Input/Select/Textarea classes
    Native/Radix/cmdk state → shared primitive classes → rendered state
    Feature submit/selection handlers ───────────────────────→ unchanged

## File Changes

| File | Action | Description |
|---|---|---|
| `src/components/ui/command.tsx` | Modify | Semantic search icon and disabled input/item presentation. |
| `src/components/ui/input.tsx` | Modify | Placeholder, invalid, and disabled presentation. |
| `src/components/ui/select.tsx` | Modify | Placeholder, open, invalid, icon, and disabled-item presentation. |
| `src/components/ui/textarea.tsx` | Modify | Invalid and disabled presentation. |
| `src/components/exercise/CreateExerciseForm.tsx` | Modify | Remove local submit-disabled opacity. |
| `src/components/exercise/UpdateExerciseForm.tsx` | Modify | Remove local submit-disabled opacity. |
| `src/components/workout/AddExerciseForm.tsx` | Modify | Semantic combobox icon; remove stepper disabled-opacity overrides. |
| `tailwind.config.ts` | Modify | Replace CommonJS module loads with typed ESM imports while retaining `fontFamily` destructuring and the animation plugin. |

`src/components/ui/form.tsx` is an unchanged `aria-invalid` dependency. `src/components/ui/button.tsx` is an unchanged dependency supplied by the audit commit.

## Interfaces / Contracts

No new props, types, schemas, tokens, or APIs. Existing state attributes and `FormControl` accessibility wiring remain authoritative. Tailwind configuration exports the same `Config` shape and uses the same tokens, content paths, font-family extension, and plugin behavior.

## Testing Strategy

| Layer | What to Test | Approach |
|---|---|---|
| Static | Scope and behavior preservation | Diff from the audit commit; require the seven source paths plus `tailwind.config.ts`. Confirm no schema, handler, prop, `aria-*`, action, store, or route diff; restrict the config diff to ESM imports and equivalent existing references. Run `pnpm run format:check`, `pnpm test`, `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm exec prisma validate`, and `pnpm build`. |
| Runtime configuration | ESM loader compatibility | Build with CI placeholder environment values and confirm Next compiles `/workouts/create` without `require is not defined`. |
| Manual: auth | Shared Input placeholder, invalid, focus, and pending-disabled states | On `/auth/login` (and register as a second consumer), submit invalid values and verify messages, `aria-invalid`, credentials handling, and submission boundary are unchanged. |
| Manual: exercise/filter | Input, Textarea, Select, and submit-disabled states | Check `/exercises/create`, `/exercises/update/[id]`, and `/exercises`; verify selection, filtering, payloads, navigation, and messages. |
| Manual: workout | Command, mixed invalid, and min/max disabled states | On `/workouts/create`, open `AddExerciseForm`; verify keyboard selection, limits, add action, dialog close, and Zustand update. |

Vitest exists only for pure logic units; no component, DOM, integration, or E2E layer exists. Manual state coverage remains required, and no CSS-class assertion test is valid for this change.

## Threat Matrix

| Boundary | Applicability | Safe / failure behavior | Planned RED test |
|---|---|---|---|
| Documentation-like paths | N/A — OpenSpec files are transferred as inert documentation; no executable classification is introduced. | No execution boundary. | None. |
| Git repository selection | Applicable — worktree commands use absolute paths and `git -C`. | Verify both repository roots and the expected branch before apply; abort on any mismatch. | Point preflight at the primary or wrong repository and require rejection before mutation. |
| Commit state | Applicable — source is a dirty mixed worktree and transfer uses stash/index semantics. | Use explicit pathspecs, never `commit -a`; require the audit commit ancestor, clean target index/worktree, non-empty stash, and exact allowlist. Abort on missing dependency, staged target changes, empty transfer, conflicts, or extra paths. | Require failure for a missing audit ancestor, dirty target index, empty stash, and one extra stashed path. |
| Tailwind runtime configuration | Applicable — Next evaluates the config as ESM while compiling route CSS. | Replace only the two CommonJS loads with typed ESM imports and preserve their existing use sites. | The native Next attempt before correction produced `ReferenceError: require is not defined`; run the production build after correction. |
| Push state | N/A — no push is designed. | No destination resolution. | None. |
| PR commands | N/A — no PR command composition is designed. | No PR automation. | None. |

## Migration / Rollout

No data migration or feature flag. Before committing the audit slice, create a named path-limited stash containing exactly the seven source files and `openspec/changes/shared-form-state-contrast/`. Commit the audit slice, record its SHA, then create `/home/luhpaco/projects/gymbro-tracker-worktrees/shared-form-state-contrast` from that SHA. Verify ancestry and a clean target, apply (do not pop) the named stash, and verify status contains only the allowlist. Keep the stash until the shared commit and all checks pass. Include the existing import-only `tailwind.config.ts` correction in this change and validate it through the production build; do not alter the retained stash.

Rollback a failed transfer by discarding/removing only the dedicated worktree while retaining the stash. After delivery, revert the isolated seven-file commit and the import-only `tailwind.config.ts` correction together; the audit commit remains intact.

## Open Questions

None.
