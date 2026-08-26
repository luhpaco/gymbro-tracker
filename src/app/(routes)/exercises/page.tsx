import { getExercises, getMuscleGroups } from "@/actions";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { ExerciseSection } from "./components/ExerciseSection";

export default async function ExercisesPage() {
	const session = await auth();
	if (!session) return redirect("/auth/login?origin=/exercises");
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
