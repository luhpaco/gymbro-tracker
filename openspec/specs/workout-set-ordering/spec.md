# Workout Set Ordering Specification

## Purpose

Deterministic per-workout set order: a server-assigned integer position stored on every `Set`, a total
ordering rule applied on every read, an insertion timestamp, and a persisted warmup flag — so a workout's
sets always read back in the exact sequence the user entered them, including when exercises are
interleaved.

## Requirements

### Requirement: Server-assigned per-workout set order

Every persisted `Set` MUST carry an integer order value assigned by the server from the set's zero-based
position in the submitted payload flattened in exercise-major sequence (all sets of the first exercise,
then all sets of the second, and so on). The order value MUST be workout-wide, not per-exercise. The
server MUST NOT accept or trust any client-supplied order value.

#### Scenario: Single exercise with three sets

- GIVEN a submission with one exercise carrying three sets
- WHEN the workout is created
- THEN the three persisted sets carry order `0`, `1` and `2` in submission sequence

#### Scenario: Order is continuous across exercises

- GIVEN a submission with exercise A carrying two sets and exercise B carrying two sets, in that sequence
- WHEN the workout is created
- THEN A's sets carry order `0` and `1`
- AND B's sets carry order `2` and `3`
- AND no order value repeats within the workout

#### Scenario: Interleaved exercises round-trip

- GIVEN a submission whose flattened sequence is bench, squat, bench
- WHEN the workout is created and then read back
- THEN the sets are returned in the bench, squat, bench sequence
- AND the second bench set carries a higher order value than the squat set

#### Scenario: Client-supplied order is ignored

- GIVEN a submission that includes an order value on each set
- WHEN the workout is created
- THEN the persisted order values are the server-derived flattened positions
- AND the client-supplied values are not persisted

#### Scenario: Order restarts per workout

- GIVEN two workouts are created in sequence, each with two sets
- WHEN both are persisted
- THEN each workout's sets carry order `0` and `1`
- AND the second workout's order values do not continue from the first

### Requirement: Set insertion timestamp

Every persisted `Set` MUST carry a `createdAt` timestamp defaulted by the database at insert time. It
MUST serve only as a tie-breaker in the read ordering and MUST NOT be used as the primary ordering key,
because all rows of one nested create share an identical timestamp. It MUST NOT be treated as the date
the exercise was performed.

#### Scenario: createdAt is populated without being supplied

- GIVEN a workout is created with two sets and no explicit set timestamps
- WHEN the sets are read back
- THEN each set carries a non-null `createdAt`

#### Scenario: Identical timestamps do not determine sequence

- GIVEN every set of one workout shares an identical `createdAt`
- WHEN the sets are read back
- THEN they are returned in stored order value sequence, not in an arbitrary timestamp-derived sequence

### Requirement: Deterministic ordered read-back

Every read path that returns a workout's sets — the workout list and the workout detail — MUST return
them sorted by order value ascending, then by `createdAt` ascending, then by `id` ascending, so the sort
is total even if two rows share an order value. No read path MAY rely on `id` alone, and no read path MAY
omit an explicit sort.

#### Scenario: Detail read returns entry order

- GIVEN a workout whose sets were persisted with order `0`, `1`, `2`
- WHEN the workout detail is read
- THEN the sets are returned in order `0`, `1`, `2`

#### Scenario: List read returns entry order

- GIVEN a workout whose sets were persisted with order `0`, `1`, `2`
- WHEN the workout list is read
- THEN that workout's sets are returned in order `0`, `1`, `2`
- AND the list read applies the same sort as the detail read

#### Scenario: Ordering is independent of id

- GIVEN a workout whose sets carry order `0`, `1`, `2` while their identifiers sort in the reverse sequence
- WHEN the sets are read back
- THEN they are returned in order `0`, `1`, `2`

#### Scenario: Ties resolve to a stable total order

- GIVEN two sets of one workout share the same order value
- WHEN the sets are read back repeatedly
- THEN the returned sequence is identical on every read

### Requirement: Order values are non-unique and gap-tolerant

The stored order value MUST NOT be constrained to be unique within a workout, and gaps in the sequence
MUST be tolerated rather than triggering re-sequencing. The data layer MUST carry a non-unique index
supporting retrieval of a workout's sets in order.

#### Scenario: Gapped sequence reads in ascending order

- GIVEN a workout whose sets carry order `0`, `1`, `3`
- WHEN the sets are read back
- THEN they are returned in the sequence `0`, `1`, `3`
- AND no error or re-sequencing occurs

#### Scenario: Duplicate order values are accepted by the data layer

- GIVEN two sets of one workout are written with the same order value
- WHEN the write is attempted
- THEN it does not violate a uniqueness constraint

### Requirement: Warmup flag persistence

Every `Set` MUST carry a boolean warmup flag that defaults to `false` and is persisted from the submitted
payload. This change MUST NOT introduce any user-facing control for setting it, and MUST NOT change how
series are counted in any dashboard, list or summary surface.

#### Scenario: Warmup flag defaults to false

- GIVEN a submission whose sets omit the warmup flag
- WHEN the workout is created
- THEN every persisted set carries the warmup flag `false`

#### Scenario: Submitted warmup flag is persisted

- GIVEN a submission whose first set carries the warmup flag `true`
- WHEN the workout is created and read back
- THEN the first set carries the warmup flag `true`
- AND the remaining sets carry `false`

#### Scenario: Series counts are unaffected

- GIVEN a workout containing both warmup and working sets
- WHEN any dashboard, workout list or summary surface counts its series
- THEN the count includes every set, exactly as it did before this change

### Requirement: Displayed set number is group-relative

The set number shown to the user for a given exercise MUST be derived from the set's index within its own
exercise group, not from the stored workout-wide order value.

#### Scenario: Group-relative numbering with a single exercise

- GIVEN a workout detail showing one exercise with three sets carrying order `0`, `1`, `2`
- WHEN the sets are rendered
- THEN they are labelled as set 1, 2 and 3

#### Scenario: Group-relative numbering with interleaved exercises

- GIVEN a workout whose flattened sequence is bench (order `0`), squat (order `1`), bench (order `2`)
- WHEN the bench group is rendered
- THEN its two sets are labelled set 1 and set 2
- AND neither label shows the stored order value `2`
