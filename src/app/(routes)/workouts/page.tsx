import { getWorkouts } from "@/actions";
import { WorkoutsSection } from "./components/WorkoutsSection";
import { WorkoutToDisplay } from "@/interfaces";
import { auth } from "@/auth";
import { redirect } from "next/navigation";

export default async function WorkoutsPage() {
	const session = await auth();
	if (!session?.user) {
		redirect("/auth/login");
	}
	const createdWorkouts: WorkoutToDisplay[] = await getWorkouts({
		userId: session.user.id,
	});

	return (
		<section>
			<h1>Entrenamientos</h1>
			<p className='text-sm text-muted-foreground mt-2'>
				Aquí se mostrarán todos tus entrenamientos registrados
			</p>
			<WorkoutsSection workoutsToDisplay={createdWorkouts} />
		</section>
	);
}
