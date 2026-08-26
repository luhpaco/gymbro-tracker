import { getExerciseById, getMuscleGroups } from "@/actions";
import { auth } from "@/auth";
import { ReturnButton, UpdateExerciseForm } from "@/components";
import { TornStrip } from "@/components/ui/torn-strip";

interface Props {
	params: Promise<{
		id: string;
	}>;
}

import { redirect } from "next/navigation";

export default async function UpdateExercisePage({ params }: Props) {
	const { id } = await params;
	const session = await auth();
	if (!session) return redirect(`/auth/login?origin=/exercises/update/${id}`);
	const muscleGroups = await getMuscleGroups();
	const exercise = await getExerciseById(id, session.user.id);
	if (!exercise) return <div>Exercise not found</div>;
	return (
		<section className='flex flex-col gap-6'>
			<TornStrip>
				<div className='flex flex-col gap-4'>
					<div>
						<h2>Editar ejercicio</h2>
						<p className='text-xs text-muted-foreground mt-2'>
							Vamos a actualizar la información del ejercicio:{" "}
							<span className='font-semibold'>{exercise.name}</span>
						</p>
					</div>
					<UpdateExerciseForm
						listMuscleGroups={muscleGroups}
						exerciseToEdit={exercise}
					/>
				</div>
			</TornStrip>
			<div className='flex justify-center items-center'>
				<ReturnButton variant='link' fallbackHref='/exercises'>
					Regresar
				</ReturnButton>
			</div>
		</section>
	);
}
