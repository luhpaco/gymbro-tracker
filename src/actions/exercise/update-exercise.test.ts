import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	auth: vi.fn(),
	exerciseFindFirst: vi.fn(),
	exerciseUpdate: vi.fn(),
	muscleFindUnique: vi.fn(),
	revalidatePath: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));

vi.mock("@/lib/prisma", () => ({
	default: {
		exercise: {
			findFirst: mocks.exerciseFindFirst,
			update: mocks.exerciseUpdate,
		},
		muscleGroup: {
			findUnique: mocks.muscleFindUnique,
		},
	},
}));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

import { updateExercise } from "./update-exercise";

const validInput = {
	description: "Barra plana",
	id: "exercise-1",
	muscleGroupTag: "chest",
	name: "Press banca",
};

describe("updateExercise normalized-name uniqueness (RED)", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.auth.mockResolvedValue({ user: { id: "user-1" } });
		mocks.exerciseFindFirst.mockResolvedValue(null);
		mocks.muscleFindUnique.mockResolvedValue({ tag: "chest" });
		mocks.exerciseFindFirst.mockResolvedValue({
			id: "exercise-1",
			userId: "user-1",
		});
		mocks.exerciseUpdate.mockResolvedValue({ id: "exercise-1" });
	});

	it("returns unauthorized without querying Prisma when the session is missing", async () => {
		mocks.auth.mockResolvedValue(null);

		await expect(updateExercise(validInput)).resolves.toEqual({
			code: "unauthorized",
			ok: false,
		});

		expect(mocks.exerciseFindFirst).not.toHaveBeenCalled();
		expect(mocks.exerciseUpdate).not.toHaveBeenCalled();
	});

	it("returns invalid_input for short normalized names without writing", async () => {
		await expect(
			updateExercise({ ...validInput, name: "a  b" }),
		).resolves.toEqual({ code: "invalid_input", ok: false });

		expect(mocks.exerciseFindFirst).not.toHaveBeenCalled();
		expect(mocks.exerciseUpdate).not.toHaveBeenCalled();
	});

	it("returns invalid_input for tampered ownership fields without writing", async () => {
		await expect(
			updateExercise({ ...validInput, userId: "user-2" } as never),
		).resolves.toEqual({ code: "invalid_input", ok: false });

		expect(mocks.exerciseUpdate).not.toHaveBeenCalled();
	});

	it("returns not_found for missing or non-owned rows without writing", async () => {
		mocks.exerciseFindFirst.mockResolvedValueOnce(null);

		await expect(updateExercise(validInput)).resolves.toEqual({
			code: "not_found",
			ok: false,
		});

		expect(mocks.exerciseUpdate).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("returns duplicate_name on self-excluding pre-check collisions", async () => {
		mocks.exerciseFindFirst
			.mockResolvedValueOnce({ id: "exercise-1", userId: "user-1" })
			.mockResolvedValueOnce({ id: "other-exercise" });

		await expect(
			updateExercise({ ...validInput, name: "  PRESS   banca  " }),
		).resolves.toEqual({ code: "duplicate_name", ok: false });

		expect(mocks.exerciseFindFirst).toHaveBeenCalledWith({
			where: {
				canonicalName: "press banca",
				id: { not: "exercise-1" },
				userId: "user-1",
			},
		});
		expect(mocks.exerciseUpdate).not.toHaveBeenCalled();
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("succeeds on self-rename and persists name, identity, and tag", async () => {
		mocks.exerciseFindFirst
			.mockResolvedValueOnce({ id: "exercise-1", userId: "user-1" })
			.mockResolvedValueOnce(null);
		const exercise = { id: "exercise-1" };
		mocks.exerciseUpdate.mockResolvedValueOnce(exercise);

		await expect(updateExercise(validInput)).resolves.toEqual({
			exercise,
			ok: true,
		});

		expect(mocks.exerciseUpdate).toHaveBeenCalledWith({
			data: {
				canonicalName: "press banca",
				description: "Barra plana",
				muscleGroupTag: "chest",
				name: "Press banca",
				tag: "press-banca",
			},
			where: { id: "exercise-1" },
		});
		expect(mocks.revalidatePath).toHaveBeenCalledWith("/exercises");
	});

	it("maps scoped canonical P2002 to duplicate_name without revalidating", async () => {
		mocks.exerciseFindFirst
			.mockResolvedValueOnce({ id: "exercise-1", userId: "user-1" })
			.mockResolvedValueOnce(null);
		const scopedViolation = Object.assign(
			new Error(
				"Unique constraint failed on the fields: (`userId`,`canonicalName`)",
			),
			{ code: "P2002", meta: { target: ["canonicalName", "userId"] } },
		);
		mocks.exerciseUpdate.mockRejectedValueOnce(scopedViolation);

		await expect(updateExercise(validInput)).resolves.toEqual({
			code: "duplicate_name",
			ok: false,
		});
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps update P2025 to not_found", async () => {
		mocks.exerciseFindFirst
			.mockResolvedValueOnce({ id: "exercise-1", userId: "user-1" })
			.mockResolvedValueOnce(null);
		const missing = Object.assign(new Error("Record not found"), {
			code: "P2025",
		});
		mocks.exerciseUpdate.mockRejectedValueOnce(missing);

		await expect(updateExercise(validInput)).resolves.toEqual({
			code: "not_found",
			ok: false,
		});
		expect(mocks.revalidatePath).not.toHaveBeenCalled();
	});

	it("maps unrelated P2002 targets to error", async () => {
		mocks.exerciseFindFirst
			.mockResolvedValueOnce({ id: "exercise-1", userId: "user-1" })
			.mockResolvedValueOnce(null);
		const otherViolation = Object.assign(
			new Error("Unique constraint failed on the fields: (`name`)"),
			{ code: "P2002", meta: { target: ["name"] } },
		);
		mocks.exerciseUpdate.mockRejectedValueOnce(otherViolation);

		await expect(updateExercise(validInput)).resolves.toEqual({
			code: "error",
			ok: false,
		});
	});
});
