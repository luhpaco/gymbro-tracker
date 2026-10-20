"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { finishLiveSession } from "@/actions/workout/finish-live-session";
import { canFinish, toFinishInput } from "@/lib/live-session";
import { useLiveSessionStore } from "@/store";
import { Button } from "../../ui/button";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "../../ui/dialog";
import { Input } from "../../ui/input";
import { TornStrip } from "../../ui/torn-strip";
import { useToast } from "../../ui/use-toast";
import { ExercisePicker } from "./ExercisePicker";
import { LiveSetRow } from "./LiveSetRow";

interface LiveSessionScreenProps {
	exercises: ReadonlyArray<{ id: string; name: string }>;
}

const defaultWorkoutName = () =>
	`Entrenamiento ${new Date().toLocaleDateString("es", {
		day: "numeric",
		month: "long",
	})}`;

const REFUSAL_MESSAGES = {
	unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión para subirlo.",
	invalid_input:
		"Revisa los datos de tu entrenamiento. Edítalo y vuelve a terminarlo.",
	exercise_not_found:
		"Uno de los ejercicios ya no existe. Quítalo y vuelve a terminarlo.",
	duplicate_tag:
		"Ya tienes varios entrenamientos con ese nombre en esa fecha. Cambia el nombre e inténtalo de nuevo.",
	error: "Ups, ocurrió un problema al guardar. Reintenta en unos segundos.",
} as const;

export const LiveSessionScreen = ({ exercises }: LiveSessionScreenProps) => {
	const router = useRouter();
	const { toast } = useToast();
	const store = useLiveSessionStore();
	const { state, hydrated } = store;
	const [name, setName] = useState(defaultWorkoutName);
	const [uploading, setUploading] = useState(false);
	const [uploadMessage, setUploadMessage] = useState<string | null>(null);
	const [confirmDiscard, setConfirmDiscard] = useState(false);
	const uploadingRef = useRef(false);

	useEffect(() => {
		if (!hydrated) store.hydrate();
	}, [hydrated, store]);

	const upload = useCallback(async () => {
		const current = useLiveSessionStore.getState().state;
		const payload = toFinishInput(current);
		if (!payload || uploadingRef.current) return;
		uploadingRef.current = true;
		setUploading(true);
		setUploadMessage(null);
		try {
			const result = await finishLiveSession(payload);
			if (result.ok) {
				useLiveSessionStore.getState().markSynced(result.workout.id);
				toast({
					title: "Éxito!!!",
					description: `El entrenamiento ${result.workout.name} ha sido guardado.`,
				});
				router.push(`/workouts/${result.workout.tag}`);
				return;
			}
			setUploadMessage(REFUSAL_MESSAGES[result.code]);
			// The server will keep refusing these inputs, so give the user a way back to editing.
			if (
				result.code === "invalid_input" ||
				result.code === "exercise_not_found" ||
				result.code === "duplicate_tag"
			) {
				useLiveSessionStore.getState().reopen();
			}
		} catch {
			// No connection: the finished session stays on the device and is retried.
			setUploadMessage(
				"Sin conexión. Tu entrenamiento está guardado en este dispositivo y se subirá cuando vuelva la señal.",
			);
		} finally {
			uploadingRef.current = false;
			setUploading(false);
		}
	}, [router, toast]);

	useEffect(() => {
		if (hydrated && state.status === "finishing") void upload();
	}, [hydrated, state.status, upload]);

	if (!hydrated) {
		return (
			<TornStrip>
				<p className='text-sm text-muted-foreground'>
					Cargando tu entrenamiento...
				</p>
			</TornStrip>
		);
	}

	if (
		state.status === "none" ||
		state.status === "synced" ||
		state.status === "discarded"
	) {
		return (
			<TornStrip className='flex flex-col gap-4'>
				<div className='flex flex-col gap-2'>
					<h2>Entrenamiento en vivo</h2>
					<p className='text-xs text-muted-foreground'>
						Registra cada serie al terminarla. Tu entrenamiento queda guardado
						en este dispositivo y se sube al final.
					</p>
				</div>
				<Button className='h-14 w-full text-base' onClick={store.start}>
					Iniciar entrenamiento
				</Button>
			</TornStrip>
		);
	}

	if (state.status === "finishing") {
		return (
			<TornStrip className='flex flex-col gap-4'>
				<div className='flex flex-col gap-2'>
					<h2>{state.name}</h2>
					<p className='text-xs text-muted-foreground' role='status'>
						{uploading
							? "Subiendo tu entrenamiento..."
							: (uploadMessage ?? "Tu entrenamiento está listo para subirse.")}
					</p>
				</div>
				<Button
					className='h-12 w-full'
					disabled={uploading}
					onClick={() => void upload()}
				>
					Reintentar subida
				</Button>
				<Button
					variant='outline'
					className='h-12 w-full'
					disabled={uploading}
					onClick={store.reopen}
				>
					Editar de nuevo
				</Button>
			</TornStrip>
		);
	}

	const { session } = state;
	const ready = canFinish(state);

	return (
		<div className='flex flex-col gap-6'>
			<TornStrip>
				<div className='flex flex-col gap-2'>
					<h2>Entrenamiento en curso</h2>
					<p className='text-xs text-muted-foreground'>
						Marca cada serie al terminarla. Si cierras la app, tu entrenamiento
						sigue aquí.
					</p>
				</div>
			</TornStrip>

			{session.exercises.length === 0 ? (
				<p className='text-center text-xs text-card-foreground/70'>
					Agrega tu primer ejercicio para empezar a registrar series.
				</p>
			) : (
				session.exercises.map((exercise) => (
					<TornStrip key={exercise.localId} seed={exercise.localId}>
						<div className='flex flex-col gap-3'>
							<div className='flex items-center justify-between gap-2'>
								<h3 className='min-w-0 truncate'>{exercise.exerciseName}</h3>
								<button
									type='button'
									className='inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-destructive hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
									aria-label={`Quitar ${exercise.exerciseName}`}
									onClick={() => store.removeExercise(exercise.localId)}
								>
									<Trash2 size={18} aria-hidden />
								</button>
							</div>
							<ol className='flex flex-col'>
								{exercise.sets.map((set, index) => (
									<LiveSetRow
										key={set.id}
										set={set}
										number={index + 1}
										exerciseName={exercise.exerciseName}
										onChange={(patch) =>
											store.updateSet(exercise.localId, set.id, patch)
										}
										onToggleWarmup={() =>
											store.updateSet(exercise.localId, set.id, {
												isWarmup: !set.isWarmup,
											})
										}
										onToggleDone={() =>
											store.toggleSetDone(exercise.localId, set.id)
										}
										onRemove={() => store.removeSet(exercise.localId, set.id)}
									/>
								))}
							</ol>
							<Button
								type='button'
								variant='outline'
								className='h-12 w-full'
								onClick={() => store.addSet(exercise.localId)}
							>
								Agregar serie
							</Button>
						</div>
					</TornStrip>
				))
			)}

			<ExercisePicker exercises={exercises} onPick={store.addExercise} />

			<TornStrip>
				<div className='flex flex-col gap-3'>
					<label htmlFor='live-workout-name' className='text-sm font-medium'>
						Nombre del entrenamiento:
					</label>
					<Input
						id='live-workout-name'
						value={name}
						onChange={(event) => setName(event.target.value)}
						className='h-12'
					/>
					<Button
						className='h-14 w-full text-base'
						disabled={!ready || name.trim() === ""}
						onClick={() => store.finish(name)}
					>
						Terminar entrenamiento
					</Button>
					{!ready && (
						<p className='text-xs text-muted-foreground'>
							Marca al menos una serie como hecha para poder terminar.
						</p>
					)}
					<Button
						type='button'
						variant='ghost'
						className='h-11 w-full text-destructive'
						onClick={() => setConfirmDiscard(true)}
					>
						Descartar entrenamiento
					</Button>
				</div>
			</TornStrip>

			<Dialog open={confirmDiscard} onOpenChange={setConfirmDiscard}>
				<DialogContent className='inset-x-0 bottom-0 top-auto w-full max-w-none translate-x-0 translate-y-0 rounded-t-xl border-border bg-secondary px-6 pb-[calc(1.5rem+env(safe-area-inset-bottom))] pt-6 sm:rounded-t-xl'>
					<DialogHeader>
						<DialogTitle>¿Descartar este entrenamiento?</DialogTitle>
						<DialogDescription>
							Se perderán las series que registraste. Esta acción no se puede
							deshacer.
						</DialogDescription>
					</DialogHeader>
					<div className='mt-2 flex flex-col gap-2'>
						<Button
							variant='destructive'
							className='h-12'
							onClick={() => {
								store.discard();
								setConfirmDiscard(false);
							}}
						>
							Sí, descartar
						</Button>
						<DialogClose asChild>
							<Button variant='outline' className='h-12'>
								Seguir entrenando
							</Button>
						</DialogClose>
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
};
