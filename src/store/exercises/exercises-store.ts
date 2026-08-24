import { Exercise } from "@prisma/client";
import { create } from "zustand";

interface Exercises {
	exercises: Exercise[];
	filteredExercises: Exercise[];
	setExercises: (exercises: Exercise[]) => void;
	filterExercises: (muscle: string) => void;
}

export const useExercisesStore = create<Exercises>()((set, get) => ({
	exercises: [],
	filteredExercises: [],
	setExercises: (exercises) => {
		set({ exercises, filteredExercises: exercises });
	},
	filterExercises: (muscle) => {
		const { exercises } = get();
		if (muscle === "all") return set({ filteredExercises: exercises });
		const filtered = exercises.filter(
			(exercise) => exercise.muscleGroupTag === muscle,
		);
		return set({ filteredExercises: filtered });
	},
}));
