import { z } from "zod";

import { AddWorkoutFormSchema } from "./workout";
import { setSchema } from "./workout-set";

const dateInputSchema = z.union([
	z.date(),
	z
		.string()
		.datetime({ offset: true })
		.transform((value) => new Date(value)),
]);

const liveSetSchema = setSchema.extend({ doneAt: dateInputSchema });

export const FinishLiveSessionSchema = z
	.object({
		sessionId: z.string().uuid(),
		name: AddWorkoutFormSchema.shape.nameWorkout,
		startedAt: dateInputSchema,
		endedAt: dateInputSchema,
		exercises: z
			.array(
				z.object({
					exerciseId: z.string().uuid(),
					sets: z.array(liveSetSchema).min(1),
				}),
			)
			.min(1),
	})
	.refine((input) => input.endedAt >= input.startedAt, {
		path: ["endedAt"],
		message: "Workout end must not be before its start",
	});

export type FinishLiveSessionInput = z.input<typeof FinishLiveSessionSchema>;
export type ParsedFinishLiveSessionInput = z.output<
	typeof FinishLiveSessionSchema
>;

export type FinishLiveSessionResult =
	| { ok: true; workout: import("@prisma/client").Workout }
	| {
			ok: false;
			code:
				| "unauthorized"
				| "invalid_input"
				| "exercise_not_found"
				| "duplicate_tag"
				| "error";
	  };
