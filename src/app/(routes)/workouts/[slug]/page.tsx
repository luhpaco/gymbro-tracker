import { getWorkoutBySlug } from "@/actions";
import { auth } from "@/auth";
import { ReturnButton } from "@/components";
import { WorkoutDeleteConfirmation } from "@/components/workout/WorkoutDeleteConfirmation";
import { WorkoutDetailControls } from "@/components/workout/WorkoutDetailControls";
import { buildExerciseGroups } from "@/components/workout/workout-detail-controls.logic";
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
	const workoutDate = new Date(workoutDetail.date);
	const hasDate =
		Boolean(workoutDetail.date) && !Number.isNaN(workoutDate.getTime());
	const displayDate = hasDate ? workoutDate.toLocaleDateString() : "";
	const setsByExercise = (workoutDetail.sets ?? {}) as WorkoutDetail["sets"];
	// Mutation identity is the stored exercise id on each group's first set, not
	// the display name; the immutable tag keeps the URL stable across edits.
	const exercises = buildExerciseGroups(setsByExercise);
	return (
		<section>
			<h1>Entrenamiento: {workoutDetail.name}</h1>
			<p className='text-muted-foreground mt-2'>Fecha: {displayDate}</p>
			<div className='my-5'>
				<WorkoutDetailControls
					workoutId={workoutDetail.id}
					storedTag={workoutDetail.tag}
					name={workoutDetail.name}
					date={hasDate ? workoutDate.toISOString() : ""}
					exercises={exercises}
				/>
			</div>
			<div className='my-5 border-t border-border pt-5'>
				<WorkoutDeleteConfirmation
					workoutId={workoutDetail.id}
					workoutName={workoutDetail.name}
				/>
			</div>
			<div className='flex justify-center items-center'>
				<ReturnButton fallbackHref='/workouts'>Regresar</ReturnButton>
			</div>
		</section>
	);
}
