import { describe, expect, it } from "vitest";
import {
	isNavigationDestinationActive,
	shouldShowLiveSessionBanner,
	shouldSuppressMobileDock,
} from "./navigation-state";

describe("shouldSuppressMobileDock", () => {
	it("keeps the dock available outside workout creation even with drafts", () => {
		expect(shouldSuppressMobileDock("/workouts", 1)).toBe(false);
		expect(shouldSuppressMobileDock("/exercises/create", 2)).toBe(false);
	});

	it("keeps the dock available for an empty workout draft", () => {
		expect(shouldSuppressMobileDock("/workouts/create", 0)).toBe(false);
	});

	it("suppresses the dock only for a workout draft with exercises", () => {
		expect(shouldSuppressMobileDock("/workouts/create", 1)).toBe(true);
		expect(shouldSuppressMobileDock("/workouts/create", 3)).toBe(true);
	});
});

describe("isNavigationDestinationActive", () => {
	it("marks an exact destination as active", () => {
		expect(isNavigationDestinationActive("/workouts", "/workouts")).toBe(true);
	});

	it("marks nested routes active without matching a shared prefix", () => {
		expect(isNavigationDestinationActive("/workouts/create", "/workouts")).toBe(
			true,
		);
		expect(isNavigationDestinationActive("/workouts-plan", "/workouts")).toBe(
			false,
		);
	});
});

describe("shouldShowLiveSessionBanner", () => {
	it("shows for an active or finishing session away from the live screen", () => {
		expect(shouldShowLiveSessionBanner("/dashboard", "active")).toBe(true);
		expect(shouldShowLiveSessionBanner("/workouts", "finishing")).toBe(true);
		expect(shouldShowLiveSessionBanner("/workouts/create", "active")).toBe(
			true,
		);
	});

	it("hides on the live screen itself, including nested paths", () => {
		expect(shouldShowLiveSessionBanner("/workouts/live", "active")).toBe(false);
		expect(shouldShowLiveSessionBanner("/workouts/live/", "active")).toBe(
			false,
		);
	});

	it("does not treat a workout slug that merely starts with live as the live screen", () => {
		expect(shouldShowLiveSessionBanner("/workouts/liverpool", "active")).toBe(
			true,
		);
	});

	it("hides when there is nothing in progress", () => {
		for (const status of ["none", "synced", "discarded"] as const) {
			expect(shouldShowLiveSessionBanner("/dashboard", status)).toBe(false);
		}
	});
});
