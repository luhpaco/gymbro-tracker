import { beforeEach, describe, expect, it } from "vitest";
import { Exercise, useWorkoutStore } from "./workout-store";

function makeExercise(overrides: Partial<Exercise> = {}): Exercise {
	return {
		exerciseValue: "bench-press",
		exerciseName: "Bench Press",
		sets: [{ reps: 10, weight: 40 }],
		...overrides,
	};
}

describe("useWorkoutStore", () => {
	beforeEach(() => {
		useWorkoutStore.setState({ exercises: [] });
	});

	it("adds an exercise to an empty workout", () => {
		const exercise = makeExercise();

		useWorkoutStore.getState().addExercise(exercise);

		expect(useWorkoutStore.getState().exercises).toEqual([exercise]);
	});

	it("appends subsequent exercises without dropping earlier ones", () => {
		const first = makeExercise({ exerciseValue: "bench-press" });
		const second = makeExercise({
			exerciseValue: "squat",
			exerciseName: "Squat",
		});

		useWorkoutStore.getState().addExercise(first);
		useWorkoutStore.getState().addExercise(second);

		expect(useWorkoutStore.getState().exercises).toEqual([first, second]);
	});

	it("removes an exercise by exerciseValue", () => {
		const first = makeExercise({ exerciseValue: "bench-press" });
		const second = makeExercise({
			exerciseValue: "squat",
			exerciseName: "Squat",
		});
		useWorkoutStore.getState().addExercise(first);
		useWorkoutStore.getState().addExercise(second);

		useWorkoutStore.getState().removeExercise("bench-press");

		expect(useWorkoutStore.getState().exercises).toEqual([second]);
	});

	it("resets exercises to an empty list", () => {
		useWorkoutStore.getState().addExercise(makeExercise());

		useWorkoutStore.getState().resetExercises();

		expect(useWorkoutStore.getState().exercises).toEqual([]);
	});

	it("updates a set field on the matching exercise and set index", () => {
		useWorkoutStore.getState().addExercise(
			makeExercise({
				exerciseValue: "bench-press",
				sets: [
					{ reps: 10, weight: 40 },
					{ reps: 8, weight: 45 },
				],
			}),
		);

		useWorkoutStore.getState().updateSet("bench-press", 1, { weight: 50 });

		expect(useWorkoutStore.getState().exercises[0].sets).toEqual([
			{ reps: 10, weight: 40 },
			{ reps: 8, weight: 50 },
		]);
	});

	it("is a no-op when the exercise or set index does not exist", () => {
		useWorkoutStore.getState().addExercise(makeExercise());
		const before = useWorkoutStore.getState().exercises;

		useWorkoutStore.getState().updateSet("missing-exercise", 0, {
			weight: 99,
		});
		useWorkoutStore.getState().updateSet("bench-press", 5, {
			weight: 99,
		});

		expect(useWorkoutStore.getState().exercises).toEqual(before);
	});
});
