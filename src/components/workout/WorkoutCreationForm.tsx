"use client";

import { useEffect, useRef, useState } from "react";
import {
	Control,
	useFieldArray,
	useForm,
	UseFormSetValue,
	useWatch,
} from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useRouter } from "next/navigation";
import { format } from "date-fns";
import { Check, ChevronsUpDown, Minus, Plus, Trash2 } from "lucide-react";
import { Exercise as ExerciseOption } from "@prisma/client";
import { createWorkout } from "@/actions";
import { AddWorkoutFormSchema, setSchema } from "@/lib/schemas/workout";
import { clearDraft, loadDraft, saveDraft } from "@/lib/workout-draft";
import { useWorkoutDraftSignalStore } from "@/store";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Calendar } from "../ui/calendar";
import {
	Command,
	CommandEmpty,
	CommandGroup,
	CommandInput,
	CommandItem,
	CommandList,
} from "../ui/command";
import { EditableStat } from "../ui/editable-stat";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { Stat } from "../ui/stat";
import { TornStrip } from "../ui/torn-strip";
import { useToast } from "../ui/use-toast";

type FormValues = z.infer<typeof AddWorkoutFormSchema>;

const emptySets = () => [{ reps: 0, weight: 0, isWarmup: false }];

const validateWeight = (n: number): string | null => {
	const result = setSchema.shape.weight.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

const validateReps = (n: number): string | null => {
	const result = setSchema.shape.reps.safeParse(n);
	return result.success ? null : (result.error.issues[0]?.message ?? null);
};

interface ExerciseRowProps {
	control: Control<FormValues>;
	setValue: UseFormSetValue<FormValues>;
	index: number;
	exercisesCreated: ExerciseOption[];
	onRemove: () => void;
}

const ExerciseRow = ({
	control,
	setValue,
	index,
	exercisesCreated,
	onRemove,
}: ExerciseRowProps) => {
	// useFieldArray's own `fields` snapshot does not update on setValue() —
	// only on append/remove/update — so the exercise picker must read the
	// live value via useWatch to reflect a selection immediately.
	const exerciseValue = useWatch({
		control,
		name: `listExercises.${index}.exerciseValue`,
	});
	const exerciseName = useWatch({
		control,
		name: `listExercises.${index}.exerciseName`,
	});
	const [isPickerOpen, setIsPickerOpen] = useState(false);

	const {
		fields: setFields,
		append: appendSet,
		remove: removeSet,
		update: updateSet,
	} = useFieldArray({
		control,
		name: `listExercises.${index}.sets`,
	});

	return (
		<TornStrip>
			<div className='flex flex-col gap-4'>
				<div className='flex items-center gap-2'>
					<FormField
						control={control}
						name={`listExercises.${index}.exerciseValue`}
						render={() => (
							<FormItem className='flex min-w-0 flex-1 flex-col'>
								<FormLabel>Selecciona tu ejercicio:</FormLabel>
								<Popover open={isPickerOpen} onOpenChange={setIsPickerOpen}>
									<PopoverTrigger asChild>
										<FormControl>
											<Button
												variant='outline'
												type='button'
												role='combobox'
												className={cn(
													"w-full min-w-0 justify-between",
													!exerciseValue && "text-muted-foreground",
												)}
											>
												<span className='truncate'>
													{exerciseName || "Selecciona un ejercicio"}
												</span>
												<ChevronsUpDown className='ml-2 h-4 w-4 shrink-0 text-muted-foreground' />
											</Button>
										</FormControl>
									</PopoverTrigger>
									<PopoverContent className='w-full p-0'>
										<Command>
											<CommandInput placeholder='Selecciona un ejercicio...' />
											<CommandEmpty>No se encontró tu ejercicio.</CommandEmpty>
											<CommandGroup>
												<CommandList>
													{exercisesCreated.map((exercise) => (
														<CommandItem
															key={exercise.id}
															value={exercise.name}
															onSelect={() => {
																setValue(
																	`listExercises.${index}.exerciseValue`,
																	exercise.id,
																);
																setValue(
																	`listExercises.${index}.exerciseName`,
																	exercise.name,
																);
																setIsPickerOpen(false);
															}}
														>
															<Check
																className={cn(
																	"mr-2 h-4 w-4 shrink-0",
																	exercise.id === exerciseValue
																		? "opacity-100"
																		: "opacity-0",
																)}
															/>
															<span className='truncate'>{exercise.name}</span>
														</CommandItem>
													))}
												</CommandList>
											</CommandGroup>
										</Command>
									</PopoverContent>
								</Popover>
								<FormMessage />
							</FormItem>
						)}
					/>
					<button
						type='button'
						className='shrink-0 p-1 text-destructive rounded-md'
						aria-label={`Eliminar ${exerciseName || "ejercicio"}`}
						onClick={onRemove}
					>
						<Trash2 size={18} />
					</button>
				</div>

				<div className='flex gap-4 items-center justify-center'>
					<Button
						size='icon'
						type='button'
						disabled={setFields.length <= 1}
						onClick={() => removeSet(setFields.length - 1)}
					>
						<Minus />
					</Button>
					<Stat value={setFields.length} width='2ch' className='text-2xl' />
					<Button
						size='icon'
						type='button'
						onClick={() => appendSet({ reps: 0, weight: 0, isWarmup: false })}
					>
						<Plus />
					</Button>
				</div>

				<ol className='flex flex-col gap-2'>
					{setFields.map((setField, setIndex) => (
						<li key={setField.id} className='h-14'>
							<TornStrip flat>
								<div className='flex h-full items-center justify-between gap-4'>
									<div className='flex items-baseline gap-2'>
										<span className='text-xs text-card-foreground/70'>
											Reps
										</span>
										<EditableStat
											value={setField.reps}
											label={`Repeticiones, serie ${setIndex + 1}, ${exerciseName || "ejercicio"}`}
											onCommit={(next) =>
												updateSet(setIndex, { ...setField, reps: next })
											}
											validate={validateReps}
										/>
									</div>
									<div className='flex items-baseline gap-2'>
										<span className='text-xs text-card-foreground/70'>
											Peso
										</span>
										<EditableStat
											value={setField.weight}
											label={`Peso, serie ${setIndex + 1}, ${exerciseName || "ejercicio"}`}
											unit='kg'
											onCommit={(next) =>
												updateSet(setIndex, { ...setField, weight: next })
											}
											validate={validateWeight}
										/>
									</div>
								</div>
							</TornStrip>
						</li>
					))}
				</ol>
			</div>
		</TornStrip>
	);
};

interface Props {
	exercisesCreated: ExerciseOption[];
}

export const WorkoutCreationForm = ({ exercisesCreated }: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const setExerciseCount = useWorkoutDraftSignalStore(
		(state) => state.setExerciseCount,
	);
	const hydrated = useRef(false);
	const [isCalendarOpen, setIsCalendarOpen] = useState(false);

	const form = useForm<FormValues>({
		resolver: zodResolver(AddWorkoutFormSchema),
		defaultValues: {
			nameWorkout: "",
			tagWorkout: "",
			listExercises: [],
		},
	});

	const { fields, append, remove } = useFieldArray({
		control: form.control,
		name: "listExercises",
	});

	useEffect(() => {
		if (hydrated.current) return;
		hydrated.current = true;
		const draft = loadDraft();
		if (draft && (draft.nameWorkout || draft.listExercises.length > 0)) {
			form.reset(draft as FormValues);
		}
	}, [form]);

	useEffect(() => {
		const subscription = form.watch((values) => {
			const timeout = setTimeout(() => {
				saveDraft({
					nameWorkout: values.nameWorkout ?? "",
					dateWorkout: values.dateWorkout ?? null,
					tagWorkout: values.tagWorkout ?? "",
					listExercises: (values.listExercises ?? []).filter(
						(exercise): exercise is NonNullable<typeof exercise> =>
							exercise !== undefined,
					) as FormValues["listExercises"],
				});
			}, 300);
			return () => clearTimeout(timeout);
		});
		return () => subscription.unsubscribe();
	}, [form]);

	useEffect(() => {
		setExerciseCount(fields.length);
	}, [fields.length, setExerciseCount]);

	const onSubmit = async (data: FormValues) => {
		try {
			const tagWorkout = data.nameWorkout.toLowerCase().replace(/\s+/g, "-");
			const result = await createWorkout({ ...data, tagWorkout });
			if (!result.ok) {
				const messages: Record<typeof result.code, string> = {
					unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión.",
					invalid_input:
						"Revisa los datos de tu entrenamiento e inténtalo de nuevo.",
					error:
						"Ups, ocurrió un problema al guardar el entrenamiento. Inténtalo de nuevo.",
				};
				toast({
					title: "Error",
					description: messages[result.code],
					variant: "destructive",
				});
				return;
			}
			clearDraft();
			form.reset({ nameWorkout: "", tagWorkout: "", listExercises: [] });
			setExerciseCount(0);
			toast({
				title: "Éxito!!!",
				description: `El entrenamiento ${data.nameWorkout} ha sido creado satisfactoriamente.`,
				variant: "default",
			});
			router.push("/workouts");
		} catch (error) {
			toast({
				title: "Error",
				description: `Ups ocurrió un problema, ${error}`,
				variant: "destructive",
			});
			console.error(`Ups ocurrió un problema, ${error}`);
		}
	};

	return (
		<Form {...form}>
			<form
				className='flex flex-col gap-6'
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<TornStrip>
					<div className='flex flex-col gap-4'>
						<FormField
							control={form.control}
							name='nameWorkout'
							render={({ field }) => (
								<FormItem>
									<FormLabel>Nombre del entrenamiento:</FormLabel>
									<FormControl>
										<Input
											{...field}
											placeholder='Ejemplo: Día de pierna'
											type='text'
										/>
									</FormControl>
									<FormMessage />
								</FormItem>
							)}
						/>
						<FormField
							control={form.control}
							name='dateWorkout'
							render={({ field }) => (
								<FormItem className='flex flex-col'>
									<FormLabel>Fecha del entrenamiento:</FormLabel>
									<Popover
										open={isCalendarOpen}
										onOpenChange={setIsCalendarOpen}
									>
										<PopoverTrigger asChild>
											<FormControl>
												<Button
													type='button'
													variant='outline'
													className={cn(
														"w-full pl-3 text-left font-normal",
														field.value
															? "text-foreground"
															: "text-muted-foreground",
													)}
												>
													{field.value ? (
														format(field.value, "PPPP")
													) : (
														<span>Selecciona una fecha</span>
													)}
												</Button>
											</FormControl>
										</PopoverTrigger>
										<PopoverContent className='w-full p-0' align='center'>
											<Calendar
												mode='single'
												selected={field.value}
												onSelect={(e) => {
													field.onChange(e);
													setIsCalendarOpen(false);
												}}
												disabled={(date) =>
													date > new Date() || date < new Date("1900-01-01")
												}
												autoFocus
											/>
										</PopoverContent>
									</Popover>
									<FormMessage />
								</FormItem>
							)}
						/>
					</div>
				</TornStrip>

				<div className='flex flex-col gap-6'>
					{fields.length === 0 ? (
						<p className='text-xs text-center text-card-foreground/70'>
							Aquí se mostrarán los ejercicios que vas registrando en tu
							entrenamiento.
						</p>
					) : (
						fields.map((field, index) => (
							<ExerciseRow
								key={field.id}
								control={form.control}
								setValue={form.setValue}
								index={index}
								exercisesCreated={exercisesCreated}
								onRemove={() => remove(index)}
							/>
						))
					)}
					{form.formState.errors.listExercises?.message && (
						<p className='text-xs text-destructive'>
							{form.formState.errors.listExercises.message}
						</p>
					)}
					<Button
						type='button'
						variant='outline'
						onClick={() =>
							append({
								exerciseValue: "",
								exerciseName: "",
								sets: emptySets(),
							})
						}
					>
						Registrar ejercicio
					</Button>
				</div>

				<Button type='submit' variant='default' className='mt-4'>
					Guardar entrenamiento
				</Button>
			</form>
		</Form>
	);
};
