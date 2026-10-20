"use server";

import { revalidatePath } from "next/cache";

import { auth } from "@/auth";
import { finishLiveSessionForUser } from "@/data/live-session-mutations";
import {
	FinishLiveSessionSchema,
	type FinishLiveSessionInput,
	type FinishLiveSessionResult,
} from "@/lib/schemas/live-session";

/** Validates and saves a completed offline-capable live workout session. */
export const finishLiveSession = async (
	input: FinishLiveSessionInput,
): Promise<FinishLiveSessionResult> => {
	try {
		const session = await auth();
		if (!session?.user?.id) {
			return { ok: false, code: "unauthorized" };
		}

		const parsed = FinishLiveSessionSchema.safeParse(input);
		if (!parsed.success) {
			return { ok: false, code: "invalid_input" };
		}

		const result = await finishLiveSessionForUser(session.user.id, parsed.data);
		if (!result.ok) {
			return result;
		}

		if (result.created) {
			revalidatePath(`/workouts/${result.workout.tag}`);
			revalidatePath("/workouts");
		}
		return { ok: true, workout: result.workout };
	} catch {
		return { ok: false, code: "error" };
	}
};
