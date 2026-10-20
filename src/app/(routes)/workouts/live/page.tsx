import { getExercises } from "@/actions";
import { LiveSessionScreen } from "@/components/workout/live/LiveSessionScreen";

export default async function LiveWorkoutPage() {
	const exercises = await getExercises();
	return (
		<main className='flex flex-col gap-6'>
			<LiveSessionScreen
				exercises={exercises.map(({ id, name }) => ({ id, name }))}
			/>
		</main>
	);
}
