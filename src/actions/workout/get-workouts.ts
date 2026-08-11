"use server";

import { DataItem, GroupedData } from "@/interfaces";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

type WorkoutWithSets = Prisma.WorkoutGetPayload<{
	include: {
		sets: {
			include: {
				exercise: {
					select: {
						name: true;
					};
					};
				};
			};
		};
	}
>;

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
			],
			include: {
				sets: {
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
		const arrWorkouts = allWorkouts.map((workout: WorkoutWithSets) => ({
			id: workout.id,
			name: workout.name,
			date: workout.date,
			tag: workout.tag,
			sets: workout.sets.reduce((acc: GroupedData, item: DataItem) => {
				const exerciseName = item.exercise.name;
				if (!acc[exerciseName]) {
					acc[exerciseName] = [];
				}
				acc[exerciseName].push(item);
				return acc;
			}, {}),
		}));

		return arrWorkouts;
	} catch (error) {
		console.error(error);
		return [];
	}
};
