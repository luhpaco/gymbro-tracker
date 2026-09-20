import { describe, expect, it } from "vitest";
import {
	AddExerciseFormSchema,
	AddWorkoutFormSchema,
	setSchema,
	setsSchema,
} from "./workout";
import { setSchema as sharedSetSchema } from "./workout-set";

describe("setSchema", () => {
	it("is the same schema object exported by workout-set", () => {
		expect(setSchema).toBe(sharedSetSchema);
	});

	it("accepts a valid set", () => {
		const result = setSchema.safeParse({ reps: 10, weight: 40 });

		expect(result.success).toBe(true);
	});

	it("coerces numeric strings", () => {
		const result = setSchema.safeParse({ reps: "10", weight: "40" });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data).toEqual({ reps: 10, weight: 40, isWarmup: false });
		}
	});

	it("rejects reps below the minimum", () => {
		const result = setSchema.safeParse({ reps: 0, weight: 40 });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"Debes agregar tus repeticiones",
			);
		}
	});

	it("rejects weight below the minimum", () => {
		const result = setSchema.safeParse({ reps: 10, weight: 0 });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"Debes agregar el peso de tus repeticiones",
			);
		}
	});
});

describe("setsSchema", () => {
	it("rejects an empty sets list", () => {
		const result = setsSchema.safeParse([]);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"Debes agregar al menos un set",
			);
		}
	});

	it("accepts up to 5 sets", () => {
		const sets = Array.from({ length: 5 }, () => ({ reps: 10, weight: 40 }));

		expect(setsSchema.safeParse(sets).success).toBe(true);
	});

	it("rejects more than 5 sets", () => {
		const sets = Array.from({ length: 6 }, () => ({ reps: 10, weight: 40 }));
		const result = setsSchema.safeParse(sets);

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe("Tómalo con calma!!");
		}
	});
});

describe("AddExerciseFormSchema", () => {
	it("accepts a valid exercise entry", () => {
		const result = AddExerciseFormSchema.safeParse({
			exerciseValue: "bench-press",
			exerciseName: "Bench Press",
			sets: [{ reps: 10, weight: 40 }],
		});

		expect(result.success).toBe(true);
	});

	it("rejects a missing exerciseValue", () => {
		const result = AddExerciseFormSchema.safeParse({
			exerciseName: "Bench Press",
			sets: [{ reps: 10, weight: 40 }],
		});

		expect(result.success).toBe(false);
	});
});

describe("AddWorkoutFormSchema", () => {
	const validExercise = {
		exerciseValue: "bench-press",
		exerciseName: "Bench Press",
		sets: [{ reps: 10, weight: 40 }],
	};

	it("accepts a fully valid workout", () => {
		const result = AddWorkoutFormSchema.safeParse({
			nameWorkout: "Día de pecho",
			dateWorkout: new Date("2026-01-01"),
			tagWorkout: "dia-de-pecho",
			listExercises: [validExercise],
		});

		expect(result.success).toBe(true);
	});

	it("rejects an empty workout name", () => {
		const result = AddWorkoutFormSchema.safeParse({
			nameWorkout: "",
			dateWorkout: new Date("2026-01-01"),
			tagWorkout: "",
			listExercises: [validExercise],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"Agrega un nombre a tu entrenamiento.",
			);
		}
	});

	it("rejects a missing date", () => {
		const result = AddWorkoutFormSchema.safeParse({
			nameWorkout: "Día de pecho",
			tagWorkout: "dia-de-pecho",
			listExercises: [validExercise],
		});

		expect(result.success).toBe(false);
	});

	it("rejects an empty exercise list", () => {
		const result = AddWorkoutFormSchema.safeParse({
			nameWorkout: "Día de pecho",
			dateWorkout: new Date("2026-01-01"),
			tagWorkout: "dia-de-pecho",
			listExercises: [],
		});

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(
				"Agrega ejercicios a tu entrenamiento",
			);
		}
	});
});
