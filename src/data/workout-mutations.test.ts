import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
	const tx = {
		workout: { findFirst: vi.fn(), deleteMany: vi.fn() },
		set: {
			findFirst: vi.fn(),
			count: vi.fn(),
			deleteMany: vi.fn(),
			aggregate: vi.fn(),
			createMany: vi.fn(),
		},
	};

	return {
		tx,
		transaction: vi.fn(),
		outcomes: [] as string[],
	};
});

vi.mock("@/lib/prisma", () => ({
	default: { $transaction: mocks.transaction },
}));

import {
	addOwnedWorkoutSets,
	deleteOwnedSet,
	deleteOwnedWorkout,
	removeOwnedWorkoutExercise,
} from "./workout-mutations";

const USER_ID = "user-1";
const WORKOUT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const SET_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const EXERCISE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const STORED_TAG = "dia-de-pierna-2026-01-15T00:00:00.000Z";

type TransactionCallback = (tx: typeof mocks.tx) => unknown;

// The mock cannot prove PostgreSQL's serialization or real rollback behavior.
// It records whether the callback returned (commit requested) or threw (rollback
// requested), so the tests can assert the transaction boundary the code asks for.
const runCallback = async (callback: TransactionCallback) => {
	try {
		const result = await callback(mocks.tx);
		mocks.outcomes.push("committed");
		return result;
	} catch (error) {
		mocks.outcomes.push("rolled_back");
		throw error;
	}
};

const conflictError = () =>
	Object.assign(new Error("write conflict"), { code: "P2034" });

const failOnceWithConflict = () => {
	let attempt = 0;
	mocks.transaction.mockImplementation(
		async (callback: TransactionCallback) => {
			attempt += 1;
			// A serializable conflict surfaces when the transaction commits, after its
			// reads and writes already ran, so the callback runs before the abort.
			const result = await callback(mocks.tx);
			if (attempt === 1) {
				mocks.outcomes.push("rolled_back");
				throw conflictError();
			}
			mocks.outcomes.push("committed");
			return result;
		},
	);
};

const alwaysConflict = () => {
	mocks.transaction.mockImplementation(async () => {
		throw conflictError();
	});
};

beforeEach(() => {
	vi.clearAllMocks();
	mocks.outcomes.length = 0;

	mocks.tx.workout.findFirst.mockResolvedValue({
		id: WORKOUT_ID,
		tag: STORED_TAG,
	});
	mocks.tx.workout.deleteMany.mockResolvedValue({ count: 1 });
	mocks.tx.set.findFirst.mockResolvedValue({
		id: SET_ID,
		exerciseId: EXERCISE_ID,
	});
	mocks.tx.set.count.mockResolvedValue(2);
	mocks.tx.set.deleteMany.mockResolvedValue({ count: 1 });
	mocks.tx.set.aggregate.mockResolvedValue({ _max: { order: -1 } });
	mocks.tx.set.createMany.mockResolvedValue({ count: 1 });
	mocks.transaction.mockImplementation(runCallback);
});

describe("deleteOwnedWorkout", () => {
	it("runs one Serializable transaction that deletes the sets before the owner-scoped parent", async () => {
		await expect(deleteOwnedWorkout(USER_ID, WORKOUT_ID)).resolves.toEqual({
			ok: true,
			tag: STORED_TAG,
		});

		expect(mocks.transaction).toHaveBeenCalledTimes(1);
		expect(mocks.transaction.mock.calls[0][1]).toEqual({
			isolationLevel: "Serializable",
		});
		expect(mocks.tx.set.deleteMany).toHaveBeenCalledWith({
			where: { workoutId: WORKOUT_ID },
		});
		expect(mocks.tx.workout.deleteMany).toHaveBeenCalledWith({
			where: { id: WORKOUT_ID, userId: USER_ID },
		});
		expect(mocks.tx.set.deleteMany.mock.invocationCallOrder[0]).toBeLessThan(
			mocks.tx.workout.deleteMany.mock.invocationCallOrder[0],
		);
		expect(mocks.outcomes).toEqual(["committed"]);
	});

	it("scopes the lookup to the owner so a foreign or missing workout never deletes", async () => {
		mocks.tx.workout.findFirst.mockResolvedValue(null);

		await expect(deleteOwnedWorkout(USER_ID, WORKOUT_ID)).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.tx.workout.findFirst).toHaveBeenCalledWith({
			where: { id: WORKOUT_ID, userId: USER_ID },
			select: { id: true, tag: true },
		});
		expect(mocks.tx.set.deleteMany).not.toHaveBeenCalled();
		expect(mocks.tx.workout.deleteMany).not.toHaveBeenCalled();
		// A known not_found is never retried.
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
	});

	it("rolls the whole transaction back and reports not_found when the parent delete affects no row", async () => {
		mocks.tx.workout.deleteMany.mockResolvedValue({ count: 0 });

		await expect(deleteOwnedWorkout(USER_ID, WORKOUT_ID)).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.tx.set.deleteMany).toHaveBeenCalledTimes(1);
		expect(mocks.outcomes).toEqual(["rolled_back"]);
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
	});

	it("returns error without retrying when a write fails", async () => {
		mocks.tx.set.deleteMany.mockRejectedValue(
			new Error("database unavailable"),
		);

		await expect(deleteOwnedWorkout(USER_ID, WORKOUT_ID)).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.transaction).toHaveBeenCalledTimes(1);
		expect(mocks.outcomes).toEqual(["rolled_back"]);
	});

	it("retries the entire transaction on P2034 and re-reads the owned workout", async () => {
		failOnceWithConflict();

		await expect(deleteOwnedWorkout(USER_ID, WORKOUT_ID)).resolves.toEqual({
			ok: true,
			tag: STORED_TAG,
		});

		expect(mocks.transaction).toHaveBeenCalledTimes(2);
		expect(mocks.tx.workout.findFirst).toHaveBeenCalledTimes(2);
	});

	it("maps an exhausted bounded retry to error", async () => {
		alwaysConflict();

		await expect(deleteOwnedWorkout(USER_ID, WORKOUT_ID)).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.transaction).toHaveBeenCalledTimes(3);
	});
});

describe("deleteOwnedSet", () => {
	it("reads the guard for the located set's exercise and deletes only that set under Serializable", async () => {
		await expect(
			deleteOwnedSet(USER_ID, { workoutId: WORKOUT_ID, setId: SET_ID }),
		).resolves.toEqual({ ok: true, tag: STORED_TAG });

		expect(mocks.transaction.mock.calls[0][1]).toEqual({
			isolationLevel: "Serializable",
		});
		expect(mocks.tx.set.findFirst).toHaveBeenCalledWith({
			where: { id: SET_ID, workoutId: WORKOUT_ID },
			select: { id: true, exerciseId: true },
		});
		expect(mocks.tx.set.count).toHaveBeenCalledWith({
			where: { workoutId: WORKOUT_ID, exerciseId: EXERCISE_ID },
		});
		expect(mocks.tx.set.deleteMany).toHaveBeenCalledWith({
			where: { id: SET_ID, workoutId: WORKOUT_ID },
		});
	});

	it("refuses the final set of its exercise without deleting or retrying", async () => {
		mocks.tx.set.count.mockResolvedValue(1);

		await expect(
			deleteOwnedSet(USER_ID, { workoutId: WORKOUT_ID, setId: SET_ID }),
		).resolves.toEqual({ ok: false, code: "last_set" });

		expect(mocks.tx.set.deleteMany).not.toHaveBeenCalled();
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
	});

	it("returns not_found without counting when the set is not in the owned workout", async () => {
		mocks.tx.set.findFirst.mockResolvedValue(null);

		await expect(
			deleteOwnedSet(USER_ID, { workoutId: WORKOUT_ID, setId: SET_ID }),
		).resolves.toEqual({ ok: false, code: "not_found" });

		expect(mocks.tx.set.count).not.toHaveBeenCalled();
		expect(mocks.tx.set.deleteMany).not.toHaveBeenCalled();
	});

	it("returns not_found without a set read when the workout is foreign or missing", async () => {
		mocks.tx.workout.findFirst.mockResolvedValue(null);

		await expect(
			deleteOwnedSet(USER_ID, { workoutId: WORKOUT_ID, setId: SET_ID }),
		).resolves.toEqual({ ok: false, code: "not_found" });

		expect(mocks.tx.set.findFirst).not.toHaveBeenCalled();
	});

	it("rolls back and reports not_found when the conditional delete affects no row", async () => {
		mocks.tx.set.deleteMany.mockResolvedValue({ count: 0 });

		await expect(
			deleteOwnedSet(USER_ID, { workoutId: WORKOUT_ID, setId: SET_ID }),
		).resolves.toEqual({ ok: false, code: "not_found" });

		expect(mocks.outcomes).toEqual(["rolled_back"]);
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
	});

	it("retries on P2034 and re-reads the guard count on the new attempt", async () => {
		failOnceWithConflict();

		await expect(
			deleteOwnedSet(USER_ID, { workoutId: WORKOUT_ID, setId: SET_ID }),
		).resolves.toEqual({ ok: true, tag: STORED_TAG });

		expect(mocks.transaction).toHaveBeenCalledTimes(2);
		expect(mocks.tx.set.count).toHaveBeenCalledTimes(2);
	});
});

describe("removeOwnedWorkoutExercise", () => {
	it("refuses the final exercise when no sets remain for other exercises", async () => {
		mocks.tx.set.count.mockResolvedValue(0);

		await expect(
			removeOwnedWorkoutExercise(USER_ID, {
				workoutId: WORKOUT_ID,
				exerciseId: EXERCISE_ID,
			}),
		).resolves.toEqual({ ok: false, code: "last_exercise" });

		expect(mocks.tx.set.count).toHaveBeenCalledWith({
			where: { workoutId: WORKOUT_ID, exerciseId: { not: EXERCISE_ID } },
		});
		expect(mocks.tx.set.deleteMany).not.toHaveBeenCalled();
		expect(mocks.transaction).toHaveBeenCalledTimes(1);
	});

	it("deletes only the recorded exercise's sets and keeps the stored tag", async () => {
		await expect(
			removeOwnedWorkoutExercise(USER_ID, {
				workoutId: WORKOUT_ID,
				exerciseId: EXERCISE_ID,
			}),
		).resolves.toEqual({ ok: true, tag: STORED_TAG });

		expect(mocks.tx.set.findFirst).toHaveBeenCalledWith({
			where: { workoutId: WORKOUT_ID, exerciseId: EXERCISE_ID },
			select: { id: true },
		});
		expect(mocks.tx.set.deleteMany).toHaveBeenCalledWith({
			where: { workoutId: WORKOUT_ID, exerciseId: EXERCISE_ID },
		});
	});

	it("returns not_found when the exercise was never recorded in the owned workout", async () => {
		mocks.tx.set.findFirst.mockResolvedValue(null);

		await expect(
			removeOwnedWorkoutExercise(USER_ID, {
				workoutId: WORKOUT_ID,
				exerciseId: EXERCISE_ID,
			}),
		).resolves.toEqual({ ok: false, code: "not_found" });

		expect(mocks.tx.set.count).not.toHaveBeenCalled();
		expect(mocks.tx.set.deleteMany).not.toHaveBeenCalled();
	});

	it("rolls back and reports not_found when the conditional delete affects no row", async () => {
		mocks.tx.set.deleteMany.mockResolvedValue({ count: 0 });

		await expect(
			removeOwnedWorkoutExercise(USER_ID, {
				workoutId: WORKOUT_ID,
				exerciseId: EXERCISE_ID,
			}),
		).resolves.toEqual({ ok: false, code: "not_found" });

		expect(mocks.outcomes).toEqual(["rolled_back"]);
	});
});

type AddSetsInput = Parameters<typeof addOwnedWorkoutSets>[1];

const buildAddInput = (
	sets: unknown[],
	overrides: Record<string, unknown> = {},
): AddSetsInput =>
	({
		workoutId: WORKOUT_ID,
		exerciseId: EXERCISE_ID,
		sets,
		...overrides,
	}) as unknown as AddSetsInput;

describe("addOwnedWorkoutSets", () => {
	it("assigns max + 1 + index order, preserves gaps, and ignores a client order", async () => {
		mocks.tx.set.aggregate.mockResolvedValue({ _max: { order: 3 } });

		await expect(
			addOwnedWorkoutSets(
				USER_ID,
				buildAddInput([
					{ weight: 60, reps: 8, isWarmup: false, order: 0 },
					{ weight: 65, reps: 6, isWarmup: true, order: 1 },
				]),
			),
		).resolves.toEqual({ ok: true, tag: STORED_TAG });

		expect(mocks.transaction.mock.calls[0][1]).toEqual({
			isolationLevel: "Serializable",
		});
		expect(mocks.tx.set.aggregate).toHaveBeenCalledWith({
			where: { workoutId: WORKOUT_ID },
			_max: { order: true },
		});
		// Server order continues after the greatest stored value (4, 5) and the
		// client-supplied 0/1 never reach persistence.
		expect(mocks.tx.set.createMany).toHaveBeenCalledWith({
			data: [
				{
					workoutId: WORKOUT_ID,
					exerciseId: EXERCISE_ID,
					order: 4,
					weight: 60,
					reps: 8,
					isWarmup: false,
				},
				{
					workoutId: WORKOUT_ID,
					exerciseId: EXERCISE_ID,
					order: 5,
					weight: 65,
					reps: 6,
					isWarmup: true,
				},
			],
		});
	});

	it("persists a submitted warmup flag and defaults an omitted one to false", async () => {
		mocks.tx.set.aggregate.mockResolvedValue({ _max: { order: 9 } });

		await addOwnedWorkoutSets(
			USER_ID,
			buildAddInput([
				{ weight: 40, reps: 12, isWarmup: true },
				{ weight: 40, reps: 12 },
			]),
		);

		const rows = mocks.tx.set.createMany.mock.calls[0][0].data;
		expect(rows.map((row: { isWarmup: boolean }) => row.isWarmup)).toEqual([
			true,
			false,
		]);
	});

	it("adds to a recorded exercise without filtering on active state and without a set cap", async () => {
		const sevenSets = Array.from({ length: 7 }, (_, index) => ({
			weight: 20 + index,
			reps: 10,
		}));

		await expect(
			addOwnedWorkoutSets(USER_ID, buildAddInput(sevenSets)),
		).resolves.toEqual({ ok: true, tag: STORED_TAG });

		// Membership is proven only by workout + exercise; Exercise.isActive is
		// never consulted, so a deactivated but recorded exercise still accepts sets.
		expect(mocks.tx.set.findFirst).toHaveBeenCalledWith({
			where: { workoutId: WORKOUT_ID, exerciseId: EXERCISE_ID },
			select: { id: true },
		});
		const rows = mocks.tx.set.createMany.mock.calls[0][0].data;
		expect(rows).toHaveLength(7);
		expect(rows.map((row: { order: number }) => row.order)).toEqual([
			0, 1, 2, 3, 4, 5, 6,
		]);
	});

	it("returns not_found without reading the maximum when the exercise is not recorded", async () => {
		mocks.tx.set.findFirst.mockResolvedValue(null);

		await expect(
			addOwnedWorkoutSets(USER_ID, buildAddInput([{ weight: 60, reps: 8 }])),
		).resolves.toEqual({ ok: false, code: "not_found" });

		expect(mocks.tx.set.aggregate).not.toHaveBeenCalled();
		expect(mocks.tx.set.createMany).not.toHaveBeenCalled();
	});

	it("retries the entire transaction on P2034 and re-reads the maximum order", async () => {
		failOnceWithConflict();

		await expect(
			addOwnedWorkoutSets(USER_ID, buildAddInput([{ weight: 60, reps: 8 }])),
		).resolves.toEqual({ ok: true, tag: STORED_TAG });

		expect(mocks.transaction).toHaveBeenCalledTimes(2);
		expect(mocks.tx.set.aggregate).toHaveBeenCalledTimes(2);
	});

	it("maps an exhausted bounded retry to error without reporting success", async () => {
		alwaysConflict();

		await expect(
			addOwnedWorkoutSets(USER_ID, buildAddInput([{ weight: 60, reps: 8 }])),
		).resolves.toEqual({ ok: false, code: "error" });

		expect(mocks.transaction).toHaveBeenCalledTimes(3);
		expect(mocks.tx.set.createMany).not.toHaveBeenCalled();
	});
});
