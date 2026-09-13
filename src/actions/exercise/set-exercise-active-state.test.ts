import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	findFirst: vi.fn(),
	update: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
	default: {
		exercise: {
			findFirst: mocks.findFirst,
			update: mocks.update,
		},
	},
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { setExerciseActiveState } from "./set-exercise-active-state";

describe("setExerciseActiveState", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.findFirst.mockResolvedValue({ id: "exercise-1" });
		mocks.update.mockResolvedValue({ id: "exercise-1", isActive: false });
	});

	it("returns unauthorized without querying Prisma when the session is missing", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(
			setExerciseActiveState({ id: "exercise-1", isActive: false }),
		).resolves.toEqual({
			code: "unauthorized",
			ok: false,
		});

		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("returns invalid input without querying Prisma", async () => {
		await expect(
			setExerciseActiveState({ id: "", isActive: false }),
		).resolves.toEqual({
			code: "invalid_input",
			ok: false,
		});

		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("returns not found when the exercise does not exist", async () => {
		mocks.findFirst.mockResolvedValueOnce(null);

		await expect(
			setExerciseActiveState({ id: "missing", isActive: false }),
		).resolves.toEqual({
			code: "not_found",
			ok: false,
		});

		expect(mocks.findFirst).toHaveBeenCalledWith({
			where: { id: "missing", userId: "user-1" },
		});
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("returns not found when the exercise belongs to another user", async () => {
		mocks.findFirst.mockResolvedValueOnce(null);

		await expect(
			setExerciseActiveState({ id: "other-user-exercise", isActive: true }),
		).resolves.toEqual({
			code: "not_found",
			ok: false,
		});

		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("deactivates an owned exercise and revalidates the exercises page", async () => {
		const exercise = { id: "exercise-1", isActive: false };
		mocks.update.mockResolvedValueOnce(exercise);

		await expect(
			setExerciseActiveState({ id: "exercise-1", isActive: false }),
		).resolves.toEqual({
			exercise,
			ok: true,
		});

		expect(mocks.update).toHaveBeenCalledWith({
			data: { isActive: false },
			where: { id: "exercise-1" },
		});
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/exercises");
	});

	it("reactivates an owned inactive exercise", async () => {
		const exercise = { id: "exercise-1", isActive: true };
		mocks.update.mockResolvedValueOnce(exercise);

		await expect(
			setExerciseActiveState({ id: "exercise-1", isActive: true }),
		).resolves.toEqual({
			exercise,
			ok: true,
		});

		expect(mocks.update).toHaveBeenCalledWith({
			data: { isActive: true },
			where: { id: "exercise-1" },
		});
	});

	it("returns error without querying Prisma when auth itself throws", async () => {
		mocks.auth.mockRejectedValueOnce(new Error("headers unavailable"));

		await expect(
			setExerciseActiveState({ id: "exercise-1", isActive: false }),
		).resolves.toEqual({
			code: "error",
			ok: false,
		});

		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.update).not.toHaveBeenCalled();
	});

	it("returns error when the ownership lookup fails", async () => {
		mocks.findFirst.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(
			setExerciseActiveState({ id: "exercise-1", isActive: false }),
		).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});

	it("returns error when the update fails", async () => {
		mocks.update.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(
			setExerciseActiveState({ id: "exercise-1", isActive: false }),
		).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});
});
