import { create } from "zustand";
import {
	type LiveSessionState,
	addExercise,
	addSet,
	beginFinish,
	completeSet,
	discardSession,
	isSessionStale,
	markSynced,
	removeExercise,
	removeSet,
	reopenSession,
	startSession,
	uncompleteSet,
	updateSet,
} from "@/lib/live-session";
import {
	type SessionStorageLike,
	loadLiveSession,
	saveLiveSession,
} from "@/lib/live-session-storage";

interface LiveSessionDeps {
	// Left undefined, the browser's localStorage is used.
	storage?: SessionStorageLike;
	newId: () => string;
	now: () => Date;
}

type SetPatch = Parameters<typeof updateSet>[3];

export interface LiveSessionStore {
	state: LiveSessionState;
	hydrated: boolean;
	hydrate: () => void;
	start: () => void;
	addExercise: (exerciseId: string, exerciseName: string) => void;
	removeExercise: (localId: string) => void;
	addSet: (exerciseLocalId: string) => void;
	updateSet: (exerciseLocalId: string, setId: string, patch: SetPatch) => void;
	removeSet: (exerciseLocalId: string, setId: string) => void;
	toggleSetDone: (exerciseLocalId: string, setId: string) => void;
	finish: (name: string) => void;
	reopen: () => void;
	markSynced: (workoutId: string) => void;
	discard: () => void;
	isStale: () => boolean;
}

const defaultDeps: LiveSessionDeps = {
	newId: () => crypto.randomUUID(),
	now: () => new Date(),
};

// Every action goes through the pure transitions in `@/lib/live-session` and then
// persists the result, so a reload recovers exactly what the user last saw.
export const createLiveSessionStore = (deps: LiveSessionDeps = defaultDeps) =>
	create<LiveSessionStore>()((set, get) => {
		const iso = () => deps.now().toISOString();
		const apply = (next: LiveSessionState) => {
			if (next === get().state) return;
			set({ state: next });
			saveLiveSession(next, deps.storage);
		};

		return {
			state: { status: "none" },
			hydrated: false,
			hydrate: () =>
				set({ state: loadLiveSession(deps.storage), hydrated: true }),
			start: () =>
				apply(startSession(get().state, { id: deps.newId(), now: iso() })),
			addExercise: (exerciseId, exerciseName) =>
				apply(
					addExercise(get().state, {
						localId: deps.newId(),
						exerciseId,
						exerciseName,
					}),
				),
			removeExercise: (localId) => apply(removeExercise(get().state, localId)),
			addSet: (exerciseLocalId) => {
				const current = get().state;
				if (current.status !== "active") return;
				const exercise = current.session.exercises.find(
					(e) => e.localId === exerciseLocalId,
				);
				if (!exercise) return;
				// Copy the previous set so repeating a set is a single tap.
				const previous = exercise.sets[exercise.sets.length - 1];
				apply(
					addSet(current, exerciseLocalId, {
						id: deps.newId(),
						weight: previous?.weight ?? 0,
						reps: previous?.reps ?? 0,
						isWarmup: false,
					}),
				);
			},
			updateSet: (exerciseLocalId, setId, patch) =>
				apply(updateSet(get().state, exerciseLocalId, setId, patch)),
			removeSet: (exerciseLocalId, setId) =>
				apply(removeSet(get().state, exerciseLocalId, setId)),
			toggleSetDone: (exerciseLocalId, setId) => {
				const current = get().state;
				if (current.status !== "active") return;
				const target = current.session.exercises
					.find((e) => e.localId === exerciseLocalId)
					?.sets.find((s) => s.id === setId);
				if (!target) return;
				apply(
					target.doneAt === null
						? completeSet(current, exerciseLocalId, setId, iso())
						: uncompleteSet(current, exerciseLocalId, setId),
				);
			},
			finish: (name) => apply(beginFinish(get().state, { name, now: iso() })),
			reopen: () => apply(reopenSession(get().state)),
			markSynced: (workoutId) => apply(markSynced(get().state, workoutId)),
			discard: () => apply(discardSession(get().state)),
			isStale: () => isSessionStale(get().state, deps.now()),
		};
	});

export const useLiveSessionStore = createLiveSessionStore();
