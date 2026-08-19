import { getExercises, getMuscleGroups } from "@/actions";
import { ExerciseSection } from "./components/ExerciseSection";

export default async function ExercisesPage() {
	const createdExercises = await getExercises();
	const muscles = await getMuscleGroups();
	return (
		<>
			<h1>Mis ejercicios</h1>
			<p className='text-xs text-muted-foreground mt-2'>
				Aquí se mostrarán todos tus ejercicios registrados
			</p>
			<ExerciseSection exerciseList={createdExercises} muscleList={muscles} />
		</>
	);
}
