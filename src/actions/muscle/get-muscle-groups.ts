"use server";

import prisma from "@/lib/prisma";
import { connection } from "next/server";

export const getMuscleGroups = async () => {
	await connection();

	try {
		const muscleGroups = await prisma.muscleGroup.findMany();
		return muscleGroups;
	} catch (error) {
		console.error(error);
		return [];
	}
};
