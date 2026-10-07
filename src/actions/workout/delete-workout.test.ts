import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	deleteOwnedWorkout: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/data/workout-mutations", () => ({
	deleteOwnedWorkout: mocks.deleteOwnedWorkout,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { deleteWorkout } from "./delete-workout";

type DeleteWorkoutPayload = Parameters<typeof deleteWorkout>[0];

const WORKOUT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const STORED_TAG = "dia-de-pierna-2026-01-15T00:00:00.000Z";

const buildInput = (
	overrides: Record<string, unknown> = {},
): DeleteWorkoutPayload =>
	({ workoutId: WORKOUT_ID, ...overrides }) as DeleteWorkoutPayload;

describe("deleteWorkout", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.deleteOwnedWorkout.mockResolvedValue({ ok: true, tag: STORED_TAG });
	});

	it("returns unauthorized before validating when there is no session", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(
			deleteWorkout(buildInput({ workoutId: "not-a-uuid" })),
		).resolves.toEqual({ ok: false, code: "unauthorized" });

		expect(mocks.deleteOwnedWorkout).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it.each<[string, Record<string, unknown>]>([
		["a malformed workout id", { workoutId: "not-a-uuid" }],
		["a workout id that is not a string", { workoutId: 42 }],
		["an empty workout id", { workoutId: "" }],
	])(
		"returns invalid_input without a lookup or write for %s",
		async (_label, override) => {
			await expect(deleteWorkout(buildInput(override))).resolves.toEqual({
				ok: false,
				code: "invalid_input",
			});

			expect(mocks.deleteOwnedWorkout).not.toHaveBeenCalled();
			expect(mocks.revalidatePath).not.toHaveBeenCalled();
		},
	);

	it("returns invalid_input when the workout id is missing entirely", async () => {
		await expect(deleteWorkout({} as DeleteWorkoutPayload)).resolves.toEqual({
			ok: false,
			code: "invalid_input",
		});

		expect(mocks.deleteOwnedWorkout).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("delegates the delete with the session user id so ownership is enforced by the data layer", async () => {
		await expect(deleteWorkout(buildInput())).resolves.toEqual({ ok: true });

		// The owner-scoped delegation is what collapses a foreign workout and a
		// missing workout into the same data-layer result; the action adds no
		// distinguishing lookup of its own.
		expect(mocks.deleteOwnedWorkout).toHaveBeenCalledTimes(1);
		expect(mocks.deleteOwnedWorkout).toHaveBeenCalledWith("user-1", WORKOUT_ID);
	});

	it("maps a missing or foreign workout to not_found without revalidating", async () => {
		mocks.deleteOwnedWorkout.mockResolvedValue({
			ok: false,
			code: "not_found",
		});

		await expect(deleteWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns the same not_found for a foreign workout as for a missing one", async () => {
		// Missing and foreign targets are indistinguishable to the caller: the
		// owner-scoped data-layer lookup returns one code for both, and the action
		// must not disclose which case occurred.
		mocks.deleteOwnedWorkout.mockResolvedValue({
			ok: false,
			code: "not_found",
		});

		const foreignAttempt = await deleteWorkout(buildInput());
		const missingAttempt = await deleteWorkout(buildInput());

		expect(foreignAttempt).toEqual({ ok: false, code: "not_found" });
		expect(missingAttempt).toEqual(foreignAttempt);
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps a failed delete to error without revalidating", async () => {
		mocks.deleteOwnedWorkout.mockResolvedValue({ ok: false, code: "error" });

		await expect(deleteWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("revalidates the stored detail route and the list exactly once after a committed delete", async () => {
		await expect(deleteWorkout(buildInput())).resolves.toEqual({ ok: true });

		expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
			1,
			`/workouts/${STORED_TAG}`,
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/workouts");
	});

	it("returns error without touching the data layer when auth itself throws", async () => {
		mocks.auth.mockRejectedValue(new Error("headers unavailable"));

		await expect(deleteWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.deleteOwnedWorkout).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns error without revalidating when the data layer throws", async () => {
		mocks.deleteOwnedWorkout.mockRejectedValue(
			new Error("database unavailable"),
		);

		await expect(deleteWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
