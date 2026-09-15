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
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.findUnique.mockResolvedValue({ tag: "chest" });
		mocks.findFirst.mockResolvedValue(null);
		mocks.create.mockResolvedValue({ id: "exercise-1" });
	});

	it("returns unauthorized without querying Prisma when the session is missing", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "unauthorized",
			ok: false,
		});

		expect(mocks.findUnique).not.toHaveBeenCalled();
		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("returns invalid input without querying Prisma", async () => {
		await expect(
			createExercise({
				muscleGroupTag: "chest",
				name: "Bad",
			}),
		).resolves.toEqual({
			code: "invalid_input",
			ok: false,
		});

		expect(mocks.findUnique).not.toHaveBeenCalled();
		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("returns unknown muscle group without looking up tags or creating", async () => {
		mocks.findUnique.mockResolvedValueOnce(null);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "unknown_muscle_group",
			ok: false,
		});

		expect(mocks.findUnique).toHaveBeenCalledWith({
			where: { tag: "chest" },
		});
		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("returns duplicate name without creating an exercise", async () => {
		mocks.findFirst.mockResolvedValueOnce({ id: "existing-exercise" });

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "duplicate_name",
			ok: false,
		});

		expect(mocks.findFirst).toHaveBeenCalledWith({
			where: { canonicalName: "press banca", userId: "user-1" },
		});
		expect(mocks.create).not.toHaveBeenCalled();
	});

	it("creates an exercise with its derived identity and revalidates the exercises page", async () => {
		const exercise = { id: "exercise-1" };
		mocks.create.mockResolvedValueOnce(exercise);

		await expect(createExercise(validInput)).resolves.toEqual({
			exercise,
			ok: true,
		});

		expect(mocks.create).toHaveBeenCalledWith({
			data: {
				canonicalName: "press banca",
				description: "Barra plana",
				muscleGroupTag: "chest",
				name: "Press banca",
				tag: "press-banca",
				userId: "user-1",
			},
		});
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/exercises");
	});

	it("returns error without querying Prisma when auth itself throws", async () => {
		mocks.auth.mockRejectedValueOnce(new Error("headers unavailable"));

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "error",
			ok: false,
		});

		expect(mocks.findUnique).not.toHaveBeenCalled();
		expect(mocks.findFirst).not.toHaveBeenCalled();
		expect(mocks.create).not.toHaveBeenCalled();
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

	it("returns error when global unique validation rejects exercise creation", async () => {
		const globalUniqueViolation = Object.assign(
			new Error("Unique constraint failed on the fields: (`name`)"),
			{ code: "P2002" },
		);
		mocks.create.mockRejectedValueOnce(globalUniqueViolation);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});

	it("returns duplicate name when create throws P2002 with composite array target", async () => {
		const compositeViolation = Object.assign(
			new Error(
				"Unique constraint failed on the fields: (`userId`,`canonicalName`)",
			),
			{ code: "P2002", meta: { target: ["userId", "canonicalName"] } },
		);
		mocks.create.mockRejectedValueOnce(compositeViolation);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "duplicate_name",
			ok: false,
		});
	});

	it("returns duplicate name when create throws P2002 with constraint-name string target", async () => {
		const compositeViolation = Object.assign(
			new Error(
				"Unique constraint failed on the constraint: (`Exercise_userId_canonicalName_key`)",
			),
			{ code: "P2002", meta: { target: "Exercise_userId_canonicalName_key" } },
		);
		mocks.create.mockRejectedValueOnce(compositeViolation);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "duplicate_name",
			ok: false,
		});
	});
});

describe("createExercise normalized-name uniqueness (RED)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.findUnique.mockResolvedValue({ tag: "chest" });
		mocks.findFirst.mockResolvedValue(null);
		mocks.create.mockResolvedValue({ id: "exercise-1" });
	});

	it("pre-checks owner-scoped canonical identity including inactive rows", async () => {
		mocks.findFirst.mockResolvedValueOnce({ id: "existing-exercise" });

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "duplicate_name",
			ok: false,
		});

		expect(mocks.findFirst).toHaveBeenCalledWith({
			where: { canonicalName: "press banca", userId: "user-1" },
		});
		expect(mocks.create).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("persists display name, canonical identity, and legacy tag atomically", async () => {
		const exercise = { id: "exercise-1" };
		mocks.create.mockResolvedValueOnce(exercise);

		await expect(
			createExercise({
				description: "Barra plana",
				muscleGroupTag: "chest",
				name: "  PRESS   banca  ",
			}),
		).resolves.toEqual({ exercise, ok: true });

		expect(mocks.create).toHaveBeenCalledWith({
			data: {
				canonicalName: "press banca",
				description: "Barra plana",
				muscleGroupTag: "chest",
				name: "PRESS banca",
				tag: "press-banca",
				userId: "user-1",
			},
		});
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/exercises");
	});

	it("maps scoped canonical P2002 array target to duplicate_name", async () => {
		const scopedViolation = Object.assign(
			new Error(
				"Unique constraint failed on the fields: (`userId`,`canonicalName`)",
			),
			{ code: "P2002", meta: { target: ["userId", "canonicalName"] } },
		);
		mocks.create.mockRejectedValueOnce(scopedViolation);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "duplicate_name",
			ok: false,
		});
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps scoped canonical P2002 constraint-name target to duplicate_name", async () => {
		const scopedViolation = Object.assign(
			new Error(
				"Unique constraint failed on the constraint: (`Exercise_userId_canonicalName_key`)",
			),
			{ code: "P2002", meta: { target: "Exercise_userId_canonicalName_key" } },
		);
		mocks.create.mockRejectedValueOnce(scopedViolation);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "duplicate_name",
			ok: false,
		});
	});

	it("maps unrelated P2002 targets to error", async () => {
		const otherViolation = Object.assign(
			new Error("Unique constraint failed on the fields: (`name`)"),
			{ code: "P2002", meta: { target: ["name"] } },
		);
		mocks.create.mockRejectedValueOnce(otherViolation);

		await expect(createExercise(validInput)).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});
});
