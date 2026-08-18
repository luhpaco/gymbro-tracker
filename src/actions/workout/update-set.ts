"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { auth } from "@/auth";
import { setSchema } from "@/lib/schemas/workout-set";
import prisma from "@/lib/prisma";

const updateSetSchema = z
	.object({
		id: z.string().min(1),
		weight: setSchema.shape.weight.optional(),
		reps: setSchema.shape.reps.optional(),
	})
	.refine((data) => data.weight !== undefined || data.reps !== undefined, {
		message: "Debes enviar el peso o las repeticiones",
	});

export interface UpdateSetInput {
	id: string;
	weight?: number;
	reps?: number;
}

export const updateSet = async (input: UpdateSetInput) => {
	const session = await auth();
	if (!session?.user?.id) {
		return { ok: false as const };
	}

	const parsed = updateSetSchema.safeParse(input);
	if (!parsed.success) {
		return { ok: false as const };
	}

	const { id, weight, reps } = parsed.data;

	// Resolve the set only if it belongs to a workout owned by the caller,
	// so an unauthenticated cross-user write is impossible and we also learn
	// the workout tag needed to revalidate the exact detail route.
	const target = await prisma.set.findFirst({
		where: {
			id,
			workout: { userId: session.user.id },
		},
		select: {
			id: true,
			workout: { select: { tag: true } },
		},
	});
	if (!target) {
		return { ok: false as const };
	}

	await prisma.set.update({
		where: { id: target.id },
		data: {
			...(weight !== undefined ? { weight } : {}),
			...(reps !== undefined ? { reps } : {}),
		},
	});

	revalidatePath(`/workouts/${target.workout.tag}`);

	return { ok: true as const };
};
