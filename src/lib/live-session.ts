import { setSchema } from "./schemas/workout-set";

// A live session older than this is offered to the user as "finish or discard".
export const LIVE_SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;

// Timestamps are ISO strings so the whole state is JSON-safe for persistence.
export interface LiveSet {
	id: string;
	weight: number;
	reps: number;
	isWarmup: boolean;
	doneAt: string | null;
}

export interface LiveExercise {
	localId: string;
	exerciseId: string;
	exerciseName: string;
	sets: LiveSet[];
}

export interface LiveSession {
	id: string;
	startedAt: string;
	exercises: LiveExercise[];
}

export type LiveSessionState =
	| { status: "none" }
	| { status: "active"; session: LiveSession }
	| {
			status: "finishing";
			session: LiveSession;
			name: string;
			endedAt: string;
	  }
	| { status: "synced"; workoutId: string }
	| { status: "discarded" };

// Mirrors `FinishLiveSessionInput` (src/lib/schemas/live-session.ts) with ISO string dates.
export interface FinishPayload {
	sessionId: string;
	name: string;
	startedAt: string;
	endedAt: string;
	exercises: Array<{
		exerciseId: string;
		sets: Array<{
			weight: number;
			reps: number;
			isWarmup: boolean;
			doneAt: string;
		}>;
	}>;
}

export interface NewLiveSet {
	id: string;
	weight: number;
	reps: number;
	isWarmup: boolean;
}

// Every transition is pure and returns the same reference when it is a no-op, so
// callers can detect a refused transition with `===`.

export const startSession = (
	state: LiveSessionState,
	input: { id: string; now: string },
): LiveSessionState => {
	if (state.status === "active" || state.status === "finishing") return state;
	return {
		status: "active",
		session: { id: input.id, startedAt: input.now, exercises: [] },
	};
};

const editSession = (
	state: LiveSessionState,
	edit: (session: LiveSession) => LiveSession,
): LiveSessionState => {
	if (state.status !== "active") return state;
	const next = edit(state.session);
	return next === state.session ? state : { status: "active", session: next };
};

const editExercise = (
	session: LiveSession,
	localId: string,
	edit: (exercise: LiveExercise) => LiveExercise,
): LiveSession => {
	const index = session.exercises.findIndex((e) => e.localId === localId);
	if (index === -1) return session;
	const current = session.exercises[index];
	const next = edit(current);
	if (next === current) return session;
	const exercises = [...session.exercises];
	exercises[index] = next;
	return { ...session, exercises };
};

const editSet = (
	session: LiveSession,
	exerciseLocalId: string,
	setId: string,
	edit: (set: LiveSet) => LiveSet,
): LiveSession =>
	editExercise(session, exerciseLocalId, (exercise) => {
		const index = exercise.sets.findIndex((s) => s.id === setId);
		if (index === -1) return exercise;
		const sets = [...exercise.sets];
		sets[index] = edit(sets[index]);
		return { ...exercise, sets };
	});

export const addExercise = (
	state: LiveSessionState,
	input: { localId: string; exerciseId: string; exerciseName: string },
): LiveSessionState =>
	editSession(state, (session) =>
		session.exercises.some((e) => e.localId === input.localId)
			? session
			: {
					...session,
					exercises: [...session.exercises, { ...input, sets: [] }],
				},
	);

export const removeExercise = (
	state: LiveSessionState,
	localId: string,
): LiveSessionState =>
	editSession(state, (session) =>
		session.exercises.some((e) => e.localId === localId)
			? {
					...session,
					exercises: session.exercises.filter((e) => e.localId !== localId),
				}
			: session,
	);

export const addSet = (
	state: LiveSessionState,
	exerciseLocalId: string,
	set: NewLiveSet,
): LiveSessionState =>
	editSession(state, (session) =>
		editExercise(session, exerciseLocalId, (exercise) => ({
			...exercise,
			sets: [...exercise.sets, { ...set, doneAt: null }],
		})),
	);

export const updateSet = (
	state: LiveSessionState,
	exerciseLocalId: string,
	setId: string,
	patch: Partial<Pick<LiveSet, "weight" | "reps" | "isWarmup">>,
): LiveSessionState =>
	editSession(state, (session) =>
		editSet(session, exerciseLocalId, setId, (set) => ({ ...set, ...patch })),
	);

export const removeSet = (
	state: LiveSessionState,
	exerciseLocalId: string,
	setId: string,
): LiveSessionState =>
	editSession(state, (session) =>
		editExercise(session, exerciseLocalId, (exercise) =>
			exercise.sets.some((s) => s.id === setId)
				? { ...exercise, sets: exercise.sets.filter((s) => s.id !== setId) }
				: exercise,
		),
	);

export const completeSet = (
	state: LiveSessionState,
	exerciseLocalId: string,
	setId: string,
	now: string,
): LiveSessionState =>
	editSession(state, (session) =>
		editSet(session, exerciseLocalId, setId, (set) => ({
			...set,
			doneAt: now,
		})),
	);

export const uncompleteSet = (
	state: LiveSessionState,
	exerciseLocalId: string,
	setId: string,
): LiveSessionState =>
	editSession(state, (session) =>
		editSet(session, exerciseLocalId, setId, (set) => ({
			...set,
			doneAt: null,
		})),
	);

const doneSets = (session: LiveSession): LiveSet[] =>
	session.exercises.flatMap((e) => e.sets).filter((s) => s.doneAt !== null);

// A session can finish when it has at least one done set and every done set passes
// the same weight/reps rules the server applies (weight >= 0, integer reps >= 1).
export const canFinish = (state: LiveSessionState): boolean => {
	if (state.status !== "active") return false;
	const done = doneSets(state.session);
	return (
		done.length > 0 && done.every((set) => setSchema.safeParse(set).success)
	);
};

export const beginFinish = (
	state: LiveSessionState,
	input: { name: string; now: string },
): LiveSessionState => {
	const name = input.name.trim();
	if (state.status !== "active" || !canFinish(state) || name === "") {
		return state;
	}
	return {
		status: "finishing",
		session: state.session,
		name,
		endedAt: input.now,
	};
};

// Lets the user fix a session the server refused, instead of leaving it stuck in the upload queue.
export const reopenSession = (state: LiveSessionState): LiveSessionState =>
	state.status === "finishing"
		? { status: "active", session: state.session }
		: state;

export const markSynced = (
	state: LiveSessionState,
	workoutId: string,
): LiveSessionState =>
	state.status === "finishing" ? { status: "synced", workoutId } : state;

// A finishing session is queued for upload and can no longer be discarded.
export const discardSession = (state: LiveSessionState): LiveSessionState =>
	state.status === "active" ? { status: "discarded" } : state;

export const isSessionStale = (state: LiveSessionState, now: Date): boolean =>
	state.status === "active" &&
	now.getTime() - Date.parse(state.session.startedAt) > LIVE_SESSION_MAX_AGE_MS;

// Only done sets are sent, in logged order; `order` is server-owned and never emitted.
export const toFinishInput = (
	state: LiveSessionState,
): FinishPayload | null => {
	if (state.status !== "finishing") return null;
	const exercises = state.session.exercises
		.map((exercise) => ({
			exerciseId: exercise.exerciseId,
			sets: exercise.sets.flatMap((set) =>
				set.doneAt === null
					? []
					: [
							{
								weight: set.weight,
								reps: set.reps,
								isWarmup: set.isWarmup,
								doneAt: set.doneAt,
							},
						],
			),
		}))
		.filter((exercise) => exercise.sets.length > 0);
	return {
		sessionId: state.session.id,
		name: state.name,
		startedAt: state.session.startedAt,
		endedAt: state.endedAt,
		exercises,
	};
};
