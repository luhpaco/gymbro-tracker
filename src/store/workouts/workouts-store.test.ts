import { beforeEach, describe, expect, it } from "vitest";
import { useWorkoutsStore } from "./workouts-store";

function makeWorkout(overrides: Partial<{ name: string; tag: string }> = {}) {
	return {
		name: "Push Day",
		date: new Date("2026-01-01T00:00:00.000Z"),
		tag: "push-day",
		exercises: [],
		...overrides,
	};
}

describe("useWorkoutsStore", () => {
	beforeEach(() => {
		useWorkoutsStore.setState({ workouts: [] });
	});

	it("adds a workout to an empty list", () => {
		const workout = makeWorkout();

		useWorkoutsStore.getState().addWorkout(workout);

		expect(useWorkoutsStore.getState().workouts).toEqual([workout]);
	});

	it("appends subsequent workouts without dropping earlier ones", () => {
		const first = makeWorkout({ tag: "push-day" });
		const second = makeWorkout({ name: "Pull Day", tag: "pull-day" });

		useWorkoutsStore.getState().addWorkout(first);
		useWorkoutsStore.getState().addWorkout(second);

		expect(useWorkoutsStore.getState().workouts).toEqual([first, second]);
	});

	// `removeWorkout` is currently a no-op stub in workouts-store.ts (it
	// ignores its `tag` argument and never updates state). This test locks
	// in that observed behavior rather than the interface's intent; see the
	// apply-progress "Issues Found" note for this change.
	it("does not remove a workout (removeWorkout is currently a no-op)", () => {
		const workout = makeWorkout();
		useWorkoutsStore.getState().addWorkout(workout);

		useWorkoutsStore.getState().removeWorkout(workout.tag);

		expect(useWorkoutsStore.getState().workouts).toEqual([workout]);
	});
});
