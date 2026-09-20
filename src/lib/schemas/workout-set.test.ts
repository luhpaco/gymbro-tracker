import { describe, expect, it } from "vitest";
import { setSchema } from "./workout-set";

describe("setSchema", () => {
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

	it("defaults isWarmup to false when omitted", () => {
		const result = setSchema.safeParse({ reps: 10, weight: 40 });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isWarmup).toBe(false);
		}
	});

	it("preserves an explicit isWarmup of true", () => {
		const result = setSchema.safeParse({
			reps: 10,
			weight: 40,
			isWarmup: true,
		});

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.isWarmup).toBe(true);
		}
	});

	it("rejects a non-boolean isWarmup", () => {
		const result = setSchema.safeParse({
			reps: 10,
			weight: 40,
			isWarmup: "yes",
		});

		expect(result.success).toBe(false);
	});
});
