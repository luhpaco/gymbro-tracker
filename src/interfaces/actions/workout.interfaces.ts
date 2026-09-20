import { Exercise } from "@/types";
// Get workouts
export interface DataItem {
	id: string;
	order: number;
	weight: number;
	reps: number;
	isWarmup: boolean;
	createdAt: Date;
	workoutId: string;
	exerciseId: string;
	exercise: Exercise;
}

export interface GroupedData {
	[key: string]: DataItem[];
}

// Show All Workouts Page
export interface WorkoutToDisplay {
	id: string;
	date: Date;
	name: string;
	tag: string;
	sets: GroupedData;
}

// Show Workout Detail Page
export interface WorkoutDetail {
	id: string;
	date: Date;
	name: string;
	tag: string;
	sets: GroupedData;
}
