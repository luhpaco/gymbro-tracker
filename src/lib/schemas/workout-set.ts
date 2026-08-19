import { z } from "zod";

export const setSchema = z.object({
	reps: z.coerce.number().min(1, { message: "Debes agregar tus repeticiones" }),
	weight: z.coerce
		.number()
		.min(1, { message: "Debes agregar el peso de tus repeticiones" }),
});
