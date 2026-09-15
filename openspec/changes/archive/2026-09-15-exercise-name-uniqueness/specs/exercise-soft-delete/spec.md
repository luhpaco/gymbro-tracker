# Delta for Exercise Soft-Delete

## MODIFIED Requirements

### Requirement: Name Uniqueness Unaffected

Deactivation MUST NOT release an exercise's owner-scoped canonical identity. The owner MUST reactivate or rename the existing row before reusing that identity; another owner MAY use it. Reactivation MUST preserve the existing row and history.
(Previously: Inactive names remained reserved globally.)

#### Scenario: Same-owner creation fails while inactive

- GIVEN an inactive exercise holds the owner's canonical identity
- WHEN that owner creates an equivalent name
- THEN creation returns duplicate-name feedback

#### Scenario: Another owner may reuse the name

- GIVEN an inactive exercise holds one owner's canonical identity
- WHEN another owner creates an equivalent name
- THEN creation succeeds

#### Scenario: Reactivation restores the exercise

- GIVEN the owner's exercise is inactive
- WHEN the owner reactivates it
- THEN the existing row reappears with its history preserved
