# Reference Data Provisioning Specification

## Purpose

Define provisioning of canonical muscle groups while preserving application, deployment, and user data.

## Requirements

### Requirement: Versioned Canonical Provisioning

The system MUST provision these canonical tag/name pairs through one new versioned, data-only migration: `chest/Pecho`, `back/Espalda`, `shoulders/Hombros`, `biceps/Bíceps`, `triceps/Tríceps`, `legs/Piernas`, `glutes/Glúteos`, `abs/Abdominales`, `trapezius/Trapecio`, `forearm/Antebrazo`, `calves/Gemelos`, `hamstrings/Isquiotibiales`, `quadriceps/Cuádriceps`, and `deltoids/Deltoides`.

The custom-migration exception MUST permit only authoring and reviewing data SQL in that new, unapplied migration; historical and applied migrations MUST remain immutable.

#### Scenario: Fresh database

- GIVEN a database with the existing schema and no muscle groups
- WHEN pending migrations are applied
- THEN all fourteen canonical tag/name pairs MUST exist exactly once
- AND no sample exercises or user-owned records MUST be created

#### Scenario: Existing canonical data

- GIVEN all canonical pairs already exist with their current identifiers
- WHEN the provisioning migration is applied
- THEN every canonical row MUST retain its tag, name, and identifier
- AND exercises, workouts, users, and extra muscle groups MUST remain unchanged

### Requirement: Tag-Keyed Reconciliation

The system MUST match canonical records by tag, insert missing tags, and update only a differing name on an existing canonical tag. It MUST NOT remap tags, replace identifiers, merge rows, or automatically delete canonical or extra rows.

#### Scenario: Name divergence on an existing tag

- GIVEN canonical tag `chest` exists under a noncanonical name that is otherwise available
- WHEN the provisioning migration is applied
- THEN only that row's name MUST become `Pecho`
- AND its tag, identifier, and related exercise references MUST remain unchanged

#### Scenario: Partially populated database

- GIVEN canonical, extra, exercise, workout, and user records coexist
- WHEN the provisioning migration is applied
- THEN missing canonical tags MUST be inserted and divergent canonical names reconciled
- AND all unrelated rows and relationships MUST be preserved

### Requirement: Atomic Collision Escalation

If a canonical name is owned by another tag, provisioning MUST fail without mutation, emit sanitized diagnostics sufficient for human escalation, and MUST NOT remap, merge, or delete either row.

#### Scenario: Incompatible collision

- GIVEN `Pecho` belongs to a tag other than `chest`
- WHEN provisioning attempts to reconcile `chest`
- THEN the migration MUST fail atomically without persisted changes
- AND recovery MUST require reviewed human correction followed by forward-only migration

#### Scenario: Post-deployment correction

- GIVEN an applied provisioning migration later requires correction
- WHEN recovery is prepared
- THEN a new forward migration MUST provide the correction
- AND history rewriting, down-migration, tag remapping, and automatic deletion MUST remain prohibited

### Requirement: Idempotent Convergence

Repeated execution MUST converge to the same canonical state and MUST NOT duplicate or otherwise mutate already reconciled data.

#### Scenario: Migration retry

- GIVEN provisioning completed successfully
- WHEN equivalent provisioning is retried
- THEN the fourteen canonical pairs MUST remain unchanged
- AND no row counts, identifiers, or relationships MUST change

### Requirement: Migration-Only Delivery Boundary

Provisioning MUST be delivered solely as migration behavior. It MUST NOT invoke or alter seed scripts, an HTTP seed endpoint, sample exercises, management UI, schema, runtime, or build behavior.

#### Scenario: Delivery inspection

- GIVEN the provisioning change is ready for review
- WHEN its behavioral surface is inspected
- THEN only the new data migration MUST provide provisioning
- AND seeds, HTTP endpoints, application build behavior, and historical migrations MUST remain unchanged

### Requirement: Sanitized Validation and Deployment Isolation

Validation MUST provide secret-free evidence for fresh installation, upgrade, reconciliation, collision atomicity, preservation, and retry. Passing evidence MAY unlock a later deployment smoke rerun but MUST NOT mutate the separate `supabase-postgres-deployment` change or platform configuration.

#### Scenario: Validation unlock

- GIVEN all required migration assertions pass with sanitized output
- WHEN the validation result is recorded
- THEN the reference-data change MUST be eligible for its next SDD phase
- AND the separate deployment change MUST remain unmodified pending explicit follow-up
