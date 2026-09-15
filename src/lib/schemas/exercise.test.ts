import { describe, expect, it } from "vitest";

import {
	createExerciseSchema,
	exerciseActiveStateSchema,
	updateExerciseSchema,
} from "./exercise";

describe("createExerciseSchema", () => {
	it("accepts valid input", () => {
		const result = createExerciseSchema.safeParse({
			name: "Press banca",
			description: "Barra",
			muscleGroupTag: "chest",
		});
		expect(result.success).toBe(true);
	});

	it("rejects a name shorter than 4 characters with a name error", () => {
		const result = createExerciseSchema.safeParse({
			name: "ab",
			muscleGroupTag: "chest",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain("name");
		}
	});

	it("rejects a whitespace-only name with a name error", () => {
		const result = createExerciseSchema.safeParse({
			name: "    ",
			muscleGroupTag: "chest",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain("name");
		}
	});

	it("rejects an empty muscle-group tag with a muscleGroupTag error", () => {
		const result = createExerciseSchema.safeParse({
			name: "Press banca",
			muscleGroupTag: "",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain("muscleGroupTag");
		}
	});

	it("rejects input missing required fields", () => {
		const result = createExerciseSchema.safeParse({
			description: "x",
		});
		expect(result.success).toBe(false);
	});

	it("rejects names shorter than 4 characters after display normalization", () => {
		const result = createExerciseSchema.safeParse({
			name: "a  b",
			muscleGroupTag: "chest",
		});
		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].path).toContain("name");
		}
	});

	it("rejects caller-supplied userId, tag, and canonicalName", () => {
		for (const extra of [
			{ userId: "user-1" },
			{ tag: "press-banca" },
			{ canonicalName: "press banca" },
		]) {
			const result = createExerciseSchema.safeParse({
				name: "Press banca",
				muscleGroupTag: "chest",
				...extra,
			});
			expect(result.success).toBe(false);
		}
	});
});

describe("updateExerciseSchema", () => {
	it("accepts valid rename input with id", () => {
		const result = updateExerciseSchema.safeParse({
			id: "exercise-1",
			name: "Press banca",
			muscleGroupTag: "chest",
		});
		expect(result.success).toBe(true);
	});

	it("rejects missing or empty id", () => {
		expect(
			updateExerciseSchema.safeParse({
				name: "Press banca",
				muscleGroupTag: "chest",
			}).success,
		).toBe(false);
		expect(
			updateExerciseSchema.safeParse({
				id: "",
				name: "Press banca",
				muscleGroupTag: "chest",
			}).success,
		).toBe(false);
	});

	it("rejects names shorter than 4 characters after display normalization", () => {
		const result = updateExerciseSchema.safeParse({
			id: "exercise-1",
			name: "a  b",
			muscleGroupTag: "chest",
		});
		expect(result.success).toBe(false);
	});

	it("rejects caller-supplied userId, tag, and canonicalName", () => {
		for (const extra of [
			{ userId: "user-1" },
			{ tag: "press-banca" },
			{ canonicalName: "press banca" },
		]) {
			const result = updateExerciseSchema.safeParse({
				id: "exercise-1",
				name: "Press banca",
				muscleGroupTag: "chest",
				...extra,
			});
			expect(result.success).toBe(false);
		}
	});
});

describe("exerciseActiveStateSchema", () => {
	it("accepts deactivation input", () => {
		const result = exerciseActiveStateSchema.safeParse({
			id: "1",
			isActive: false,
		});
		expect(result.success).toBe(true);
	});

	it("accepts reactivation input", () => {
		const result = exerciseActiveStateSchema.safeParse({
			id: "1",
			isActive: true,
		});
		expect(result.success).toBe(true);
	});

	it("rejects an empty id", () => {
		const result = exerciseActiveStateSchema.safeParse({
			id: "",
			isActive: false,
		});
		expect(result.success).toBe(false);
	});

	it("rejects a non-boolean isActive", () => {
		const result = exerciseActiveStateSchema.safeParse({
			id: "1",
			isActive: "false",
		});
		expect(result.success).toBe(false);
	});

	it("rejects input missing required fields", () => {
		const missingActive = exerciseActiveStateSchema.safeParse({ id: "1" });
		expect(missingActive.success).toBe(false);

		const missingId = exerciseActiveStateSchema.safeParse({
			isActive: true,
		});
		expect(missingId.success).toBe(false);
	});
});
