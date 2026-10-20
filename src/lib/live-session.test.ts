import { describe, expect, it } from "vitest";
import {
	LIVE_SESSION_MAX_AGE_MS,
	type LiveSessionState,
	addExercise,
	addSet,
	beginFinish,
	canFinish,
	completeSet,
	discardSession,
	isSessionStale,
	markSynced,
	removeExercise,
	removeSet,
	startSession,
	toFinishInput,
	uncompleteSet,
	updateSet,
} from "./live-session";

const T0 = "2026-10-20T10:00:00.000Z";
const T1 = "2026-10-20T10:05:00.000Z";
const T2 = "2026-10-20T10:30:00.000Z";
const SESSION_ID = "11111111-1111-4111-8111-111111111111";
const BENCH = "22222222-2222-4222-8222-222222222222";
const SQUAT = "33333333-3333-4333-8333-333333333333";

const NONE: LiveSessionState = { status: "none" };

const active = (): LiveSessionState =>
	startSession(NONE, { id: SESSION_ID, now: T0 });

const withBench = (): LiveSessionState =>
	addExercise(active(), {
		localId: "ex-1",
		exerciseId: BENCH,
		exerciseName: "Bench press",
	});

const withBenchSet = (): LiveSessionState =>
	addSet(withBench(), "ex-1", {
		id: "set-1",
		weight: 60,
		reps: 8,
		isWarmup: false,
	});

const sessionOf = (state: LiveSessionState) => {
	if (state.status !== "active" && state.status !== "finishing") {
		throw new Error(`no session in state ${state.status}`);
	}
	return state.session;
};

describe("startSession", () => {
	it("starts an empty active session from no session", () => {
		const state = active();
		expect(state).toEqual({
			status: "active",
			session: { id: SESSION_ID, startedAt: T0, exercises: [] },
		});
	});

	it("starts again after a synced or discarded session", () => {
		const synced: LiveSessionState = { status: "synced", workoutId: "w1" };
		const discarded: LiveSessionState = { status: "discarded" };
		expect(startSession(synced, { id: SESSION_ID, now: T0 }).status).toBe(
			"active",
		);
		expect(startSession(discarded, { id: SESSION_ID, now: T0 }).status).toBe(
			"active",
		);
	});

	it("never replaces a session that is already active or finishing", () => {
		const running = withBenchSet();
		const other = startSession(running, {
			id: "99999999-9999-4999-8999-999999999999",
			now: T2,
		});
		expect(other).toBe(running);

		const finishing = beginFinish(completeSet(running, "ex-1", "set-1", T1), {
			name: "Push day",
			now: T2,
		});
		expect(startSession(finishing, { id: SESSION_ID, now: T2 })).toBe(
			finishing,
		);
	});
});

describe("exercises and sets", () => {
	it("adds exercises in logged order and ignores duplicates of a local id", () => {
		let state = withBench();
		state = addExercise(state, {
			localId: "ex-2",
			exerciseId: SQUAT,
			exerciseName: "Squat",
		});
		state = addExercise(state, {
			localId: "ex-2",
			exerciseId: SQUAT,
			exerciseName: "Squat",
		});
		expect(sessionOf(state).exercises.map((e) => e.exerciseId)).toEqual([
			BENCH,
			SQUAT,
		]);
	});

	it("adds a not-yet-done set with weight, reps and the warmup flag", () => {
		const state = addSet(withBench(), "ex-1", {
			id: "set-w",
			weight: 20,
			reps: 10,
			isWarmup: true,
		});
		expect(sessionOf(state).exercises[0].sets).toEqual([
			{ id: "set-w", weight: 20, reps: 10, isWarmup: true, doneAt: null },
		]);
	});

	it("allows bodyweight sets with weight 0", () => {
		const state = addSet(withBench(), "ex-1", {
			id: "set-bw",
			weight: 0,
			reps: 12,
			isWarmup: false,
		});
		expect(sessionOf(state).exercises[0].sets[0].weight).toBe(0);
	});

	it("updates a set without touching its done time or other sets", () => {
		let state = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		state = addSet(state, "ex-1", {
			id: "set-2",
			weight: 62.5,
			reps: 6,
			isWarmup: false,
		});
		state = updateSet(state, "ex-1", "set-1", { weight: 65, isWarmup: true });
		const [first, second] = sessionOf(state).exercises[0].sets;
		expect(first).toEqual({
			id: "set-1",
			weight: 65,
			reps: 8,
			isWarmup: true,
			doneAt: T1,
		});
		expect(second.weight).toBe(62.5);
	});

	it("marks a set done at the given time and can undo it", () => {
		const done = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		expect(sessionOf(done).exercises[0].sets[0].doneAt).toBe(T1);
		const undone = uncompleteSet(done, "ex-1", "set-1");
		expect(sessionOf(undone).exercises[0].sets[0].doneAt).toBeNull();
	});

	it("removes a set and removes an exercise with its sets", () => {
		const noSet = removeSet(withBenchSet(), "ex-1", "set-1");
		expect(sessionOf(noSet).exercises[0].sets).toEqual([]);
		const noExercise = removeExercise(withBenchSet(), "ex-1");
		expect(sessionOf(noExercise).exercises).toEqual([]);
	});

	it("leaves the state untouched for unknown ids or without a session", () => {
		const state = withBenchSet();
		expect(completeSet(state, "nope", "set-1", T1)).toBe(state);
		expect(completeSet(state, "ex-1", "nope", T1)).toBe(state);
		expect(removeSet(state, "ex-1", "nope")).toBe(state);
		expect(removeExercise(state, "nope")).toBe(state);
		expect(
			addSet(NONE, "ex-1", { id: "x", weight: 1, reps: 1, isWarmup: false }),
		).toBe(NONE);
		expect(completeSet(NONE, "ex-1", "set-1", T1)).toBe(NONE);
	});
});

describe("canFinish and beginFinish", () => {
	it("needs at least one done set with valid weight and reps", () => {
		expect(canFinish(NONE)).toBe(false);
		expect(canFinish(withBenchSet())).toBe(false);
		expect(canFinish(completeSet(withBenchSet(), "ex-1", "set-1", T1))).toBe(
			true,
		);
		const zeroReps = updateSet(
			completeSet(withBenchSet(), "ex-1", "set-1", T1),
			"ex-1",
			"set-1",
			{ reps: 0 },
		);
		expect(canFinish(zeroReps)).toBe(false);
	});

	it("moves to finishing keeping the session, name and end time", () => {
		const ready = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		const finishing = beginFinish(ready, { name: "Push day", now: T2 });
		expect(finishing).toEqual({
			status: "finishing",
			session: sessionOf(ready),
			name: "Push day",
			endedAt: T2,
		});
	});

	it("refuses to finish an empty session or a blank name", () => {
		const notReady = withBenchSet();
		expect(beginFinish(notReady, { name: "Push day", now: T2 })).toBe(notReady);
		const ready = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		expect(beginFinish(ready, { name: "   ", now: T2 })).toBe(ready);
	});

	it("freezes edits once finishing", () => {
		const ready = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		const finishing = beginFinish(ready, { name: "Push day", now: T2 });
		expect(
			addExercise(finishing, {
				localId: "ex-9",
				exerciseId: SQUAT,
				exerciseName: "Squat",
			}),
		).toBe(finishing);
		expect(updateSet(finishing, "ex-1", "set-1", { weight: 1 })).toBe(
			finishing,
		);
	});
});

describe("markSynced and discardSession", () => {
	it("becomes synced only from finishing, keeping the workout id", () => {
		const ready = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		const finishing = beginFinish(ready, { name: "Push day", now: T2 });
		expect(markSynced(finishing, "w-1")).toEqual({
			status: "synced",
			workoutId: "w-1",
		});
		expect(markSynced(ready, "w-1")).toBe(ready);
	});

	it("discards an active session but never a finishing one", () => {
		expect(discardSession(withBenchSet())).toEqual({ status: "discarded" });
		const ready = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		const finishing = beginFinish(ready, { name: "Push day", now: T2 });
		expect(discardSession(finishing)).toBe(finishing);
		expect(discardSession(NONE)).toBe(NONE);
	});
});

describe("isSessionStale", () => {
	it("is stale only for an active session open more than 12 hours", () => {
		expect(LIVE_SESSION_MAX_AGE_MS).toBe(12 * 60 * 60 * 1000);
		const state = active();
		const justUnder = new Date(Date.parse(T0) + LIVE_SESSION_MAX_AGE_MS);
		const justOver = new Date(Date.parse(T0) + LIVE_SESSION_MAX_AGE_MS + 1);
		expect(isSessionStale(state, justUnder)).toBe(false);
		expect(isSessionStale(state, justOver)).toBe(true);
	});

	it("is never stale without an active session", () => {
		const farFuture = new Date("2030-01-01T00:00:00.000Z");
		expect(isSessionStale(NONE, farFuture)).toBe(false);
		const ready = completeSet(withBenchSet(), "ex-1", "set-1", T1);
		const finishing = beginFinish(ready, { name: "Push day", now: T2 });
		expect(isSessionStale(finishing, farFuture)).toBe(false);
	});
});

describe("toFinishInput", () => {
	it("builds the contract payload from done sets only, in logged order", () => {
		let state = withBenchSet();
		state = addSet(state, "ex-1", {
			id: "set-2",
			weight: 62.5,
			reps: 6,
			isWarmup: false,
		});
		state = completeSet(state, "ex-1", "set-1", T1);
		state = addExercise(state, {
			localId: "ex-2",
			exerciseId: SQUAT,
			exerciseName: "Squat",
		});
		state = addSet(state, "ex-2", {
			id: "set-3",
			weight: 100,
			reps: 5,
			isWarmup: false,
		});
		state = completeSet(state, "ex-2", "set-3", T2);
		const finishing = beginFinish(state, {
			name: "Leg day",
			now: "2026-10-20T11:00:00.000Z",
		});

		expect(toFinishInput(finishing)).toEqual({
			sessionId: SESSION_ID,
			name: "Leg day",
			startedAt: T0,
			endedAt: "2026-10-20T11:00:00.000Z",
			exercises: [
				{
					exerciseId: BENCH,
					sets: [{ weight: 60, reps: 8, isWarmup: false, doneAt: T1 }],
				},
				{
					exerciseId: SQUAT,
					sets: [{ weight: 100, reps: 5, isWarmup: false, doneAt: T2 }],
				},
			],
		});
	});

	it("omits exercises with no done sets and never emits an order field", () => {
		let state = withBenchSet();
		state = completeSet(state, "ex-1", "set-1", T1);
		state = addExercise(state, {
			localId: "ex-2",
			exerciseId: SQUAT,
			exerciseName: "Squat",
		});
		state = addSet(state, "ex-2", {
			id: "set-x",
			weight: 100,
			reps: 5,
			isWarmup: false,
		});
		const finishing = beginFinish(state, { name: "Push day", now: T2 });
		const payload = toFinishInput(finishing);
		expect(payload?.exercises.map((e) => e.exerciseId)).toEqual([BENCH]);
		expect(JSON.stringify(payload)).not.toContain("order");
	});

	it("returns null unless the state is finishing", () => {
		expect(toFinishInput(NONE)).toBeNull();
		expect(toFinishInput(withBenchSet())).toBeNull();
	});
});
