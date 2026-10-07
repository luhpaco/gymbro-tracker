import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	deleteOwnedSet: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/data/workout-mutations", () => ({
	deleteOwnedSet: mocks.deleteOwnedSet,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { deleteSet } from "./delete-set";

type DeleteSetPayload = Parameters<typeof deleteSet>[0];

const WORKOUT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const SET_ID = "0f8fad5b-d9cb-469f-a165-70867728950e";
const STORED_TAG = "dia-de-pierna-2026-01-15T00:00:00.000Z";

const buildInput = (
	overrides: Record<string, unknown> = {},
): DeleteSetPayload =>
	({ workoutId: WORKOUT_ID, setId: SET_ID, ...overrides }) as DeleteSetPayload;

describe("deleteSet", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.deleteOwnedSet.mockResolvedValue({ ok: true, tag: STORED_TAG });
	});

	it("returns unauthorized before validating when there is no session", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(
			deleteSet(buildInput({ setId: "not-a-uuid" })),
		).resolves.toEqual({ ok: false, code: "unauthorized" });

		expect(mocks.deleteOwnedSet).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it.each<[string, Record<string, unknown>]>([
		["a malformed workout id", { workoutId: "not-a-uuid" }],
		["a malformed set id", { setId: "not-a-uuid" }],
		["a non-string set id", { setId: 12 }],
		["a missing set id", { setId: undefined }],
	])(
		"returns invalid_input without a lookup or write for %s",
		async (_label, override) => {
			await expect(deleteSet(buildInput(override))).resolves.toEqual({
				ok: false,
				code: "invalid_input",
			});

			expect(mocks.deleteOwnedSet).not.toHaveBeenCalled();
			expect(mocks.revalidatePath).not.toHaveBeenCalled();
		},
	);

	it("delegates both scoping ids with the session user id", async () => {
		await expect(deleteSet(buildInput())).resolves.toEqual({ ok: true });

		// Both the workout and the set id are forwarded: the data layer checks the
		// set belongs to that owned workout, so a set from another workout is not
		// deletable through this owned workout.
		expect(mocks.deleteOwnedSet).toHaveBeenCalledTimes(1);
		expect(mocks.deleteOwnedSet).toHaveBeenCalledWith("user-1", {
			workoutId: WORKOUT_ID,
			setId: SET_ID,
		});
	});

	it("maps a missing set, foreign set or unrelated set to not_found without revalidating", async () => {
		mocks.deleteOwnedSet.mockResolvedValue({ ok: false, code: "not_found" });

		await expect(deleteSet(buildInput())).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns the same not_found for an unrelated set as for a missing one", async () => {
		// A set id owned by a different workout and a set id that does not exist
		// both surface as one data-layer code; the action must not disclose which.
		mocks.deleteOwnedSet.mockResolvedValue({ ok: false, code: "not_found" });

		const unrelatedSet = await deleteSet(buildInput());
		const missingSet = await deleteSet(buildInput());

		expect(unrelatedSet).toEqual({ ok: false, code: "not_found" });
		expect(missingSet).toEqual(unrelatedSet);
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps the last_set refusal to the same code without revalidating", async () => {
		mocks.deleteOwnedSet.mockResolvedValue({ ok: false, code: "last_set" });

		await expect(deleteSet(buildInput())).resolves.toEqual({
			ok: false,
			code: "last_set",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps a failed write to error without revalidating", async () => {
		mocks.deleteOwnedSet.mockResolvedValue({ ok: false, code: "error" });

		await expect(deleteSet(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("revalidates the stored detail route and the list exactly once after a committed deletion", async () => {
		await expect(deleteSet(buildInput())).resolves.toEqual({ ok: true });

		expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
			1,
			`/workouts/${STORED_TAG}`,
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/workouts");
	});

	it("returns error without touching the data layer when auth itself throws", async () => {
		mocks.auth.mockRejectedValue(new Error("headers unavailable"));

		await expect(deleteSet(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.deleteOwnedSet).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns error without revalidating when the data layer throws", async () => {
		mocks.deleteOwnedSet.mockRejectedValue(new Error("database unavailable"));

		await expect(deleteSet(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
