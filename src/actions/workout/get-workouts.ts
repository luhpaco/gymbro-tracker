"use server";

import prisma from "@/lib/prisma";
import { SET_ORDER_BY, groupSetsByExercise } from "@/lib/workout-sets";

interface GetWorkouts {
	skip?: number;
	take?: number;
	orderByDate?: "asc" | "desc";
	userId: string;
}

export const getWorkouts = async ({
	skip = 0,
	take = 10,
	orderByDate = "desc",
	userId,
}: GetWorkouts) => {
	try {
		const allWorkouts = await prisma.workout.findMany({
			where: {
				userId: userId,
			},
			take: take,
			skip: skip,
			orderBy: [
				{
					date: orderByDate,
				},
				{
					createdAt: orderByDate,
				},
			],
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
		const arrWorkouts = allWorkouts.map((workout) => ({
			id: workout.id,
			name: workout.name,
			date: workout.date,
			tag: workout.tag,
			sets: groupSetsByExercise(workout.sets),
		}));

		return arrWorkouts;
	} catch (error) {
		console.error(error);
		return [];
	}
};
