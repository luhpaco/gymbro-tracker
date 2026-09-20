import { z } from "zod";

const WEIGHT_MESSAGE = "El peso debe ser un número igual o mayor a 0";
const REPS_MESSAGE = "Debes agregar tus repeticiones";
const REPS_INTEGER_MESSAGE = "Las repeticiones deben ser un número entero";

// Blank input must not reach `z.number`: `Number("")`, `Number(null)` and `Number([])` are all 0,
// and 0 is now a valid weight, so `z.coerce` would silently persist an empty field as 0 kg.
const parseNumericInput = (value: unknown): unknown => {
	if (typeof value !== "string") return value;
	return value.trim() === "" ? undefined : Number(value);
};

export const setSchema = z.object({
	reps: z.preprocess(
		parseNumericInput,
		z
			.number({
				required_error: REPS_MESSAGE,
				invalid_type_error: REPS_MESSAGE,
			})
			.int({ message: REPS_INTEGER_MESSAGE })
			.min(1, { message: REPS_MESSAGE }),
	),
	weight: z.preprocess(
		parseNumericInput,
		z
			.number({
				required_error: WEIGHT_MESSAGE,
				invalid_type_error: WEIGHT_MESSAGE,
			})
			.finite({ message: WEIGHT_MESSAGE })
			.min(0, { message: WEIGHT_MESSAGE }),
	),
	isWarmup: z.boolean().default(false),
});
