import { getExercises } from "@/actions";
import { WorkoutCreationForm } from "@/components";
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
							Agrega el nombre, la fecha y cada uno de tus ejercicios con sus
							series, repeticiones y pesos, y guarda todo de una vez.
						</p>
					</div>
				</TornStrip>
			</section>
			<WorkoutCreationForm exercisesCreated={allExercisesCreated} />
		</main>
	);
}
