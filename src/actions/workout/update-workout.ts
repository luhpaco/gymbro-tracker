"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { updateOwnedWorkoutMetadata } from "@/data/workout-mutations";
import {
	UpdateWorkoutFormSchema,
	UpdateWorkoutInput,
} from "@/lib/schemas/workout";

type ErrorCode = "unauthorized" | "invalid_input" | "not_found" | "error";

type UpdateWorkoutResult = { ok: true } | { ok: false; code: ErrorCode };

export const updateWorkout = async (
	input: UpdateWorkoutInput,
): Promise<UpdateWorkoutResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = UpdateWorkoutFormSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const result = await updateOwnedWorkoutMetadata(
			session.user.id,
			parsed.data,
		);
		if (!result.ok) {
			return { ok: false, code: result.code };
		}

		// Only a committed metadata edit invalidates the stored detail route and
		// the workout list. The route uses the stored tag, never a recomputed one.
		revalidatePath(`/workouts/${result.tag}`);
		revalidatePath("/workouts");
		return { ok: true };
	} catch {
		return { ok: false, code: "error" };
	}
};
