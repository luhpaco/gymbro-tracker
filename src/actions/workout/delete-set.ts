"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { deleteOwnedSet } from "@/data/workout-mutations";
import { DeleteSetFormSchema, DeleteSetInput } from "@/lib/schemas/workout";

type ErrorCode =
	"unauthorized" | "invalid_input" | "not_found" | "last_set" | "error";

type DeleteSetResult = { ok: true } | { ok: false; code: ErrorCode };

/**
 * Deletes one set from an owned workout.
 *
 * The action validates with Zod before any database access and delegates the
 * ownership and final-set guard to the data layer. A missing set, a foreign set
 * and a set belonging to a different workout all return `not_found`; removing
 * the last set of any recorded exercise is refused as `last_set`. Only a
 * committed deletion revalidates the stored detail route and the list.
 */
export const deleteSet = async (
	input: DeleteSetInput,
): Promise<DeleteSetResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = DeleteSetFormSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const result = await deleteOwnedSet(session.user.id, parsed.data);
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
