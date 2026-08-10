import { getExerciseById, getMuscleGroups } from "@/actions";
import { auth } from "@/auth";
import { ReturnButton, UpdateExerciseForm } from "@/components";

interface Props {
	params: Promise<{
		id: string;
	}>;
}

export default async function UpdateExercisePage({ params }: Props) {
	const { id } = await params;
	const muscleGroups = await getMuscleGroups();
	const session = await auth();
	const exercise = await getExerciseById(id, session!.user.id);
	if (!exercise) return <div>Exercise not found</div>;
	return (
		<section className='flex flex-col gap-6'>
			<div className='flex flex-col gap-4 border border-gray-300 shadow-md p-6 rounded-md'>
				<div>
					<h2>Editar ejercicio</h2>
					<p className='text-xs text-gray-400 mt-2'>
						Vamos a actualizar la información del ejercicio:{" "}
						<span className='font-semibold'>{exercise.name}</span>
					</p>
				</div>
				<UpdateExerciseForm
					listMuscleGroups={muscleGroups}
					exerciseToEdit={exercise}
				/>
			</div>
			<div className='flex justify-center items-center'>
				<ReturnButton variant='link'>Regresar</ReturnButton>
			</div>
		</section>
	);
}
