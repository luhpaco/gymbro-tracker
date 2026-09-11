import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	findFirst: vi.fn(),
	findUnique: vi.fn(),
	create: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
	default: {
		exercise: {
			create: mocks.create,
			findFirst: mocks.findFirst,
		},
		muscleGroup: {
			findUnique: mocks.findUnique,
		},
	},
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { createExercise } from "./create-exercise";

const validInput = {
	description: "Barra plana",
	muscleGroupTag: "chest",
	name: "Press banca",
};

describe("createExercise", () => {
	beforeEach(() => {
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.findUnique.mockResolvedValue({ tag: "chest" });
		mocks.findFirst.mockResolvedValue(null);
		mocks.create.mockResolvedValue({ id: "exercise-1" });
	});

	it("returns error when the muscle-group lookup fails", async () => {
		mocks.findUnique.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});

	it("returns error when the per-user tag lookup fails", async () => {
		mocks.findFirst.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});

	it("returns error when exercise creation fails", async () => {
		mocks.create.mockRejectedValueOnce(new Error("database unavailable"));

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});
});
