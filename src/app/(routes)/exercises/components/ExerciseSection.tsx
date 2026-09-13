"use client";
import { TornStrip } from "@/components/ui/torn-strip";
import { FilterExercises } from "./FilterExercises";
import Link from "next/link";
import { Exercise, MuscleGroup } from "@prisma/client";
import { useExercisesStore } from "@/store";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/ui/use-toast";
import { setExerciseActiveState } from "@/actions/exercise/set-exercise-active-state";

interface Props {
	exerciseList: Exercise[];
	muscleList: MuscleGroup[];
}

export const ExerciseSection = ({ exerciseList, muscleList }: Props) => {
	const { setExercises, filteredExercises, selectedMuscleGroup } =
		useExercisesStore();
	const router = useRouter();
	const { toast } = useToast();
	useEffect(() => {
		setExercises(exerciseList);
	}, [exerciseList, setExercises]);

	const handleDeactivate = async (id: string) => {
		const result = await setExerciseActiveState({ id, isActive: false });

		if (result.ok) {
			router.refresh();
		} else {
			const messages: Record<typeof result.code, string> = {
				unauthorized: "Tu sesión expiró. Vuelve a iniciar sesión.",
				invalid_input: "Revisa los datos del ejercicio e inténtalo de nuevo.",
				not_found: "El ejercicio no existe o no te pertenece.",
				error:
					"Ups, ocurrió un problema al eliminar el ejercicio. Inténtalo de nuevo.",
			};
			toast({
				title: "Error",
				description: messages[result.code],
				variant: "destructive",
			});
		}
	};

	const createHref =
		selectedMuscleGroup && selectedMuscleGroup !== "all"
			? `/exercises/create?muscleGroup=${selectedMuscleGroup}`
			: "/exercises/create";

	return (
		<section className='mt-4 flex flex-col gap-6'>
			<Button asChild>
				<Link href={createHref}>Crear ejercicio</Link>
			</Button>
			<FilterExercises muscleGroups={muscleList} />
			<div className='flex flex-col gap-4'>
				{filteredExercises.length > 0 ? (
					filteredExercises.map((exercise, index) => (
						<TornStrip
							key={index}
							seed={index}
							className='w-full flex flex-col gap-8 text-sm'
						>
							<TornStrip.Header
								title={exercise.name}
								subTitle={
									exercise.description ??
									"No hay descripción para este ejercicio"
								}
							/>
							<TornStrip.Body>
								<div className='flex items-center justify-end gap-2'>
									<Button asChild>
										<Link href={`/exercises/update/${exercise.id}`}>
											Editar
										</Link>
									</Button>
									<Button
										variant='destructive'
										onClick={() => handleDeactivate(exercise.id)}
									>
										Eliminar
									</Button>
								</div>
							</TornStrip.Body>
						</TornStrip>
					))
				) : (
					<>
						<p>No has creado ningún ejercicio para este grupo muscular...</p>
						<p>
							¡Anímate{" "}
							<Link href={createHref} className='underline font-semibold'>
								a crear uno!
							</Link>
						</p>
					</>
				)}
			</div>
		</section>
	);
};
