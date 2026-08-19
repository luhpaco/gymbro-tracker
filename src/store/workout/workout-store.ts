import { create } from "zustand";

export interface Exercise {
	exerciseValue: string;
	exerciseName: string;
	sets: {
		reps: number;
		weight: number;
	}[];
}

interface Workout {
	exercises: Exercise[];
	addExercise: (exercise: Exercise) => void;
	removeExercise: (exerciseValue: string) => void;
	resetExercises: () => void;
	updateSet: (
		exerciseValue: string,
		setIndex: number,
		patch: Partial<Exercise["sets"][number]>
	) => void;
}

export const useWorkoutStore = create<Workout>()((set, get) => ({
	exercises: [],
	addExercise: (exercise) => {
		const { exercises } = get();
		if (exercises.length === 0) {
			set({ exercises: [exercise] });
		}
		set({ exercises: [...exercises, exercise] });
	},
	removeExercise: (exerciseValue) => {
		const { exercises } = get();
		const updatedExercises = exercises.filter(
			(exercise) => exercise.exerciseValue !== exerciseValue
		);
		set({ exercises: updatedExercises });
	},
	resetExercises: () => set({ exercises: [] }),
	updateSet: (exerciseValue, setIndex, patch) => {
		const { exercises } = get();
		const exercise = exercises.find(
			(exercise) => exercise.exerciseValue === exerciseValue
		);
		if (!exercise) return;
		const targetSet = exercise.sets[setIndex];
		if (!targetSet) return;
		// Mutate the existing set object's weight/reps fields in place.
		if (patch.weight !== undefined) {
			targetSet.weight = patch.weight;
		}
		if (patch.reps !== undefined) {
			targetSet.reps = patch.reps;
		}
		// Publish a new outer snapshot so Zustand subscribers re-render.
		set({ exercises: [...exercises] });
	},
}));
