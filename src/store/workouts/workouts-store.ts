import { create } from "zustand";
import { Exercise } from "@/lib/schemas/workout";

interface Workout {
	name: string;
	date: Date;
	tag: string;
	exercises: Exercise[];
}

interface Workouts {
	workouts: Workout[];
	addWorkout: (workout: Workout) => void;
	removeWorkout: (tag: string) => void;
}

export const useWorkoutsStore = create<Workouts>()((set, get) => ({
	workouts: [],
	addWorkout: (workout) => {
		const { workouts } = get();
		set({ workouts: [...workouts, workout] });
	},
	removeWorkout: () => {},
}));
