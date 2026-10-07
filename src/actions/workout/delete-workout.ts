"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { deleteOwnedWorkout } from "@/data/workout-mutations";
import {
	DeleteWorkoutFormSchema,
	DeleteWorkoutInput,
} from "@/lib/schemas/workout";

type ErrorCode = "unauthorized" | "invalid_input" | "not_found" | "error";

type DeleteWorkoutResult = { ok: true } | { ok: false; code: ErrorCode };

/**
 * Deletes an owned workout and all of its sets.
 *
 * Irreversible: the UI must only call this after the explicit whole-workout
 * confirmation has been accepted (Phase 3). The server contract itself carries
 * no one-tap path; the action authenticates, validates, delegates the atomic
 * owner-scoped deletion to the data layer, and revalidates the stored detail
 * route plus the list only after the deletion commits.
 */
export const deleteWorkout = async (
	input: DeleteWorkoutInput,
): Promise<DeleteWorkoutResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = DeleteWorkoutFormSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const result = await deleteOwnedWorkout(
			session.user.id,
			parsed.data.workoutId,
		);
		if (!result.ok) {
			return { ok: false, code: result.code };
		}

		// Only a committed deletion invalidates the stored detail route and the
		// workout list. The route uses the stored tag returned by the data layer.
		revalidatePath(`/workouts/${result.tag}`);
		revalidatePath("/workouts");
		return { ok: true };
	} catch {
		return { ok: false, code: "error" };
	}
};
