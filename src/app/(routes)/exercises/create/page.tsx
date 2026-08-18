import { getMuscleGroups } from "@/actions";
import { CreateExerciseForm } from "@/components";
import { TornStrip } from "@/components/ui/torn-strip";

export default async function CreateExercisePage() {
	const muscleGroups = await getMuscleGroups();
	return (
		<section className='flex flex-col gap-6'>
			<TornStrip>
				<div className='flex flex-col gap-4'>
					<div>
						<h2>Crear nuevo ejercicio</h2>
						<p className='text-xs text-muted-foreground mt-2'>
							Vamos a añadir la información del ejercicio que quieres crear
						</p>
					</div>
					<CreateExerciseForm listMuscleGroups={muscleGroups} />
				</div>
			</TornStrip>
		</section>
	);
}
