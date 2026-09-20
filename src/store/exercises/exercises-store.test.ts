import { Exercise } from "@prisma/client";
import { beforeEach, describe, expect, it } from "vitest";
import { useExercisesStore } from "./exercises-store";

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
	return {
		canonicalName: "bench press",
		id: "exercise-1",
		name: "Bench Press",
		tag: "bench-press",
		description: null,
		muscleGroupTag: "chest",
		userId: "user-1",
		isActive: true,
		createdAt: new Date("2026-01-01T00:00:00.000Z"),
		updatedAt: new Date("2026-01-01T00:00:00.000Z"),
		...overrides,
	};
}

describe("useExercisesStore", () => {
	beforeEach(() => {
		useExercisesStore.setState({
			exercises: [],
			filteredExercises: [],
			selectedMuscleGroup: "",
		});
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

	it("sets selectedMuscleGroup to 'all' and keeps the full list", () => {
		const exercises = [
			makeExercise({ id: "1", muscleGroupTag: "chest" }),
			makeExercise({ id: "2", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(exercises);

		useExercisesStore.getState().filterExercises("all");

		expect(useExercisesStore.getState().selectedMuscleGroup).toBe("all");
		expect(useExercisesStore.getState().filteredExercises).toEqual(exercises);
	});

	it("sets selectedMuscleGroup to the muscle and filters the list", () => {
		const exercises = [
			makeExercise({ id: "1", muscleGroupTag: "chest" }),
			makeExercise({ id: "2", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(exercises);

		useExercisesStore.getState().filterExercises("chest");

		expect(useExercisesStore.getState().selectedMuscleGroup).toBe("chest");
		expect(useExercisesStore.getState().filteredExercises).toEqual([
			exercises[0],
		]);
	});

	it("reapplies the active filter when exercises are replaced", () => {
		const exercises = [
			makeExercise({ id: "1", muscleGroupTag: "chest" }),
			makeExercise({ id: "2", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(exercises);
		useExercisesStore.getState().filterExercises("chest");

		const refreshed = [
			makeExercise({ id: "3", muscleGroupTag: "chest" }),
			makeExercise({ id: "4", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(refreshed);

		expect(useExercisesStore.getState().exercises).toEqual(refreshed);
		expect(useExercisesStore.getState().selectedMuscleGroup).toBe("chest");
		expect(useExercisesStore.getState().filteredExercises).toEqual([
			refreshed[0],
		]);
	});

	it("shows every exercise on replacement when the filter is 'all'", () => {
		const exercises = [
			makeExercise({ id: "1", muscleGroupTag: "chest" }),
			makeExercise({ id: "2", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(exercises);
		useExercisesStore.getState().filterExercises("all");

		const refreshed = [
			makeExercise({ id: "3", muscleGroupTag: "chest" }),
			makeExercise({ id: "4", muscleGroupTag: "back" }),
		];
		useExercisesStore.getState().setExercises(refreshed);

		expect(useExercisesStore.getState().filteredExercises).toEqual(refreshed);
	});
});
