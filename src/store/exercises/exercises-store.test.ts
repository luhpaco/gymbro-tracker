import { Exercise } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { useExercisesStore } from "./exercises-store";

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
	return {
		id: "exercise-1",
		name: "Bench Press",
		tag: "bench-press",
		description: null,
		muscleGroupTag: "chest",
		userId: "user-1",
		...overrides,
	};
}

describe("useExercisesStore", () => {
	beforeEach(() => {
		useExercisesStore.setState({ exercises: [], filteredExercises: [] });
	});

	it("sets exercises and mirrors them into filteredExercises", () => {
		const exercises = [
			makeExercise({ id: "1", muscleGroupTag: "chest" }),
			makeExercise({ id: "2", muscleGroupTag: "back" }),
		];

		useExercisesStore.getState().setExercises(exercises);

		expect(useExercisesStore.getState().exercises).toEqual(exercises);
		expect(useExercisesStore.getState().filteredExercises).toEqual(exercises);
	});

	it("filters exercises by muscle group", () => {
		const exercises = [
			makeExercise({ id: "1", muscleGroupTag: "chest" }),
			makeExercise({ id: "2", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(exercises);

		useExercisesStore.getState().filterExercises("back");

		expect(useExercisesStore.getState().filteredExercises).toEqual([
			exercises[1],
		]);
	});

	it("resets the filter to every exercise when muscle is 'all'", () => {
		const exercises = [
			makeExercise({ id: "1", muscleGroupTag: "chest" }),
			makeExercise({ id: "2", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(exercises);
		useExercisesStore.getState().filterExercises("back");

		useExercisesStore.getState().filterExercises("all");

		expect(useExercisesStore.getState().filteredExercises).toEqual(exercises);
	});
});
