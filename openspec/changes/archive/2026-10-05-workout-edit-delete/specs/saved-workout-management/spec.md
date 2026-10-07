# Saved Workout Management Specification

## Purpose

Allow an authenticated owner to correct a saved workout's name and performance date or delete the workout and its sets without exposing another user's history or invalidating existing detail URLs.

## Requirements

### Requirement: Owner-scoped metadata edits

An authenticated owner MUST be able to change a saved workout's name and performance date. The stored tag MUST remain unchanged on either edit, and the existing `/workouts/[slug]` address MUST continue to resolve to that workout. The edited date MUST be reflected as the workout's performance date in its detail and list views. No metadata edit MAY change another user's workout.

#### Scenario: Edit name and performance date

- GIVEN an owner has a saved workout with a stored tag
- WHEN the owner submits a valid new name and performance date
- THEN the workout displays the new name and performance date in its detail and list views
- AND the stored tag is unchanged
- AND the original detail URL still resolves to that workout

#### Scenario: Editing metadata never derives a new tag

- GIVEN a saved workout whose new name or date would derive a different tag if created today
- WHEN its owner edits either field
- THEN its existing stored tag and detail URL remain unchanged

### Requirement: Confirmed and atomic whole-workout deletion

The owner MUST be offered a bottom-sheet confirmation before whole-workout deletion. Opening or dismissing that confirmation MUST NOT delete anything. Only explicit confirmation MAY delete the owned workout and all of its sets; the deletion MUST be atomic, leaving neither a partly deleted workout nor orphaned sets on failure. Deletion MUST NOT depend on a database-level cascade: the set-to-workout foreign key MUST remain restrictive, and this capability MUST NOT require a schema migration. A successful deletion MUST leave the deleted workout unavailable at its prior detail URL and absent from the workout list.

#### Scenario: Dismiss confirmation

- GIVEN an owner opens the bottom-sheet confirmation for a saved workout
- WHEN the owner dismisses it without confirming
- THEN the workout and all its sets remain available

#### Scenario: Confirm deletion of an owned workout

- GIVEN an owner has a workout with saved sets and opens its bottom-sheet confirmation
- WHEN the owner explicitly confirms deletion
- THEN the workout and all its sets are deleted
- AND the old detail URL no longer resolves to the deleted workout
- AND the workout no longer appears in the owner's workout list

#### Scenario: Deletion failure does not partially remove history

- GIVEN deletion of an owned workout fails before the complete removal can succeed
- WHEN the action returns a failure
- THEN the workout and all of its previously saved sets remain intact

### Requirement: Validated, owner-isolated mutation results

Each new saved-workout mutation MUST require an authenticated owner, validate its input with Zod before any database write, and return a coded result. It MUST return `unauthorized` without a write when there is no authenticated user, `invalid_input` without a write for invalid input, `not_found` without a write for either a missing or another user's workout, and `error` for a failed write. Missing and foreign workouts MUST be indistinguishable to the caller. Successful mutations MUST revalidate both the affected detail route and `/workouts`; unsuccessful mutations MUST NOT report success or revalidate them. These new coded results MUST NOT change the existing `updateSet` result contract.

#### Scenario: Unauthenticated metadata edit or deletion

- GIVEN no authenticated user
- WHEN a saved-workout edit or deletion is requested
- THEN the action returns `{ ok: false, code: "unauthorized" }`
- AND no database write occurs

#### Scenario: Invalid edit input

- GIVEN an authenticated owner submits an invalid name, date or workout identifier
- WHEN the metadata edit is requested
- THEN the action returns `{ ok: false, code: "invalid_input" }`
- AND no database write occurs

#### Scenario: Missing and foreign workouts are indistinguishable

- GIVEN user A is authenticated and cannot access a workout owned by user B
- WHEN A attempts to edit or delete B's workout, or a nonexistent workout
- THEN either attempt returns `{ ok: false, code: "not_found" }`
- AND neither attempt changes any workout or set

#### Scenario: Successful mutations refresh both views

- GIVEN an owner successfully edits or deletes a saved workout
- WHEN the mutation completes
- THEN its original detail route and `/workouts` are revalidated

#### Scenario: Failed mutation returns an error without a partial write

- GIVEN a database write for an owned saved workout fails
- WHEN the mutation completes
- THEN it returns `{ ok: false, code: "error" }`
- AND no partial change is visible

### Requirement: Verifiable post-save behavior

The change MUST include automated action tests for successful edits and deletions, validation failures, unauthenticated and foreign access, atomic destructive failure, and detail/list revalidation. Before delivery, `pnpm test`, `pnpm build`, `pnpm lint`, `pnpm run format:check`, and `pnpm exec tsc --noEmit` MUST pass. Confirmation behavior MUST also be verified without claiming automated DOM coverage where no such harness exists.

#### Scenario: Action tests cover owner isolation

- GIVEN the new workout management actions are tested with owned, foreign, missing and unauthenticated cases
- WHEN the action tests run
- THEN only owned valid requests mutate history
- AND foreign and missing requests produce the same failure code

#### Scenario: Delivery gates

- GIVEN the change is ready for delivery
- WHEN the configured test, build, lint, format-check and type-check commands run
- THEN all five commands pass
