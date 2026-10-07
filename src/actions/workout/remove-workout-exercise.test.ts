import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	removeOwnedWorkoutExercise: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/data/workout-mutations", () => ({
	removeOwnedWorkoutExercise: mocks.removeOwnedWorkoutExercise,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { removeWorkoutExercise } from "./remove-workout-exercise";

type RemoveWorkoutExercisePayload = Parameters<typeof removeWorkoutExercise>[0];

const WORKOUT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EXERCISE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const STORED_TAG = "dia-de-pierna-2026-01-15T00:00:00.000Z";

const buildInput = (
	overrides: Record<string, unknown> = {},
): RemoveWorkoutExercisePayload =>
	({
		workoutId: WORKOUT_ID,
		exerciseId: EXERCISE_ID,
		...overrides,
	}) as RemoveWorkoutExercisePayload;

describe("removeWorkoutExercise", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.removeOwnedWorkoutExercise.mockResolvedValue({
			ok: true,
			tag: STORED_TAG,
		});
	});

	it("returns unauthorized before validating when there is no session", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(
			removeWorkoutExercise(buildInput({ exerciseId: "not-a-uuid" })),
		).resolves.toEqual({ ok: false, code: "unauthorized" });

		expect(mocks.removeOwnedWorkoutExercise).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it.each<[string, Record<string, unknown>]>([
		["a malformed workout id", { workoutId: "not-a-uuid" }],
		["a malformed exercise id", { exerciseId: "not-a-uuid" }],
		["a non-string exercise id", { exerciseId: 7 }],
		["a missing exercise id", { exerciseId: undefined }],
	])(
		"returns invalid_input without a lookup or write for %s",
		async (_label, override) => {
			await expect(
				removeWorkoutExercise(buildInput(override)),
			).resolves.toEqual({ ok: false, code: "invalid_input" });

			expect(mocks.removeOwnedWorkoutExercise).not.toHaveBeenCalled();
			expect(mocks.revalidatePath).not.toHaveBeenCalled();
		},
	);

	it("delegates both scoping ids with the session user id", async () => {
		await expect(removeWorkoutExercise(buildInput())).resolves.toEqual({
			ok: true,
		});

		// The exercise is identified by workout + exercise id only, so the data
		// layer can refuse an exercise never recorded in that owned workout and can
		// leave the same exercise's history in other workouts untouched.
		expect(mocks.removeOwnedWorkoutExercise).toHaveBeenCalledTimes(1);
		expect(mocks.removeOwnedWorkoutExercise).toHaveBeenCalledWith("user-1", {
			workoutId: WORKOUT_ID,
			exerciseId: EXERCISE_ID,
		});
	});

	it("maps a missing exercise, unrecorded exercise or foreign workout to not_found without revalidating", async () => {
		mocks.removeOwnedWorkoutExercise.mockResolvedValue({
			ok: false,
			code: "not_found",
		});

		await expect(removeWorkoutExercise(buildInput())).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns the same not_found for an exercise of another workout as for an unrecorded one", async () => {
		// An exercise recorded only in a different workout and an exercise never
		// recorded in this owned workout share one data-layer code; the action must
		// not disclose which case occurred.
		mocks.removeOwnedWorkoutExercise.mockResolvedValue({
			ok: false,
			code: "not_found",
		});

		const crossWorkout = await removeWorkoutExercise(buildInput());
		const unrecorded = await removeWorkoutExercise(buildInput());

		expect(crossWorkout).toEqual({ ok: false, code: "not_found" });
		expect(unrecorded).toEqual(crossWorkout);
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps the last_exercise refusal to the same code without revalidating", async () => {
		mocks.removeOwnedWorkoutExercise.mockResolvedValue({
			ok: false,
			code: "last_exercise",
		});

		await expect(removeWorkoutExercise(buildInput())).resolves.toEqual({
			ok: false,
			code: "last_exercise",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps a failed write to error without revalidating", async () => {
		mocks.removeOwnedWorkoutExercise.mockResolvedValue({
			ok: false,
			code: "error",
		});

		await expect(removeWorkoutExercise(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("revalidates the stored detail route and the list exactly once after a committed removal", async () => {
		await expect(removeWorkoutExercise(buildInput())).resolves.toEqual({
			ok: true,
		});

		expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
			1,
			`/workouts/${STORED_TAG}`,
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/workouts");
	});

	it("returns error without touching the data layer when auth itself throws", async () => {
		mocks.auth.mockRejectedValue(new Error("headers unavailable"));

		await expect(removeWorkoutExercise(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.removeOwnedWorkoutExercise).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns error without revalidating when the data layer throws", async () => {
		mocks.removeOwnedWorkoutExercise.mockRejectedValue(
			new Error("database unavailable"),
		);

		await expect(removeWorkoutExercise(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
