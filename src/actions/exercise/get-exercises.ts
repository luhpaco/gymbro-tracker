"use server";

import { auth } from "@/auth";
import prisma from "@/lib/prisma";

export const getExercises = async () => {
	try {
		const session = await auth();
		if (!session) return [];
		const createdExercises = await prisma.exercise.findMany({
			where: {
				userId: session.user.id,
			},
		});

		return createdExercises;
	} catch (error) {
		console.error(error);
		return [];
	}
};
