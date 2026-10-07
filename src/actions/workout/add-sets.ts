"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { addOwnedWorkoutSets } from "@/data/workout-mutations";
import { AddSetsFormSchema, AddSetsInput } from "@/lib/schemas/workout";

type ErrorCode = "unauthorized" | "invalid_input" | "not_found" | "error";

type AddSetsResult = { ok: true } | { ok: false; code: ErrorCode };

/**
 * Appends sets to an exercise already recorded in an owned workout.
 *
 * The action validates with Zod before any database access and delegates the
 * recorded-exercise check, the active-state policy and the server-owned order to
 * the data layer. A previously unrecorded exercise is therefore refused as
 * `not_found`, while an exercise deactivated after being recorded still accepts
 * sets. Successful additions revalidate the stored detail route and the list.
 */
export const addSets = async (input: AddSetsInput): Promise<AddSetsResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = AddSetsFormSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const result = await addOwnedWorkoutSets(session.user.id, parsed.data);
		if (!result.ok) {
			return { ok: false, code: result.code };
		}

		revalidatePath(`/workouts/${result.tag}`);
		revalidatePath("/workouts");
		return { ok: true };
	} catch {
		return { ok: false, code: "error" };
	}
};
