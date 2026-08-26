import { getWorkoutBySlug } from "@/actions";
import { auth } from "@/auth";
import { ReturnButton } from "@/components";
import { TornStrip } from "@/components/ui/torn-strip";
import { WorkoutDetailSets } from "@/components/workout/WorkoutDetailSets";
import { WorkoutDetail } from "@/interfaces";
import { redirect } from "next/navigation";

interface Props {
	params: Promise<{
		slug: string;
	}>;
}

export default async function WorkoutDetailPage({ params }: Props) {
	const { slug } = await params;
	const session = await auth();
	if (!session) return redirect(`/auth/login?origin=/workouts/${slug}`);
	const workoutDetail = await getWorkoutBySlug(
		decodeURIComponent(slug),
		session.user.id,
	);

	if (!workoutDetail) redirect("/workouts");
	const displayDate = workoutDetail.date
		? new Date(workoutDetail.date).toLocaleDateString()
		: "";
	const setsByExercise = (workoutDetail.sets ?? {}) as WorkoutDetail["sets"];
	return (
		<section>
			<h1>Entrenamiento: {workoutDetail.name}</h1>
			<p className='text-muted-foreground mt-2'>Fecha: {displayDate}</p>
			<div className='my-5 flex flex-col gap-4'>
				{Object.entries(setsByExercise).map(([exerciseName, sets]) => (
					<TornStrip key={exerciseName} seed={exerciseName}>
						<TornStrip.Header title={exerciseName} />
						<TornStrip.Body>
							<WorkoutDetailSets exerciseName={exerciseName} sets={sets} />
						</TornStrip.Body>
					</TornStrip>
				))}
			</div>
			<div className='flex justify-center items-center'>
				<ReturnButton fallbackHref='/workouts'>Regresar</ReturnButton>
			</div>
		</section>
	);
}
