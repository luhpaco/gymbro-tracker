import { create } from "zustand";

interface WorkoutDraftSignal {
	exerciseCount: number;
	setExerciseCount: (count: number) => void;
}

export const useWorkoutDraftSignalStore = create<WorkoutDraftSignal>()(
	(set) => ({
		exerciseCount: 0,
		setExerciseCount: (count) => set({ exerciseCount: count }),
	}),
);
