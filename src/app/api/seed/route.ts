import { muscleGroups } from "@/data/muscle-groups";
import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function GET() {
	try {
		const muscleGroupsExist = await prisma.muscleGroup.findMany();
		if (muscleGroupsExist.length === 0) {
			const muscleGroupsData = muscleGroups.map((muscle) => ({
				name: muscle.name,
				tag: muscle.slug,
			}));
			await prisma.muscleGroup.createMany({
				data: muscleGroupsData,
			});
			return NextResponse.json(
				{ message: "Seed executed successfully" },
				{ status: 200 },
			);
		}
		return NextResponse.json(
			{ message: "There are data, We can't execute this seed" },
			{ status: 500 },
		);
	} catch (error) {
		return NextResponse.json(
			{ message: "Error executing seed" },
			{ status: 500 },
		);
	}
}
