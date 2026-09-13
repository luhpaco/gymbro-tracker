import { Exercise } from "@prisma/client";
import { create } from "zustand";

interface Exercises {
	exercises: Exercise[];
	filteredExercises: Exercise[];
	selectedMuscleGroup: string;
	setExercises: (exercises: Exercise[]) => void;
	filterExercises: (muscle: string) => void;
}

export const useExercisesStore = create<Exercises>()((set, get) => ({
	exercises: [],
	filteredExercises: [],
	selectedMuscleGroup: "",
	setExercises: (exercises) => {
		const { selectedMuscleGroup } = get();
		if (selectedMuscleGroup && selectedMuscleGroup !== "all") {
			set({
				exercises,
				filteredExercises: exercises.filter(
					(exercise) => exercise.muscleGroupTag === selectedMuscleGroup,
				),
			});
			return;
		}
		set({ exercises, filteredExercises: exercises });
	},
	filterExercises: (muscle) => {
		const { exercises } = get();
		if (muscle === "all")
			return set({ filteredExercises: exercises, selectedMuscleGroup: muscle });
		const filtered = exercises.filter(
			(exercise) => exercise.muscleGroupTag === muscle,
		);
		return set({ filteredExercises: filtered, selectedMuscleGroup: muscle });
	},
}));
