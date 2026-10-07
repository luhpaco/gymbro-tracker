import { Prisma } from "@prisma/client";

import prisma from "@/lib/prisma";

export interface UpdateWorkoutMetadataInput {
	workoutId: string;
	nameWorkout: string;
	dateWorkout: Date;
}

type UpdateWorkoutMetadataResult =
	{ ok: true; tag: string } | { ok: false; code: "not_found" | "error" };

/**
 * Applies an owner-scoped metadata edit to a saved workout and returns the
 * unchanged stored tag so the caller can revalidate the original detail route.
 *
 * The lookup and the write are both restricted by workout id and owner, so a
 * missing workout and another user's workout collapse into the same null
 * lookup. The affected-row count is checked so a workout removed concurrently
 * becomes `not_found` instead of a reported success.
 */
export const updateOwnedWorkoutMetadata = async (
	userId: string,
	input: UpdateWorkoutMetadataInput,
): Promise<UpdateWorkoutMetadataResult> => {
	try {
		const target = await prisma.workout.findFirst({
			where: { id: input.workoutId, userId },
			select: { id: true, tag: true },
		});
		if (!target) {
			return { ok: false, code: "not_found" };
		}

		const { count } = await prisma.workout.updateMany({
			where: { id: target.id, userId },
			data: { name: input.nameWorkout, date: input.dateWorkout },
		});
		if (count !== 1) {
			return { ok: false, code: "not_found" };
		}

		return { ok: true, tag: target.tag };
	} catch {
		return { ok: false, code: "error" };
	}
};

const MAX_TRANSACTION_ATTEMPTS = 3;

/**
 * Inclusive bounds, in milliseconds, of the jittered wait between retry
 * attempts. The window is deliberately tiny: it only has to outlive the ~1-2 ms
 * peer transaction whose commit caused the conflict. The common single-user
 * path never conflicts, so it never waits at all.
 */
const RETRY_BACKOFF_MIN_MS = 5;
const RETRY_BACKOFF_MAX_MS = 25;

const defaultSleep = (milliseconds: number): Promise<void> =>
	new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * The wait used between retry attempts. Held in module state only so the mocked
 * Vitest suite can inject an immediate replacement and never wait on a real
 * timer; production always uses `defaultSleep`.
 */
let sleepBetweenAttempts = defaultSleep;

/**
 * Test seam: swaps the inter-attempt wait and returns a function that restores
 * the previous one. Production code never calls this.
 */
export const overrideTransactionRetrySleep = (
	sleep: (milliseconds: number) => Promise<void>,
): (() => void) => {
	const previous = sleepBetweenAttempts;
	sleepBetweenAttempts = sleep;
	return () => {
		sleepBetweenAttempts = previous;
	};
};

/**
 * Bounded, jittered wait for the gap after a failed attempt: an integer in
 * [5, 25] ms. The jitter de-correlates two losers that would otherwise retry in
 * lockstep and re-collide. `random` is injectable so the window can be asserted
 * without depending on `Math.random`.
 */
export const computeRetryBackoff = (
	random: () => number = Math.random,
): number =>
	RETRY_BACKOFF_MIN_MS +
	Math.floor(random() * (RETRY_BACKOFF_MAX_MS - RETRY_BACKOFF_MIN_MS + 1));

/**
 * Thrown when a write's affected-row count proves the target disappeared inside
 * the transaction. Throwing is what rolls the transaction back; the caller maps
 * it to `not_found`, and it is never retried.
 */
class StaleTargetError extends Error {}

const isTransactionConflict = (error: unknown): boolean =>
	typeof error === "object" &&
	error !== null &&
	(error as { code?: unknown }).code === "P2034";

/**
 * Runs the operation in a Serializable interactive transaction and retries the
 * whole transaction on a PostgreSQL serialization/write conflict (P2034). The
 * operation re-reads membership and guard counts on every attempt, so a retry
 * observes the state left by the winning transaction. A coded refusal or a stale
 * target is returned/thrown by the operation and is never retried.
 *
 * A short bounded jittered wait separates the attempts: an immediate retry races
 * the still-open peer transaction and exhausts the budget, whereas waiting lets
 * the retry read the winner's committed rows and return the coded
 * `last_set`/`last_exercise` refusal instead of failing closed as `error`. The
 * wait never runs before the first attempt nor after the final one, so an
 * exhausted retry still fails closed without extra latency.
 */
const runSerializableTransaction = async <T>(
	operation: (tx: Prisma.TransactionClient) => Promise<T>,
): Promise<T> => {
	let conflict: unknown;
	for (let attempt = 1; attempt <= MAX_TRANSACTION_ATTEMPTS; attempt++) {
		try {
			return await prisma.$transaction(operation, {
				isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
			});
		} catch (error) {
			if (!isTransactionConflict(error)) throw error;
			conflict = error;
			if (attempt < MAX_TRANSACTION_ATTEMPTS) {
				await sleepBetweenAttempts(computeRetryBackoff());
			}
		}
	}
	throw conflict;
};

/** Maps a transaction failure: a stale target is `not_found`, anything else `error`. */
const mapTransactionFailure = (
	error: unknown,
): { ok: false; code: "not_found" | "error" } =>
	error instanceof StaleTargetError
		? { ok: false, code: "not_found" }
		: { ok: false, code: "error" };

const findOwnedWorkout = (
	tx: Prisma.TransactionClient,
	userId: string,
	workoutId: string,
) =>
	tx.workout.findFirst({
		where: { id: workoutId, userId },
		select: { id: true, tag: true },
	});

type DeleteWorkoutResult =
	{ ok: true; tag: string } | { ok: false; code: "not_found" | "error" };

/**
 * Atomically deletes an owned workout and all of its sets. The sets are removed
 * first because the stored FK is `ON DELETE RESTRICT`; the owner-scoped parent
 * delete then requires exactly one affected row, so a workout that vanished
 * concurrently rolls the whole transaction back instead of committing a partial
 * cleanup. Returns the unchanged stored tag for post-commit cache invalidation.
 */
export const deleteOwnedWorkout = async (
	userId: string,
	workoutId: string,
): Promise<DeleteWorkoutResult> => {
	try {
		return await runSerializableTransaction(async (tx) => {
			const target = await findOwnedWorkout(tx, userId, workoutId);
			if (!target) {
				return { ok: false as const, code: "not_found" as const };
			}

			await tx.set.deleteMany({ where: { workoutId } });
			const { count } = await tx.workout.deleteMany({
				where: { id: workoutId, userId },
			});
			if (count !== 1) {
				throw new StaleTargetError();
			}

			return { ok: true as const, tag: target.tag };
		});
	} catch (error) {
		return mapTransactionFailure(error);
	}
};

export interface DeleteOwnedSetInput {
	workoutId: string;
	setId: string;
}

type DeleteSetResult =
	| { ok: true; tag: string }
	| { ok: false; code: "not_found" | "last_set" | "error" };

/**
 * Deletes one set from an owned workout. The set is located by workout and id,
 * then the guard counts the sets of that set's own exercise: the last remaining
 * set of any recorded exercise is refused as `last_set`, so no exercise is left
 * without history. The conditional delete requires exactly one affected row.
 */
export const deleteOwnedSet = async (
	userId: string,
	input: DeleteOwnedSetInput,
): Promise<DeleteSetResult> => {
	try {
		return await runSerializableTransaction(async (tx) => {
			const target = await findOwnedWorkout(tx, userId, input.workoutId);
			if (!target) {
				return { ok: false as const, code: "not_found" as const };
			}

			const set = await tx.set.findFirst({
				where: { id: input.setId, workoutId: input.workoutId },
				select: { id: true, exerciseId: true },
			});
			if (!set) {
				return { ok: false as const, code: "not_found" as const };
			}

			const remaining = await tx.set.count({
				where: {
					workoutId: input.workoutId,
					exerciseId: set.exerciseId,
				},
			});
			if (remaining === 1) {
				return { ok: false as const, code: "last_set" as const };
			}

			const { count } = await tx.set.deleteMany({
				where: { id: set.id, workoutId: input.workoutId },
			});
			if (count !== 1) {
				throw new StaleTargetError();
			}

			return { ok: true as const, tag: target.tag };
		});
	} catch (error) {
		return mapTransactionFailure(error);
	}
};

export interface RemoveOwnedWorkoutExerciseInput {
	workoutId: string;
	exerciseId: string;
}

type RemoveWorkoutExerciseResult =
	| { ok: true; tag: string }
	| { ok: false; code: "not_found" | "last_exercise" | "error" };

/**
 * Removes an exercise and its sets from an owned workout only. The exercise
 * must already be recorded there; the guard counts sets belonging to other
 * exercises and refuses the workout's final exercise as `last_exercise`. The
 * global exercise row and its sets in other workouts are never touched.
 */
export const removeOwnedWorkoutExercise = async (
	userId: string,
	input: RemoveOwnedWorkoutExerciseInput,
): Promise<RemoveWorkoutExerciseResult> => {
	try {
		return await runSerializableTransaction(async (tx) => {
			const target = await findOwnedWorkout(tx, userId, input.workoutId);
			if (!target) {
				return { ok: false as const, code: "not_found" as const };
			}

			const recorded = await tx.set.findFirst({
				where: {
					workoutId: input.workoutId,
					exerciseId: input.exerciseId,
				},
				select: { id: true },
			});
			if (!recorded) {
				return { ok: false as const, code: "not_found" as const };
			}

			const otherExercises = await tx.set.count({
				where: {
					workoutId: input.workoutId,
					exerciseId: { not: input.exerciseId },
				},
			});
			if (otherExercises === 0) {
				return { ok: false as const, code: "last_exercise" as const };
			}

			const { count } = await tx.set.deleteMany({
				where: {
					workoutId: input.workoutId,
					exerciseId: input.exerciseId,
				},
			});
			if (count === 0) {
				throw new StaleTargetError();
			}

			return { ok: true as const, tag: target.tag };
		});
	} catch (error) {
		return mapTransactionFailure(error);
	}
};

export interface AddOwnedWorkoutSetsInput {
	workoutId: string;
	exerciseId: string;
	sets: Array<{ weight: number; reps: number; isWarmup?: boolean }>;
}

type AddWorkoutSetsResult =
	{ ok: true; tag: string } | { ok: false; code: "not_found" | "error" };

/**
 * Appends sets to an exercise already recorded in an owned workout. The active
 * state of the exercise is irrelevant: deactivation never discards history. New
 * rows are projected from the parsed set values plus server-owned workout,
 * exercise and `max + 1 + index` order, so a client-supplied order is ignored
 * and surviving gaps are preserved rather than renumbered.
 */
export const addOwnedWorkoutSets = async (
	userId: string,
	input: AddOwnedWorkoutSetsInput,
): Promise<AddWorkoutSetsResult> => {
	try {
		return await runSerializableTransaction(async (tx) => {
			const target = await findOwnedWorkout(tx, userId, input.workoutId);
			if (!target) {
				return { ok: false as const, code: "not_found" as const };
			}

			const recorded = await tx.set.findFirst({
				where: {
					workoutId: input.workoutId,
					exerciseId: input.exerciseId,
				},
				select: { id: true },
			});
			if (!recorded) {
				return { ok: false as const, code: "not_found" as const };
			}

			const greatest = await tx.set.aggregate({
				where: { workoutId: input.workoutId },
				_max: { order: true },
			});
			const highestOrder = greatest._max.order ?? -1;

			await tx.set.createMany({
				data: input.sets.map((set, index) => ({
					workoutId: input.workoutId,
					exerciseId: input.exerciseId,
					order: highestOrder + 1 + index,
					weight: set.weight,
					reps: set.reps,
					isWarmup: set.isWarmup ?? false,
				})),
			});

			return { ok: true as const, tag: target.tag };
		});
	} catch {
		return { ok: false, code: "error" };
	}
};
