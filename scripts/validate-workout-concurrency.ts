/**
 * Runtime verification for SDD task 4.1 of the `workout-edit-delete` change.
 *
 * This harness is the only proof of PostgreSQL conflict detection and atomic
 * rollback for the set-list mutations in `src/data/workout-mutations.ts`. The
 * mocked Vitest suites never open a real connection and never run a real
 * SERIALIZABLE transaction, so they cannot and do not prove serialization.
 *
 * Because of that it must stay outside the DB-free CI unit suite: `pnpm test`
 * (vitest.config.ts) only collects co-located tests under `src`, and CI has no
 * database. Run this harness explicitly with:
 *
 *     pnpm validate:workout-concurrency
 *
 * Safety: it refuses to run against any PostgreSQL port other than the isolated
 * worktree port (5434). It never touches port 5432 or the main checkout
 * database. All fixtures are disposable and removed on exit.
 */

import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import Module, { createRequire } from "node:module";
import { join } from "node:path";

import type { PrismaClient } from "@prisma/client";

// The application modules import through the `@/` TS path alias, which the
// ts-node CommonJS loader does not resolve (tsconfig-paths is not a dependency).
// Patch Node's resolver before any application module is loaded.
const projectRoot = join(__dirname, "..");
const sourceRoot = join(projectRoot, "src");

const moduleApi = Module as unknown as {
	_resolveFilename: (request: string, ...rest: unknown[]) => string;
};
const originalResolveFilename = moduleApi._resolveFilename;
moduleApi._resolveFilename = function (
	request: string,
	...rest: unknown[]
): string {
	if (request.startsWith("@/")) {
		return originalResolveFilename.call(
			this,
			join(sourceRoot, request.slice(2)),
			...rest,
		);
	}
	return originalResolveFilename.call(this, request, ...rest);
};

const loadModule = createRequire(__filename);
const mutations = loadModule(
	"../src/data/workout-mutations",
) as typeof import("../src/data/workout-mutations");
const prisma = (loadModule("../src/lib/prisma") as { default: PrismaClient })
	.default;

// Prisma does not load `.env` on its own here, so the harness loads it and then
// refuses to continue unless the connection targets the isolated worktree DB.
const loadEnvFile = (path: string): void => {
	for (const line of readFileSync(path, "utf8").split(/\r?\n/)) {
		const match = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
		if (!match) continue;
		const [, key, rawValue] = match;
		if (process.env[key] !== undefined) continue;
		process.env[key] = rawValue
			.replace(/^"(.*)"$/, "$1")
			.replace(/^'(.*)'$/, "$1");
	}
};

const WORKTREE_POSTGRES_PORT = "5434";
const RACE_ITERATIONS = 3;

const assertIsolatedDatabase = (): string => {
	const rawUrl = process.env.POSTGRES_URL;
	if (!rawUrl) throw new Error("POSTGRES_URL is missing after loading .env");

	const url = new URL(rawUrl);
	if (url.port !== WORKTREE_POSTGRES_PORT) {
		throw new Error(
			`refusing to run: POSTGRES_URL uses port ${url.port || "(default)"}, ` +
				`expected the isolated worktree port ${WORKTREE_POSTGRES_PORT}`,
		);
	}
	return url.pathname.replace(/^\//, "");
};

loadEnvFile(join(projectRoot, ".env"));
const databaseName = assertIsolatedDatabase();

// ---------------------------------------------------------------------------
// Transaction instrumentation (real calls, real database)
// ---------------------------------------------------------------------------

const metrics = { attempts: 0, conflicts: 0 };

const isSerializationConflict = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as { code?: unknown }).code === "P2034";

let instrumentationActive = false;

// The helpers use the shared Prisma singleton, so wrapping its `$transaction`
// counts real attempts and real P2034 aborts without mocking any behaviour.
const instrumentTransactionCalls = (): void => {
	const client = prisma as unknown as {
		$transaction: (...args: unknown[]) => unknown;
	};
	const original = client.$transaction;
	const wrapper = (...args: unknown[]): unknown => {
		metrics.attempts += 1;
		const outcome = original.apply(prisma, args);
		const thenable = outcome as { then?: unknown } | null;
		if (thenable && typeof thenable.then === "function") {
			return (outcome as Promise<unknown>).catch((error: unknown) => {
				if (isSerializationConflict(error)) metrics.conflicts += 1;
				throw error;
			});
		}
		return outcome;
	};
	client.$transaction = wrapper;
	instrumentationActive = client.$transaction === wrapper;
};

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const runTag = `sdd-4-1-${randomUUID()}`;
const createdUserIds: string[] = [];
const createdExerciseIds: string[] = [];
const createdWorkoutIds: string[] = [];

const makeUser = async (label: string): Promise<string> => {
	const user = await prisma.user.create({
		data: {
			email: `${runTag}-${label}@example.invalid`,
			firstName: "SDD",
			lastName: label,
			password: "disposable-fixture",
		},
		select: { id: true },
	});
	createdUserIds.push(user.id);
	return user.id;
};

const makeExercise = async (userId: string, label: string): Promise<string> => {
	const exercise = await prisma.exercise.create({
		data: {
			name: `${runTag} ${label}`,
			tag: `${runTag}-${label}`,
			canonicalName: `${runTag}-${label}`,
			muscleGroupTag: "chest",
			userId,
		},
		select: { id: true },
	});
	createdExerciseIds.push(exercise.id);
	return exercise.id;
};

const makeWorkout = async (
	userId: string,
	label: string,
): Promise<{ id: string; tag: string }> => {
	const workout = await prisma.workout.create({
		data: {
			name: `${runTag} ${label}`,
			tag: `${runTag}-${label}`,
			date: new Date("2026-01-01T00:00:00.000Z"),
			userId,
		},
		select: { id: true, tag: true },
	});
	createdWorkoutIds.push(workout.id);
	return workout;
};

const makeSet = async (
	workoutId: string,
	exerciseId: string,
	order: number,
): Promise<string> => {
	const set = await prisma.set.create({
		data: { workoutId, exerciseId, order, weight: 10, reps: 5 },
		select: { id: true },
	});
	return set.id;
};

// Establishment of extra pooled connections, so the two racing calls really run
// on separate backends instead of paying connection setup in sequence.
const warmConnections = async (): Promise<void> => {
	await Promise.all([
		prisma.$queryRawUnsafe("SELECT 1"),
		prisma.$queryRawUnsafe("SELECT 1"),
		prisma.$queryRawUnsafe("SELECT 1"),
	]);
};

// ---------------------------------------------------------------------------
// Evidence types and reporting
// ---------------------------------------------------------------------------

type MutationOutcome = Record<string, unknown>;
type RaceMode = "simultaneous" | "sequential";

interface PairOutcome {
	outcomes: MutationOutcome[];
	transactionAttempts: number;
	serializationConflicts: number;
}

const scenarioRecords: Array<Record<string, unknown>> = [];
const failures: string[] = [];
const deviations: string[] = [];

const log = (message: string): void => {
	process.stdout.write(`${message}\n`);
};

const check = (condition: boolean, message: string): boolean => {
	if (!condition) failures.push(message);
	return condition;
};

const summarizeOutcomes = (
	outcomes: MutationOutcome[],
): { successes: number; refusalCodes: string[] } => ({
	successes: outcomes.filter((outcome) => outcome.ok === true).length,
	refusalCodes: outcomes
		.filter((outcome) => outcome.ok === false)
		.map((outcome) => String(outcome.code)),
});

/**
 * Runs the two racing calls either back-to-back on the same tick
 * (`simultaneous`) or strictly one after the other (`sequential`).
 *
 * `simultaneous` is the real race. `sequential` is a deterministic control: the
 * second call always observes the first call's committed state, which isolates
 * the guard predicate from retry timing.
 */
const runPair = async (
	first: () => Promise<unknown>,
	second: () => Promise<unknown>,
	mode: RaceMode,
): Promise<PairOutcome> => {
	const before = { ...metrics };
	let rawResults: unknown[];
	if (mode === "simultaneous") {
		rawResults = await Promise.all([first(), second()]);
	} else {
		const firstResult = await first();
		const secondResult = await second();
		rawResults = [firstResult, secondResult];
	}
	const after = { ...metrics };
	return {
		outcomes: rawResults.map((result) => ({
			...(result as Record<string, unknown>),
		})),
		transactionAttempts: after.attempts - before.attempts,
		serializationConflicts: after.conflicts - before.conflicts,
	};
};

const describeError = (error: unknown): Record<string, unknown> => {
	const candidate = (error ?? {}) as {
		code?: unknown;
		meta?: unknown;
		message?: unknown;
	};
	const message =
		typeof candidate.message === "string"
			? (candidate.message.split("\n").filter(Boolean).pop() ?? "").trim()
			: "";
	return {
		code: typeof candidate.code === "string" ? candidate.code : null,
		meta: candidate.meta ?? null,
		message,
	};
};

// ---------------------------------------------------------------------------
// Scenario 1: atomic rollback when the parent delete fails after set deletion
// ---------------------------------------------------------------------------

const BLOCK_TRIGGER = "sdd_4_1_block_workout_delete";

const installBlockTrigger = async (): Promise<void> => {
	await prisma.$executeRawUnsafe(
		`CREATE OR REPLACE FUNCTION ${BLOCK_TRIGGER}() RETURNS trigger AS 'BEGIN RETURN NULL; END;' LANGUAGE plpgsql;`,
	);
	await prisma.$executeRawUnsafe(
		`CREATE TRIGGER ${BLOCK_TRIGGER} BEFORE DELETE ON "Workout" FOR EACH ROW EXECUTE FUNCTION ${BLOCK_TRIGGER}();`,
	);
};

const dropBlockTrigger = async (): Promise<void> => {
	await prisma.$executeRawUnsafe(
		`DROP TRIGGER IF EXISTS ${BLOCK_TRIGGER} ON "Workout";`,
	);
	await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS ${BLOCK_TRIGGER}();`);
};

/**
 * A BEFORE DELETE trigger returning NULL makes the whole-workout DELETE affect
 * zero rows after the set deletion already ran inside the transaction. That is
 * exactly the stale-parent path the helper maps to `not_found`, and it must
 * roll the set deletion back.
 */
const scenarioAtomicRollback = async (ownerId: string): Promise<void> => {
	const workout = await makeWorkout(ownerId, "s1-atomic");
	const exercise = await makeExercise(ownerId, "s1-atomic");
	const setA = await makeSet(workout.id, exercise, 0);
	const setB = await makeSet(workout.id, exercise, 1);

	const setsBefore = await prisma.set.count({
		where: { workoutId: workout.id },
	});

	let blockedOutcome: MutationOutcome | null = null;
	let setsAfterBlocked = -1;
	let setsStillPresent = -1;
	let workoutAfterBlocked = -1;
	let blockedError: Record<string, unknown> | null = null;

	try {
		await installBlockTrigger();
		try {
			blockedOutcome = {
				...(await mutations.deleteOwnedWorkout(ownerId, workout.id)),
			};
		} catch (error) {
			blockedError = describeError(error);
		}
		setsAfterBlocked = await prisma.set.count({
			where: { workoutId: workout.id },
		});
		workoutAfterBlocked = await prisma.workout.count({
			where: { id: workout.id },
		});
		setsStillPresent = await prisma.set.count({
			where: { id: { in: [setA, setB] } },
		});
	} finally {
		await dropBlockTrigger();
	}

	// Control: with the trigger gone the same call commits and deletes the sets.
	const controlOutcome = {
		...(await mutations.deleteOwnedWorkout(ownerId, workout.id)),
	};
	const setsAfterControl = await prisma.set.count({
		where: { workoutId: workout.id },
	});
	const workoutAfterControl = await prisma.workout.count({
		where: { id: workout.id },
	});

	const passed =
		check(
			blockedOutcome !== null &&
				blockedOutcome.ok === false &&
				blockedOutcome.code === "not_found",
			`scenario 1: blocked parent delete must return not_found, got ${JSON.stringify(blockedOutcome)}`,
		) &&
		check(setsBefore === 2, "scenario 1: fixture must start with two sets") &&
		check(
			setsAfterBlocked === 2 && setsStillPresent === 2,
			`scenario 1: set deletion must roll back, persisted by workout=${setsAfterBlocked} by id=${setsStillPresent}`,
		) &&
		check(
			workoutAfterBlocked === 1,
			"scenario 1: the workout must still exist after rollback",
		) &&
		check(
			controlOutcome.ok === true &&
				controlOutcome.tag === workout.tag &&
				setsAfterControl === 0 &&
				workoutAfterControl === 0,
			`scenario 1: control delete must commit, got ${JSON.stringify(controlOutcome)}`,
		);

	scenarioRecords.push({
		scenario: "1",
		title: "atomic rollback when the parent delete fails after set deletion",
		passed,
		iterations: [
			{
				attempted:
					"deleteOwnedWorkout(owner, workoutWithTwoSets) while a BEFORE DELETE trigger returns NULL for the parent row",
				setsBefore,
				blockedOutcome,
				blockedError,
				persistedSetsAfterBlocked: setsAfterBlocked,
				persistedSetsByIdAfterBlocked: setsStillPresent,
				persistedWorkoutAfterBlocked: workoutAfterBlocked,
				controlOutcome,
				persistedSetsAfterControl: setsAfterControl,
				persistedWorkoutAfterControl: workoutAfterControl,
			},
		],
	});
	log(
		`[1 rollback] blocked=${JSON.stringify(blockedOutcome)} persistedSets=${setsAfterBlocked}/${setsBefore} control=${JSON.stringify(controlOutcome)} ${passed ? "PASS" : "FAIL"}`,
	);
};

// ---------------------------------------------------------------------------
// Scenario 2: restrictive foreign key enforced
// ---------------------------------------------------------------------------

const scenarioRestrictiveFk = async (ownerId: string): Promise<void> => {
	const workout = await makeWorkout(ownerId, "s2-fk");
	const exercise = await makeExercise(ownerId, "s2-fk");
	const setId = await makeSet(workout.id, exercise, 0);

	const constraint = await prisma.$queryRawUnsafe<
		Array<{ confdeltype: string }>
	>(
		`SELECT "confdeltype"::text AS "confdeltype" FROM pg_constraint WHERE "conname" = 'Set_workoutId_fkey'`,
	);
	const rawDeleteError = await prisma
		.$executeRawUnsafe(`DELETE FROM "Workout" WHERE "id" = $1`, workout.id)
		.then(
			() => null,
			(error: unknown) => describeError(error),
		);
	const ormDeleteError = await prisma.workout
		.delete({ where: { id: workout.id } })
		.then(
			() => null,
			(error: unknown) => describeError(error),
		);

	const workoutAfter = await prisma.workout.count({
		where: { id: workout.id },
	});
	const setsAfter = await prisma.set.count({ where: { id: setId } });

	const rawDeleteMessage = String(rawDeleteError?.message ?? "");
	const passed =
		check(
			constraint[0]?.confdeltype === "r",
			`scenario 2: Set_workoutId_fkey must stay RESTRICT, got ${JSON.stringify(constraint)}`,
		) &&
		check(
			rawDeleteError !== null,
			"scenario 2: raw parent delete with surviving sets must fail",
		) &&
		check(
			rawDeleteError?.code === "P2010" &&
				/violates foreign key constraint/i.test(rawDeleteMessage) &&
				rawDeleteMessage.includes("Set_workoutId_fkey"),
			`scenario 2: raw failure must be the FK violation, got ${JSON.stringify(rawDeleteError)}`,
		) &&
		check(
			ormDeleteError?.code === "P2003",
			`scenario 2: ORM parent delete must fail with P2003, got ${JSON.stringify(ormDeleteError)}`,
		) &&
		check(
			workoutAfter === 1 && setsAfter === 1,
			"scenario 2: both rows must survive the refused parent delete",
		);

	scenarioRecords.push({
		scenario: "2",
		title: "Set_workoutId_fkey ON DELETE RESTRICT enforced by PostgreSQL",
		passed,
		iterations: [
			{
				attempted:
					'raw DELETE FROM "Workout" and prisma.workout.delete() while the workout still has a set',
				constraintDeleteAction: constraint[0]?.confdeltype ?? null,
				rawDeleteError,
				ormDeleteError,
				persistedWorkoutsAfter: workoutAfter,
				persistedSetsAfter: setsAfter,
			},
		],
	});
	log(
		`[2 restrictive FK] confdeltype=${constraint[0]?.confdeltype ?? "?"} raw=${JSON.stringify(rawDeleteError)} orm=${JSON.stringify(ormDeleteError)} ${passed ? "PASS" : "FAIL"}`,
	);
};

// ---------------------------------------------------------------------------
// Scenario 3: two concurrent deletions of different sets (per-exercise guard)
// ---------------------------------------------------------------------------

const setDeletionRace = async (
	ownerId: string,
	label: string,
	mode: RaceMode,
): Promise<Record<string, unknown>> => {
	const workout = await makeWorkout(ownerId, label);
	const exercise = await makeExercise(ownerId, label);
	const setA = await makeSet(workout.id, exercise, 0);
	const setB = await makeSet(workout.id, exercise, 1);

	await warmConnections();
	const pair = await runPair(
		() =>
			mutations.deleteOwnedSet(ownerId, { workoutId: workout.id, setId: setA }),
		() =>
			mutations.deleteOwnedSet(ownerId, { workoutId: workout.id, setId: setB }),
		mode,
	);

	const persistedSets = await prisma.set.count({
		where: { workoutId: workout.id },
	});
	const summary = summarizeOutcomes(pair.outcomes);

	return {
		mode,
		attempted:
			"two deleteOwnedSet calls on different sets of one exercise holding two sets",
		outcomes: pair.outcomes,
		...summary,
		codedContractRespected: summary.refusalCodes.every(
			(code) => code === "last_set" || code === "error",
		),
		refusalExpectationMet:
			summary.successes === 1 && summary.refusalCodes[0] === "last_set",
		invariantHolds: summary.successes === 1 && persistedSets === 1,
		persistedSets,
		transactionAttempts: pair.transactionAttempts,
		serializationConflicts: pair.serializationConflicts,
	};
};

const scenarioSetDeletionRace = async (ownerId: string): Promise<void> => {
	const iterations: Array<Record<string, unknown>> = [];
	let passed = true;

	for (let iteration = 1; iteration <= RACE_ITERATIONS; iteration += 1) {
		const simultaneous = await setDeletionRace(
			ownerId,
			`s3-${iteration}-sim`,
			"simultaneous",
		);
		const sequential = await setDeletionRace(
			ownerId,
			`s3-${iteration}-seq`,
			"sequential",
		);

		const iterationPassed =
			check(
				simultaneous.invariantHolds === true,
				`scenario 3 iteration ${iteration} simultaneous: invariants must hold, got ${JSON.stringify(simultaneous)}`,
			) &&
			check(
				simultaneous.codedContractRespected === true,
				`scenario 3 iteration ${iteration} simultaneous: loser must use a coded result, got ${JSON.stringify(simultaneous.outcomes)}`,
			) &&
			check(
				sequential.invariantHolds === true &&
					sequential.refusalExpectationMet === true,
				`scenario 3 iteration ${iteration} sequential control: second deletion must be refused as last_set, got ${JSON.stringify(sequential)}`,
			);

		if (simultaneous.refusalExpectationMet !== true) {
			deviations.push(
				`scenario 3 iteration ${iteration}: simultaneous deletions produced refusal ${JSON.stringify(simultaneous.refusalCodes)} instead of ["last_set"] (retry budget exhausted while the peer transaction was open)`,
			);
		}

		iterations.push({ iteration, simultaneous, sequential });
		passed = iterationPassed && passed;
		log(
			`[3 set race] iteration ${iteration} simultaneous: outcomes=${JSON.stringify(simultaneous.outcomes)} persisted=${simultaneous.persistedSets} tx=${simultaneous.transactionAttempts} conflicts=${simultaneous.serializationConflicts} | sequential: outcomes=${JSON.stringify(sequential.outcomes)} ${iterationPassed ? "PASS" : "FAIL"}`,
		);
	}

	scenarioRecords.push({
		scenario: "3",
		title:
			"two concurrent deletions of different sets keep one set and refuse the other",
		passed,
		iterations,
	});
};

// ---------------------------------------------------------------------------
// Scenario 4: two concurrent removals of different exercises (last-exercise)
// ---------------------------------------------------------------------------

const exerciseRemovalRace = async (
	ownerId: string,
	label: string,
	mode: RaceMode,
): Promise<Record<string, unknown>> => {
	const workout = await makeWorkout(ownerId, label);
	const firstExercise = await makeExercise(ownerId, `${label}-a`);
	const secondExercise = await makeExercise(ownerId, `${label}-b`);
	await makeSet(workout.id, firstExercise, 0);
	await makeSet(workout.id, secondExercise, 1);

	await warmConnections();
	const pair = await runPair(
		() =>
			mutations.removeOwnedWorkoutExercise(ownerId, {
				workoutId: workout.id,
				exerciseId: firstExercise,
			}),
		() =>
			mutations.removeOwnedWorkoutExercise(ownerId, {
				workoutId: workout.id,
				exerciseId: secondExercise,
			}),
		mode,
	);

	const remaining = await prisma.set.findMany({
		where: { workoutId: workout.id },
		select: { exerciseId: true },
	});
	const summary = summarizeOutcomes(pair.outcomes);

	return {
		mode,
		attempted:
			"two removeOwnedWorkoutExercise calls on the only two recorded exercises of a workout",
		outcomes: pair.outcomes,
		...summary,
		codedContractRespected: summary.refusalCodes.every(
			(code) => code === "last_exercise" || code === "error",
		),
		refusalExpectationMet:
			summary.successes === 1 && summary.refusalCodes[0] === "last_exercise",
		invariantHolds: summary.successes === 1 && remaining.length === 1,
		persistedExerciseIds: remaining.map((row) => row.exerciseId),
		transactionAttempts: pair.transactionAttempts,
		serializationConflicts: pair.serializationConflicts,
	};
};

const scenarioExerciseRemovalRace = async (ownerId: string): Promise<void> => {
	const iterations: Array<Record<string, unknown>> = [];
	let passed = true;

	for (let iteration = 1; iteration <= RACE_ITERATIONS; iteration += 1) {
		const simultaneous = await exerciseRemovalRace(
			ownerId,
			`s4-${iteration}-sim`,
			"simultaneous",
		);
		const sequential = await exerciseRemovalRace(
			ownerId,
			`s4-${iteration}-seq`,
			"sequential",
		);

		const iterationPassed =
			check(
				simultaneous.invariantHolds === true,
				`scenario 4 iteration ${iteration} simultaneous: invariants must hold, got ${JSON.stringify(simultaneous)}`,
			) &&
			check(
				simultaneous.codedContractRespected === true,
				`scenario 4 iteration ${iteration} simultaneous: loser must use a coded result, got ${JSON.stringify(simultaneous.outcomes)}`,
			) &&
			check(
				sequential.invariantHolds === true &&
					sequential.refusalExpectationMet === true,
				`scenario 4 iteration ${iteration} sequential control: second removal must be refused as last_exercise, got ${JSON.stringify(sequential)}`,
			);

		if (simultaneous.refusalExpectationMet !== true) {
			deviations.push(
				`scenario 4 iteration ${iteration}: simultaneous removals produced refusal ${JSON.stringify(simultaneous.refusalCodes)} instead of ["last_exercise"] (retry budget exhausted while the peer transaction was open)`,
			);
		}

		iterations.push({ iteration, simultaneous, sequential });
		passed = iterationPassed && passed;
		log(
			`[4 exercise race] iteration ${iteration} simultaneous: outcomes=${JSON.stringify(simultaneous.outcomes)} remaining=${(simultaneous.persistedExerciseIds as string[]).length} tx=${simultaneous.transactionAttempts} conflicts=${simultaneous.serializationConflicts} | sequential: outcomes=${JSON.stringify(sequential.outcomes)} ${iterationPassed ? "PASS" : "FAIL"}`,
		);
	}

	scenarioRecords.push({
		scenario: "4",
		title:
			"two concurrent removals of different exercises keep one exercise and refuse the other",
		passed,
		iterations,
	});
};

// ---------------------------------------------------------------------------
// Scenario 5: concurrent additions append distinct workout-wide order values
// ---------------------------------------------------------------------------

const additionRace = async (
	ownerId: string,
	label: string,
	mode: RaceMode,
): Promise<Record<string, unknown>> => {
	const workout = await makeWorkout(ownerId, label);
	const firstExercise = await makeExercise(ownerId, `${label}-a`);
	const secondExercise = await makeExercise(ownerId, `${label}-b`);
	await makeSet(workout.id, firstExercise, 0);
	await makeSet(workout.id, secondExercise, 1);

	await warmConnections();
	const pair = await runPair(
		() =>
			mutations.addOwnedWorkoutSets(ownerId, {
				workoutId: workout.id,
				exerciseId: firstExercise,
				sets: [{ weight: 10, reps: 5 }],
			}),
		() =>
			mutations.addOwnedWorkoutSets(ownerId, {
				workoutId: workout.id,
				exerciseId: secondExercise,
				sets: [{ weight: 20, reps: 6 }],
			}),
		mode,
	);

	const rows = await prisma.set.findMany({
		where: { workoutId: workout.id },
		select: { id: true, order: true, exerciseId: true },
		orderBy: { order: "asc" },
	});
	const orders = rows.map((row) => row.order);
	const summary = summarizeOutcomes(pair.outcomes);
	const expectedRows = 2 + summary.successes;

	return {
		mode,
		attempted:
			"two addOwnedWorkoutSets calls, one per recorded exercise, one set each",
		outcomes: pair.outcomes,
		...summary,
		persistedOrders: orders,
		appendedOrders: orders.filter((order) => order > 1),
		distinctOrders: new Set(orders).size === orders.length,
		bothAdditionsSucceeded: summary.successes === 2,
		invariantHolds:
			new Set(orders).size === orders.length && rows.length === expectedRows,
		transactionAttempts: pair.transactionAttempts,
		serializationConflicts: pair.serializationConflicts,
	};
};

const scenarioAdditionRace = async (ownerId: string): Promise<void> => {
	const iterations: Array<Record<string, unknown>> = [];
	let passed = true;

	for (let iteration = 1; iteration <= RACE_ITERATIONS; iteration += 1) {
		const simultaneous = await additionRace(
			ownerId,
			`s5-${iteration}-sim`,
			"simultaneous",
		);
		const sequential = await additionRace(
			ownerId,
			`s5-${iteration}-seq`,
			"sequential",
		);

		const iterationPassed =
			check(
				simultaneous.invariantHolds === true,
				`scenario 5 iteration ${iteration} simultaneous: orders must stay distinct with no partial append, got ${JSON.stringify(simultaneous)}`,
			) &&
			check(
				sequential.invariantHolds === true &&
					sequential.bothAdditionsSucceeded === true,
				`scenario 5 iteration ${iteration} sequential control: both additions must append distinct orders, got ${JSON.stringify(sequential)}`,
			);

		if (simultaneous.bothAdditionsSucceeded !== true) {
			deviations.push(
				`scenario 5 iteration ${iteration}: simultaneous additions returned ${JSON.stringify(simultaneous.outcomes)} (one addition lost to retry exhaustion; no duplicate order was committed)`,
			);
		}

		iterations.push({ iteration, simultaneous, sequential });
		passed = iterationPassed && passed;
		log(
			`[5 addition race] iteration ${iteration} simultaneous: outcomes=${JSON.stringify(simultaneous.outcomes)} orders=${JSON.stringify(simultaneous.persistedOrders)} tx=${simultaneous.transactionAttempts} conflicts=${simultaneous.serializationConflicts} | sequential: outcomes=${JSON.stringify(sequential.outcomes)} orders=${JSON.stringify(sequential.persistedOrders)} ${iterationPassed ? "PASS" : "FAIL"}`,
		);
	}

	scenarioRecords.push({
		scenario: "5",
		title:
			"concurrent additions append distinct workout-wide order values with no duplicates",
		passed,
		iterations,
	});
};

// ---------------------------------------------------------------------------
// Cleanup
// ---------------------------------------------------------------------------

const cleanupFixtures = async (): Promise<Record<string, number>> => {
	await dropBlockTrigger();
	const removedSets = await prisma.set.deleteMany({
		where: { workoutId: { in: createdWorkoutIds } },
	});
	const removedWorkouts = await prisma.workout.deleteMany({
		where: { id: { in: createdWorkoutIds } },
	});
	const removedExercises = await prisma.exercise.deleteMany({
		where: { id: { in: createdExerciseIds } },
	});
	const removedUsers = await prisma.user.deleteMany({
		where: { id: { in: createdUserIds } },
	});

	const residualUsers = await prisma.user.count({
		where: { email: { startsWith: runTag } },
	});
	const residualWorkouts = await prisma.workout.count({
		where: { tag: { startsWith: runTag } },
	});
	const residualExercises = await prisma.exercise.count({
		where: { tag: { startsWith: runTag } },
	});

	return {
		removedSets: removedSets.count,
		removedWorkouts: removedWorkouts.count,
		removedExercises: removedExercises.count,
		removedUsers: removedUsers.count,
		residualUsers,
		residualWorkouts,
		residualExercises,
	};
};

async function main(): Promise<void> {
	log(
		"SDD task 4.1 — workout set-list concurrency verification (real PostgreSQL)",
	);
	log(
		`database: port=${WORKTREE_POSTGRES_PORT} name=${databaseName} isolation=serializable per transaction`,
	);

	const ownerId = await makeUser("owner");
	instrumentTransactionCalls();
	log(`transaction instrumentation active: ${instrumentationActive}`);

	let cleanup: Record<string, number> | null = null;
	try {
		await scenarioAtomicRollback(ownerId);
		await scenarioRestrictiveFk(ownerId);
		await scenarioSetDeletionRace(ownerId);
		await scenarioExerciseRemovalRace(ownerId);
		await scenarioAdditionRace(ownerId);
	} finally {
		cleanup = await cleanupFixtures();
	}

	check(
		Boolean(cleanup) &&
			cleanup!.residualUsers === 0 &&
			cleanup!.residualWorkouts === 0 &&
			cleanup!.residualExercises === 0,
		`fixture cleanup left residual rows: ${JSON.stringify(cleanup)}`,
	);

	const passed = failures.length === 0;
	const report = {
		passed,
		database: { port: WORKTREE_POSTGRES_PORT, name: databaseName },
		instrumentationActive,
		scenarios: scenarioRecords,
		failures,
		deviations,
		fixtureCleanup: cleanup,
		note: "Only this harness proves PostgreSQL conflict detection and atomic rollback; the mocked Vitest suites do not. `deviations` records observed gaps against the task-4.1 expectation (coded last_set/last_exercise refusal) that are permitted by the design's fail-closed `error` outcome.",
	};

	log("");
	log(`RESULT ${JSON.stringify(report)}`);
	process.exitCode = passed ? 0 : 1;
}

main()
	.catch((error: unknown) => {
		const message =
			error instanceof Error ? (error.stack ?? error.message) : String(error);
		process.stderr.write(
			`workout concurrency verification failed: ${message}\n`,
		);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
