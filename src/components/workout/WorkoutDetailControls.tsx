"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { addSets } from "@/actions/workout/add-sets";
import { deleteSet } from "@/actions/workout/delete-set";
import { removeWorkoutExercise } from "@/actions/workout/remove-workout-exercise";
import { updateWorkout } from "@/actions/workout/update-workout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TornStrip } from "@/components/ui/torn-strip";
import { useToast } from "@/components/ui/use-toast";
import type { DataItem } from "@/interfaces";
import { Check, Trash2, X } from "lucide-react";

import { WorkoutDetailSets } from "./WorkoutDetailSets";
import {
	buildAddSetPayload,
	formatDateForInput,
	getMutationMessage,
	isPending,
	parseDateInput,
	validateAddSetDraft,
	type ExerciseSetGroup,
	type PendingConfirmation,
} from "./workout-detail-controls.logic";

export interface WorkoutDetailControlsProps {
	workoutId: string;
	storedTag: string;
	name: string;
	date: string;
	exercises: ExerciseSetGroup<DataItem>[];
}

interface AddSetDraft {
	weight: string;
	reps: string;
	isWarmup: boolean;
}

const buildEmptyDrafts = (
	exercises: ExerciseSetGroup<DataItem>[],
): Record<string, AddSetDraft> => {
	const drafts: Record<string, AddSetDraft> = {};
	for (const exercise of exercises) {
		drafts[exercise.exerciseId] = { weight: "", reps: "", isWarmup: false };
	}
	return drafts;
};

export const WorkoutDetailControls = ({
	workoutId,
	name,
	date,
	exercises,
}: WorkoutDetailControlsProps) => {
	const router = useRouter();
	const { toast } = useToast();
	const [pending, setPending] = useState<PendingConfirmation>(null);
	const [metadataName, setMetadataName] = useState(name);
	const [metadataDate, setMetadataDate] = useState(formatDateForInput(date));
	const [addSetDrafts, setAddSetDrafts] = useState<Record<string, AddSetDraft>>(
		() => buildEmptyDrafts(exercises),
	);
	const [submitting, setSubmitting] = useState<Record<string, boolean>>({});

	const setSubmittingKey = (key: string, value: boolean) => {
		setSubmitting((prev) => ({ ...prev, [key]: value }));
	};

	const showError = (code: Parameters<typeof getMutationMessage>[0]) => {
		toast({
			title: "Error",
			description: getMutationMessage(code),
			variant: "destructive",
		});
	};

	const showSuccess = (description: string) => {
		toast({
			title: "Éxito",
			description,
			variant: "default",
		});
	};

	const handleUpdateMetadata = async (
		event: React.FormEvent<HTMLFormElement>,
	) => {
		event.preventDefault();
		const parsedDate = parseDateInput(metadataDate);
		if (!parsedDate) {
			showError("invalid_input");
			return;
		}

		setSubmittingKey("metadata", true);
		const result = await updateWorkout({
			workoutId,
			nameWorkout: metadataName.trim(),
			dateWorkout: parsedDate,
		});
		setSubmittingKey("metadata", false);

		if (result.ok) {
			showSuccess("Entrenamiento actualizado.");
			router.refresh();
		} else {
			showError(result.code);
		}
	};

	const handleAddSet = async (exerciseId: string) => {
		const draft = addSetDrafts[exerciseId];
		const values = validateAddSetDraft(draft);
		if (!values) {
			showError("invalid_input");
			return;
		}

		setSubmittingKey(`add-${exerciseId}`, true);
		const result = await addSets(
			buildAddSetPayload(workoutId, exerciseId, {
				...values,
				isWarmup: draft.isWarmup,
			}),
		);
		setSubmittingKey(`add-${exerciseId}`, false);

		if (result.ok) {
			showSuccess("Serie agregada.");
			setAddSetDrafts((prev) => ({
				...prev,
				[exerciseId]: { weight: "", reps: "", isWarmup: false },
			}));
			setPending(null);
			router.refresh();
		} else {
			showError(result.code);
		}
	};

	const requestRemove = (kind: "set" | "exercise", id: string) => {
		setPending((current) => {
			if (current?.kind === kind && current.id === id) return current;
			return { kind, id };
		});
	};

	const cancelPending = () => setPending(null);

	const confirmDeleteSet = async (setId: string) => {
		setSubmittingKey(`set-${setId}`, true);
		const result = await deleteSet({ workoutId, setId });
		setSubmittingKey(`set-${setId}`, false);

		if (result.ok) {
			showSuccess("Serie eliminada.");
			setPending(null);
			router.refresh();
		} else {
			showError(result.code);
		}
	};

	const confirmRemoveExercise = async (exerciseId: string) => {
		setSubmittingKey(`exercise-${exerciseId}`, true);
		const result = await removeWorkoutExercise({ workoutId, exerciseId });
		setSubmittingKey(`exercise-${exerciseId}`, false);

		if (result.ok) {
			showSuccess("Ejercicio eliminado.");
			setPending(null);
			router.refresh();
		} else {
			showError(result.code);
		}
	};

	const updateDraft = (exerciseId: string, patch: Partial<AddSetDraft>) => {
		setAddSetDrafts((prev) => ({
			...prev,
			[exerciseId]: { ...prev[exerciseId], ...patch },
		}));
	};

	// The set whose removal request is in flight, if any, so the row can disable
	// its confirm control while the single pending confirmation stays locked.
	const submittingSetId =
		pending?.kind === "set" && submitting[`set-${pending.id}`]
			? pending.id
			: null;

	return (
		<div className='flex flex-col gap-6'>
			<form
				className='flex flex-col gap-4'
				onSubmit={handleUpdateMetadata}
				aria-label='Editar nombre y fecha del entrenamiento'
			>
				<div className='flex flex-col gap-2'>
					<Label htmlFor='workout-name'>Nombre del entrenamiento</Label>
					<Input
						id='workout-name'
						type='text'
						value={metadataName}
						onChange={(event) => setMetadataName(event.target.value)}
						className='min-h-11'
					/>
				</div>
				<div className='flex flex-col gap-2'>
					<Label htmlFor='workout-date'>Fecha del entrenamiento</Label>
					<Input
						id='workout-date'
						type='date'
						value={metadataDate}
						onChange={(event) => setMetadataDate(event.target.value)}
						className='min-h-11'
					/>
				</div>
				<Button
					type='submit'
					disabled={submitting.metadata}
					className='min-h-11 w-full'
				>
					Guardar cambios
				</Button>
			</form>

			{exercises.map((exercise) => (
				<section
					key={exercise.exerciseId}
					className='flex flex-col gap-4'
					aria-label={exercise.exerciseName}
				>
					<TornStrip seed={exercise.exerciseName}>
						<div className='flex items-start justify-between gap-4'>
							<TornStrip.Header title={exercise.exerciseName} />
							{isPending(pending, "exercise", exercise.exerciseId) ? (
								<div className='flex items-center gap-2'>
									<span className='text-sm text-muted-foreground'>
										¿Eliminar ejercicio?
									</span>
									<Button
										type='button'
										size='icon'
										variant='destructive'
										aria-label={`Confirmar eliminar ${exercise.exerciseName}`}
										disabled={submitting[`exercise-${exercise.exerciseId}`]}
										onClick={() => confirmRemoveExercise(exercise.exerciseId)}
										className='min-h-11 min-w-11'
									>
										<Check className='h-5 w-5' />
									</Button>
									<Button
										type='button'
										size='icon'
										variant='outline'
										aria-label='Cancelar eliminación'
										onClick={cancelPending}
										className='min-h-11 min-w-11'
									>
										<X className='h-5 w-5' />
									</Button>
								</div>
							) : (
								<Button
									type='button'
									size='icon'
									variant='ghost'
									aria-label={`Eliminar ejercicio ${exercise.exerciseName}`}
									onClick={() => requestRemove("exercise", exercise.exerciseId)}
									className='min-h-11 min-w-11 text-destructive'
								>
									<Trash2 className='h-5 w-5' />
								</Button>
							)}
						</div>

						<TornStrip.Body className='mt-4'>
							<WorkoutDetailSets
								exerciseName={exercise.exerciseName}
								sets={exercise.sets}
								removal={{
									pendingId: pending?.kind === "set" ? pending.id : null,
									submittingId: submittingSetId,
									onRequestRemove: (setId) => requestRemove("set", setId),
									onConfirmRemove: confirmDeleteSet,
									onCancelRemove: cancelPending,
								}}
							/>
						</TornStrip.Body>
					</TornStrip>

					<form
						className='flex flex-col gap-3'
						onSubmit={(event) => {
							event.preventDefault();
							handleAddSet(exercise.exerciseId);
						}}
						aria-label={`Agregar serie a ${exercise.exerciseName}`}
					>
						<div className='flex flex-col gap-2 sm:flex-row sm:items-end sm:gap-3'>
							<div className='flex flex-col gap-1'>
								<Label
									htmlFor={`weight-${exercise.exerciseId}`}
									className='text-sm'
								>
									Peso (kg)
								</Label>
								<Input
									id={`weight-${exercise.exerciseId}`}
									type='number'
									inputMode='decimal'
									value={addSetDrafts[exercise.exerciseId]?.weight ?? ""}
									onChange={(event) =>
										updateDraft(exercise.exerciseId, {
											weight: event.target.value,
										})
									}
									className='min-h-11'
								/>
							</div>
							<div className='flex flex-col gap-1'>
								<Label
									htmlFor={`reps-${exercise.exerciseId}`}
									className='text-sm'
								>
									Reps
								</Label>
								<Input
									id={`reps-${exercise.exerciseId}`}
									type='number'
									inputMode='numeric'
									value={addSetDrafts[exercise.exerciseId]?.reps ?? ""}
									onChange={(event) =>
										updateDraft(exercise.exerciseId, {
											reps: event.target.value,
										})
									}
									className='min-h-11'
								/>
							</div>
							<div className='flex items-center gap-2 min-h-11'>
								<input
									id={`warmup-${exercise.exerciseId}`}
									type='checkbox'
									checked={addSetDrafts[exercise.exerciseId]?.isWarmup ?? false}
									onChange={(event) =>
										updateDraft(exercise.exerciseId, {
											isWarmup: event.target.checked,
										})
									}
									className='h-5 w-5 accent-primary'
								/>
								<Label
									htmlFor={`warmup-${exercise.exerciseId}`}
									className='text-sm'
								>
									Calentamiento
								</Label>
							</div>
						</div>
						<Button
							type='submit'
							disabled={submitting[`add-${exercise.exerciseId}`]}
							className='min-h-11 w-full'
						>
							Agregar serie
						</Button>
					</form>
				</section>
			))}
		</div>
	);
};
