import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	findFirst: vi.fn(),
	updateMany: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
	default: {
		workout: {
			findFirst: mocks.findFirst,
			updateMany: mocks.updateMany,
		},
	},
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateWorkout } from "./update-workout";

type UpdateWorkoutPayload = Parameters<typeof updateWorkout>[0];

const WORKOUT_ID = "3f2504e0-4f89-41d3-9a0c-0305e82c3301";
const STORED_TAG = "dia-de-pierna-2026-01-15T00:00:00.000Z";
const PERFORMED_AT = new Date("2026-01-15T00:00:00.000Z");

const buildInput = (
	overrides: Record<string, unknown> = {},
): UpdateWorkoutPayload =>
	({
		workoutId: WORKOUT_ID,
		nameWorkout: "Dia de pierna",
		dateWorkout: PERFORMED_AT,
		...overrides,
	}) as UpdateWorkoutPayload;

describe("updateWorkout", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.findFirst.mockResolvedValue({ id: WORKOUT_ID, tag: STORED_TAG });
		mocks.updateMany.mockResolvedValue({ count: 1 });
	});

	it("returns unauthorized before validating when there is no session", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(
			updateWorkout(buildInput({ workoutId: "not-a-uuid", nameWorkout: "" })),
		).resolves.toEqual({ ok: false, code: "unauthorized" });

		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.updateMany).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it.each<[string, Record<string, unknown>]>([
		["a malformed workout id", { workoutId: "not-a-uuid" }],
		["an empty workout name", { nameWorkout: "" }],
		["a performance date that is not a Date", { dateWorkout: "2026-01-15" }],
	])(
		"returns invalid_input without a lookup or write for %s",
		async (_label, override) => {
			await expect(updateWorkout(buildInput(override))).resolves.toEqual({
				ok: false,
				code: "invalid_input",
			});

			expect(mocks.findFirst).not.toHaveBeenCalled();
			expect(mocks.updateMany).not.toHaveBeenCalled();
			expect(mocks.revalidatePath).not.toHaveBeenCalled();
		},
	);

	it("returns not_found without writing or revalidating for a missing workout", async () => {
		mocks.findFirst.mockResolvedValue(null);

		await expect(updateWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.updateMany).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("scopes the lookup to the owner so a foreign workout is indistinguishable from a missing one", async () => {
		mocks.findFirst.mockResolvedValue(null);

		const result = await updateWorkout(buildInput());

		// The owner-scoped predicate is what collapses "foreign" and "missing"
		// into the same null lookup and therefore the same coded result.
		expect(mocks.findFirst).toHaveBeenCalledWith({
			where: { id: WORKOUT_ID, userId: "user-1" },
			select: { id: true, tag: true },
		});
		expect(result).toEqual({ ok: false, code: "not_found" });
		expect(mocks.updateMany).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns not_found without revalidating when the owner-scoped write affects no rows", async () => {
		mocks.updateMany.mockResolvedValue({ count: 0 });

		await expect(updateWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "not_found",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("writes only the name and date, keeps the stored tag, and revalidates detail plus list exactly once", async () => {
		await expect(
			updateWorkout(buildInput({ nameWorkout: "Dia de pecho" })),
		).resolves.toEqual({ ok: true });

		expect(mocks.updateMany).toHaveBeenCalledTimes(1);
		expect(mocks.updateMany).toHaveBeenCalledWith({
			where: { id: WORKOUT_ID, userId: "user-1" },
			data: { name: "Dia de pecho", date: PERFORMED_AT },
		});
		// A recomputed tag would differ for this name: both the write payload and
		// the revalidation path prove the stored tag was left untouched.
		expect(mocks.updateMany.mock.calls[0][0].data).not.toHaveProperty("tag");

		expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
			1,
			`/workouts/${STORED_TAG}`,
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/workouts");
	});

	it("keeps the stored detail route when only the performance date changes", async () => {
		await expect(
			updateWorkout(
				buildInput({ dateWorkout: new Date("2026-02-20T00:00:00.000Z") }),
			),
		).resolves.toEqual({ ok: true });

		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(
			1,
			`/workouts/${STORED_TAG}`,
		);
		expect(mocks.revalidatePath).toHaveBeenNthCalledWith(2, "/workouts");
	});

	it("returns error without writing or revalidating when the owner lookup fails", async () => {
		mocks.findFirst.mockRejectedValue(new Error("database unavailable"));

		await expect(updateWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.updateMany).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns error without revalidating when the metadata write fails", async () => {
		mocks.updateMany.mockRejectedValue(new Error("database unavailable"));

		await expect(updateWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("rejects a non-string name before any lookup or write", async () => {
		await expect(
			updateWorkout(buildInput({ nameWorkout: 123 })),
		).resolves.toEqual({ ok: false, code: "invalid_input" });

		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.updateMany).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("ignores extra unknown fields and succeeds with valid name and date", async () => {
		await expect(
			updateWorkout(buildInput({ unexpectedField: "ignored", another: 42 })),
		).resolves.toEqual({ ok: true });

		expect(mocks.updateMany).toHaveBeenCalledTimes(1);
		expect(mocks.revalidatePath).toHaveBeenCalledTimes(2);
	});

	it("returns error without touching the database when auth itself throws", async () => {
		mocks.auth.mockRejectedValue(new Error("headers unavailable"));

		await expect(updateWorkout(buildInput())).resolves.toEqual({
			ok: false,
			code: "error",
		});

		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.updateMany).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});
});
