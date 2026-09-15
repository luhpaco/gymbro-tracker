import { beforeEach, describe, expect, it } from "vitest";
import { useWorkoutDraftSignalStore } from "./workout-draft-signal-store";

describe("useWorkoutDraftSignalStore", () => {
	beforeEach(() => {
		useWorkoutDraftSignalStore.setState({ exerciseCount: 0 });
	});

	it("starts at zero", () => {
		expect(useWorkoutDraftSignalStore.getState().exerciseCount).toBe(0);
	});

	it("updates the exercise count", () => {
		useWorkoutDraftSignalStore.getState().setExerciseCount(3);

		expect(useWorkoutDraftSignalStore.getState().exerciseCount).toBe(3);
	});
});
