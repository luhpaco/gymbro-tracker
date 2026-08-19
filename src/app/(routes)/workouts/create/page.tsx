import { getExercises } from "@/actions";
import { DialogAddExercise, SummaryWorkout } from "@/components";
import { TornStrip } from "@/components/ui/torn-strip";

export default async function CreateWorkoutPage() {
	const allExercisesCreated = await getExercises();
	return (
		<main className='flex flex-col gap-6'>
			<section className='flex flex-col gap-6'>
				<TornStrip className='flex flex-col gap-4'>
					<div>
						<h2>Crear entrenamiento</h2>
						<p className='text-xs text-muted-foreground mt-2'>
							Vamos a crear tu entrenamiento, primero agrega cada uno de tus
							ejercicios con sus series, repeticiones y pesos.
						</p>
					</div>
					<div className='flex flex-col justify-center items-center'>
						<DialogAddExercise listExercises={allExercisesCreated} />
					</div>
				</TornStrip>
			</section>
			<SummaryWorkout />
		</main>
	);
}
