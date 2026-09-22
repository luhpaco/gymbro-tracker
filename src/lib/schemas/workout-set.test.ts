import { describe, expect, it } from "vitest";
import { setSchema } from "./workout-set";

const WEIGHT_MESSAGE = "El peso debe ser un número igual o mayor a 0";
const REPS_MESSAGE = "Debes agregar tus repeticiones";
const REPS_INTEGER_MESSAGE = "Las repeticiones deben ser un número entero";

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

	it.each([
		[0, 0],
		[42.5, 42.5],
		["20", 20],
		["0", 0],
	])("accepts weight %j as %j", (input, expected) => {
		const result = setSchema.safeParse({ reps: 10, weight: input });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.weight).toBe(expected);
		}
	});

	it.each([
		["a blank string", ""],
		["a whitespace string", "  "],
		["null", null],
		["undefined", undefined],
		["a negative number", -1],
		["Infinity", Infinity],
		["NaN", NaN],
		["a non-numeric string", "abc"],
		["an array", []],
		["a boolean", true],
	])("rejects %s as weight", (_label, input) => {
		const result = setSchema.safeParse({ reps: 10, weight: input });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(WEIGHT_MESSAGE);
		}
	});

	it.each([
		[1, 1],
		["12", 12],
	])("accepts reps %j as %j", (input, expected) => {
		const result = setSchema.safeParse({ reps: input, weight: 40 });

		expect(result.success).toBe(true);
		if (result.success) {
			expect(result.data.reps).toBe(expected);
		}
	});

	it.each([
		["zero", 0, REPS_MESSAGE],
		["a negative number", -3, REPS_MESSAGE],
		["a blank string", "", REPS_MESSAGE],
		["null", null, REPS_MESSAGE],
		["undefined", undefined, REPS_MESSAGE],
		["a fraction", 1.5, REPS_INTEGER_MESSAGE],
	])("rejects %s as reps", (_label, input, message) => {
		const result = setSchema.safeParse({ reps: input, weight: 40 });

		expect(result.success).toBe(false);
		if (!result.success) {
			expect(result.error.issues[0].message).toBe(message);
		}
	});

	it("lets an optional weight be omitted but still rejects null", () => {
		const optionalWeight = setSchema.shape.weight.optional();

		expect(optionalWeight.safeParse(undefined).success).toBe(true);
		expect(optionalWeight.safeParse(null).success).toBe(false);
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
