"use server";

import { DataItem, GroupedData } from "@/interfaces";
import prisma from "@/lib/prisma";

export const getWorkoutBySlug = async (slug: string, userId: string) => {
	try {
		const workout = await prisma.workout.findFirst({
			where: {
				tag: slug,
				userId: userId,
			},
			include: {
				sets: {
					orderBy: { id: "asc" },
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
		const workoutDetail = {
			id: workout?.id,
			name: workout?.name,
			date: workout?.date,
			tag: workout?.tag,
			sets: workout?.sets.reduce((acc: GroupedData, item: DataItem) => {
				const exerciseName = item.exercise.name;
				if (!acc[exerciseName]) {
					acc[exerciseName] = [];
				}
				acc[exerciseName].push(item);
				return acc;
			}, {}),
		};
		return workoutDetail;
	} catch (error) {}
};
