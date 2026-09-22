"use server";

import prisma from "@/lib/prisma";
import { SET_ORDER_BY, groupSetsByExercise } from "@/lib/workout-sets";

export const getWorkoutBySlug = async (slug: string, userId: string) => {
	try {
		const workout = await prisma.workout.findUnique({
			where: {
				userId_tag: { userId, tag: slug },
			},
			include: {
				sets: {
					orderBy: SET_ORDER_BY,
					include: {
						exercise: {
							select: {
								name: true,
							},
						},
					},
				},
			},
		});
		if (!workout) return null;
		const workoutDetail = {
			id: workout.id,
			name: workout.name,
			date: workout.date,
			tag: workout.tag,
			sets: groupSetsByExercise(workout.sets ?? []),
		};
		return workoutDetail;
	} catch (error) {
		return null;
	}
};
