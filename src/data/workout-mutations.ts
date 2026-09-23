import prisma from "@/lib/prisma";

export interface UpdateWorkoutMetadataInput {
	workoutId: string;
	nameWorkout: string;
	dateWorkout: Date;
}

type UpdateWorkoutMetadataResult =
	{ ok: true; tag: string } | { ok: false; code: "not_found" | "error" };

/**
 * Applies an owner-scoped metadata edit to a saved workout and returns the
 * unchanged stored tag so the caller can revalidate the original detail route.
 *
 * The lookup and the write are both restricted by workout id and owner, so a
 * missing workout and another user's workout collapse into the same null
 * lookup. The affected-row count is checked so a workout removed concurrently
 * becomes `not_found` instead of a reported success.
 */
export const updateOwnedWorkoutMetadata = async (
	userId: string,
	input: UpdateWorkoutMetadataInput,
): Promise<UpdateWorkoutMetadataResult> => {
	try {
		const target = await prisma.workout.findFirst({
			where: { id: input.workoutId, userId },
			select: { id: true, tag: true },
		});
		if (!target) {
			return { ok: false, code: "not_found" };
		}

		const { count } = await prisma.workout.updateMany({
			where: { id: target.id, userId },
			data: { name: input.nameWorkout, date: input.dateWorkout },
		});
		if (count !== 1) {
			return { ok: false, code: "not_found" };
		}

		return { ok: true, tag: target.tag };
	} catch {
		return { ok: false, code: "error" };
	}
};
