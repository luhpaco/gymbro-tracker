# Exercise Name Uniqueness Specification

## Purpose

Define stable, owner-scoped exercise-name identity across creation and rename.

## Requirements

### Requirement: Normalized name identity

The system MUST derive an exercise's canonical identity by trimming leading and trailing whitespace, case-folding, and replacing each internal whitespace sequence with one space. Equivalent inputs MUST produce the same identity.

#### Scenario: Equivalent spellings normalize identically

- GIVEN names that differ only by case or surrounding/repeated whitespace
- WHEN their canonical identities are derived
- THEN the identities are equal

#### Scenario: Distinct names remain distinct

- GIVEN names whose non-whitespace characters differ after case-folding
- WHEN their canonical identities are derived
- THEN the identities are different

### Requirement: Safe canonical-identity migration

Before enabling owner-scoped canonical-name uniqueness, the system MUST audit every legacy exercise with the same normalization rule. It MUST report and block migration on unresolved same-owner canonical collisions; conflicting rows MUST be remediated through an approved process before migration resumes. Backfill MUST update rows in place, preserving exercise IDs, ownership, active state, and all history associations. Cross-owner matches MUST remain valid.

#### Scenario: Legacy collision blocks migration

- GIVEN legacy exercises are audited with canonical normalization
- WHEN two rows owned by the same user resolve to one identity
- THEN the migration is blocked and the conflict is reported for remediation
- AND backfill and constraint activation MUST NOT proceed while it remains unresolved

#### Scenario: Safe backfill preserves history

- GIVEN the audit has no unresolved same-owner collisions
- WHEN canonical identities are backfilled and scoped uniqueness is enabled
- THEN every exercise retains its ID, owner, active state, and history associations
- AND equivalent identities owned by different users remain valid

### Requirement: Owner-scoped identity

An owner MUST NOT have multiple exercises with the same canonical identity. Different owners MAY reuse that identity. Creation and rename MUST apply the same rule, include inactive rows, and exclude the row being renamed from its own conflict check.

#### Scenario: Same-owner duplicate is rejected

- GIVEN an owner already has an exercise with a canonical identity
- WHEN that owner creates or renames another exercise to that identity
- THEN the mutation fails with duplicate-name feedback

#### Scenario: Cross-owner reuse succeeds

- GIVEN one owner has an exercise with a canonical identity
- WHEN another owner creates or renames an exercise to that identity
- THEN the mutation succeeds

#### Scenario: Self-rename succeeds

- GIVEN an owner renames an exercise without changing its canonical identity
- WHEN no other owned exercise holds that identity
- THEN the rename succeeds
