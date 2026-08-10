import { getExercisesSummary, getWorkouts } from "@/actions";
import { auth } from "@/auth";
import { ResumeCard } from "@/components";
import { redirect } from "next/navigation";

export default async function DashboardPage() {
	const session = await auth();
	if (!session?.user) {
		redirect("/auth/login");
	}

	const recentWorkouts = await getWorkouts({
		take: 3,
		userId: session.user.id,
	});
	const exercisesSummary = await getExercisesSummary({
		take: 3,
		orderByTotalSets: "desc",
		userId: session.user.id,
	});
	return (
		<div className='grid grid-cols-1 gap-6'>
			<h1>
				Hola de nuevo, {session.user.firstName} {session.user.lastName}
			</h1>
			<ResumeCard>
				<ResumeCard.Header
					title='Últimos entrenamientos'
					subTitle='Aquí figuran tus últimos entrenamientos registrados'
				/>
				<ResumeCard.Body>
					<div className='flex flex-col gap-4'>
						{recentWorkouts.map((workout) => (
							<div
								className='flex items-center justify-between text-sm'
								key={workout.id}
							>
								<p>{workout.name}</p>
								<p>{workout.date.toLocaleDateString()}</p>
							</div>
						))}
					</div>
				</ResumeCard.Body>
				<ResumeCard.Link text='Ir a tus entrenamientos' href='/workouts' />
			</ResumeCard>
			<ResumeCard>
				<ResumeCard.Header
					title='Resumen de tus ejercicios'
					subTitle='Tus ejercicios con mas series completadas'
				/>
				<ResumeCard.Body>
					<div className='flex flex-col gap-4'>
						{exercisesSummary.map((exercise) => (
							<div
								className='flex items-center justify-between text-sm'
								key={exercise.id}
							>
								<p>{exercise.name}</p>
								<p>{exercise.sets.length} series</p>
							</div>
						))}
					</div>
				</ResumeCard.Body>
				<ResumeCard.Link text='Ir a tus ejercicios' href='/exercises' />
			</ResumeCard>
		</div>
	);
}
