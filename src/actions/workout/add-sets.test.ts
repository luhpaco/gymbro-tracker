import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	addOwnedWorkoutSets: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/data/workout-mutations", () => ({
	addOwnedWorkoutSets: mocks.addOwnedWorkoutSets,
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { addSets } from "./add-sets";

type AddSetsPayload = Parameters<typeof addSets>[0];

const WORKOUT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const EXERCISE_ID = "7c9e6679-7425-40de-944b-e07fc1f90ae7";
const STORED_TAG = "dia-de-pierna-2026-01-15T00:00:00.000Z";

const buildInput = (overrides: Record<string, unknown> = {}): AddSetsPayload =>
	({
		workoutId: WORKOUT_ID,
		exerciseId: EXERCISE_ID,
		sets: [{ weight: 60, reps: 8 }],
		...overrides,
	}) as AddSetsPayload;

describe("addSets", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.addOwnedWorkoutSets.mockResolvedValue({
			ok: true,
			tag: STORED_TAG,
		});
	});

	it("returns unauthorized before validating when there is no session", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(
			addSets(buildInput({ workoutId: "not-a-uuid", sets: [{ reps: 0 }] })),
		).resolves.toEqual({ ok: false, code: "unauthorized" });

		expect(mocks.addOwnedWorkoutSets).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it.each<[string, Record<string, unknown>]>([
		["a malformed workout id", { workoutId: "not-a-uuid" }],
		["a malformed exercise id", { exerciseId: "not-a-uuid" }],
		["a non-string exercise id", { exerciseId: 7 }],
		["an empty set list", { sets: [] }],
		["a zero-repetition set", { sets: [{ weight: 60, reps: 0 }] }],
		["a fractional repetition count", { sets: [{ weight: 60, reps: 1.5 }] }],
		["a blank repetition field", { sets: [{ weight: 60, reps: "" }] }],
		["a negative weight", { sets: [{ weight: -1, reps: 8 }] }],
		["a non-numeric weight", { sets: [{ weight: "heavy", reps: 8 }] }],
	])(
		"returns invalid_input without a lookup or write for %s",
		async (_label, override) => {
			await expect(addSets(buildInput(override))).resolves.toEqual({
				ok: false,
				code: "invalid_input",
			});

			expect(mocks.addOwnedWorkoutSets).not.toHaveBeenCalled();
			expect(mocks.revalidatePath).not.toHaveBeenCalled();
		},
	);

	it("delegates the parsed sets to the owner-scoped data layer", async () => {
		await expect(
			addSets(buildInput({ sets: [{ weight: 62.5, reps: 8 }] })),
		).resolves.toEqual({ ok: true });

		// The action never inspects Exercise.isActive: the recorded-exercise check
		// belongs to the data layer, so an exercise deactivated after being recorded
		// still accepts sets.
		expect(mocks.addOwnedWorkoutSets).toHaveBeenCalledTimes(1);
		expect(mocks.addOwnedWorkoutSets).toHaveBeenCalledWith("user-1", {
			workoutId: WORKOUT_ID,
			exerciseId: EXERCISE_ID,
			sets: [{ weight: 62.5, reps: 8, isWarmup: false }],
		});
	});

	it("ignores a client-supplied order so the data layer owns ordering", async () => {
		await addSets(
			buildInput({
				sets: [
					{ weight: 60, reps: 8, order: 99 },
					{ weight: 65, reps: 6, order: 0 },
				],
			}),
		);

		const [, forwarded] = mocks.addOwnedWorkoutSets.mock.calls[0];
		expect(forwarded.sets).toEqual([
			{ weight: 60, reps: 8, isWarmup: false },
			{ weight: 65, reps: 6, isWarmup: false },
		]);
		expect(forwarded.sets[0]).not.toHaveProperty("order");
	});

	it("forwards a supplied warmup flag and defaults an omitted one to false", async () => {
		await addSets(
			buildInput({
				sets: [
					{ weight: 40, reps: 12, isWarmup: true },
					{ weight: 40, reps: 12 },
				],
			}),
		);

		const [, forwarded] = mocks.addOwnedWorkoutSets.mock.calls[0];
		expect(forwarded.sets).toEqual([
			{ weight: 40, reps: 12, isWarmup: true },
			{ weight: 40, reps: 12, isWarmup: false },
		]);
	});

	it("accepts more than five sets without a cap", async () => {
		const sevenSets = Array.from({ length: 7 }, (_, index) => ({
			weight: 20 + index,
			reps: 10,
		}));

		await expect(addSets(buildInput({ sets: sevenSets }))).resolves.toEqual({
			ok: true,
		});

		const [, forwarded] = mocks.addOwnedWorkoutSets.mock.calls[0];
		expect(forwarded.sets).toHaveLength(7);
	});

	it("maps an unrecorded exercise, missing workout or foreign workout to not_found without revalidating", async () => {
		mocks.addOwnedWorkoutSets.mockResolvedValue({
			ok: false,
			code: "not_found",
		});

		await expect(addSets(buildInput())).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps a failed write to error without revalidating", async () => {
		mocks.addOwnedWorkoutSets.mockResolvedValue({
			ok: false,
			code: "error",
		});

		await expect(addSets(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("revalidates the stored detail route and the list exactly once after a committed addition", async () => {
		await expect(addSets(buildInput())).resolves.toEqual({ ok: true });

		expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
			1,
			`/workouts/${STORED_TAG}`,
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/workouts");
	});

	it("returns error without touching the data layer when auth itself throws", async () => {
		mocks.auth.mockRejectedValue(new Error("headers unavailable"));

		await expect(addSets(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.addOwnedWorkoutSets).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns error without revalidating when the data layer throws", async () => {
		mocks.addOwnedWorkoutSets.mockRejectedValue(
			new Error("database unavailable"),
		);

		await expect(addSets(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
