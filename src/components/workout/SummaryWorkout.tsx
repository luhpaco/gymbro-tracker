"use client";
import { LiaDumbbellSolid } from "react-icons/lia";
import { useWorkoutStore } from "@/store";
import { Trash2 } from "lucide-react";
import { SummaryWorkoutForm } from "./SummaryWorkoutForm";
import { TornStrip } from "../ui/torn-strip";
import { EditableStat } from "../ui/editable-stat";
import { setSchema } from "./AddExerciseForm";

const validateWeight = (n: number): string | null => {
	const result = setSchema.shape.weight.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

const validateReps = (n: number): string | null => {
	const result = setSchema.shape.reps.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

export const SummaryWorkout = () => {
	const exercises = useWorkoutStore((state) => state.exercises);
	const removeExercise = useWorkoutStore((state) => state.removeExercise);
	const updateSet = useWorkoutStore((state) => state.updateSet);

	return (
		<TornStrip className='flex flex-col gap-4'>
			<div>
				<h2>Resumen de tu entrenamiento</h2>
				<p className='text-xs text-muted-foreground mt-2'>
					Revisa los ejercicios que has agregado y sus características.
				</p>
			</div>
			<div className='mt-4'>
				{exercises.length > 0 ? (
					<div className='flex flex-col gap-6'>
						{exercises.map((exercise) => {
							const rowsReserved = Math.max(3, exercise.sets.length);
							return (
								<div key={exercise.exerciseValue}>
									<div className='flex items-center justify-between mb-2'>
										<p className='font-semibold flex gap-1 items-center'>
											<LiaDumbbellSolid />
											{exercise.exerciseName}
										</p>
										<button
											type='button'
											className='p-1 text-destructive rounded-md'
											aria-label={`Eliminar ${exercise.exerciseName}`}
											onClick={() =>
												removeExercise(exercise.exerciseValue)
											}
										>
											<Trash2 size={18} />
										</button>
									</div>
									<ol className='reserved-region flex flex-col gap-2'>
										{Array.from({ length: rowsReserved }).map(
											(_, index) => {
												if (index >= exercise.sets.length) {
													return (
														<li key={index} className='h-14'>
															<TornStrip
																flat
																className='torn-strip--ghost h-full flex items-center [&>span]:bg-transparent'
															>
																<div className='flex w-full items-center justify-between'>
																	<span className='text-xs text-muted-foreground'>
																		pending
																	</span>
																</div>
																<TornStrip.Tag>
																	pending
																</TornStrip.Tag>
															</TornStrip>
														</li>
													);
												}
												const set = exercise.sets[index];
												return (
													<li key={index} className='h-14'>
														<TornStrip
															flat
															className='h-full flex items-center'
														>
															<div className='flex w-full items-center justify-between'>
																<div className='flex items-baseline gap-2'>
																	<span className='text-xs text-muted-foreground'>
																		Peso
																	</span>
																	<EditableStat
																		value={set.weight}
																		label={`Peso, serie ${index + 1}, ${exercise.exerciseName}`}
																		unit='kg'
																		onCommit={(next) =>
																			updateSet(
																				exercise.exerciseValue,
																				index,
																				{ weight: next }
																			)
																		}
																		validate={validateWeight}
																	/>
																</div>
																<div className='flex items-baseline gap-2'>
																	<span className='text-xs text-muted-foreground'>
																		Reps
																	</span>
																	<EditableStat
																		value={set.reps}
																		label={`Repeticiones, serie ${index + 1}, ${exercise.exerciseName}`}
																		onCommit={(next) =>
																			updateSet(
																				exercise.exerciseValue,
																				index,
																				{ reps: next }
																			)
																		}
																		validate={validateReps}
																	/>
																</div>
															</div>
														</TornStrip>
													</li>
												);
											}
										)}
									</ol>
								</div>
							);
						})}
					</div>
				) : (
					<p className='text-xs text-center text-muted-foreground'>
						Aquí se mostrarán los ejercicios que vas registrando en tu
						entrenamiento.
					</p>
				)}
			</div>
			<SummaryWorkoutForm exerciseList={exercises} />
		</TornStrip>
	);
};
