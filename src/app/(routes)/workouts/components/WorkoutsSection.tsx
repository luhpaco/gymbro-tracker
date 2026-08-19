import { TornStrip } from "@/components/ui/torn-strip";
import { Button } from "@/components/ui/button";
import { WorkoutToDisplay } from "@/interfaces";
import { DumbbellIcon } from "lucide-react";
import Link from "next/link";

interface Props {
	workoutsToDisplay: WorkoutToDisplay[];
}

export const WorkoutsSection = ({ workoutsToDisplay }: Props) => {
	return (
		<section className='flex flex-col gap-4 mt-6'>
			{workoutsToDisplay.map((workout) => (
				<TornStrip
					key={workout.id}
					seed={workout.id}
					className='w-full flex flex-col gap-8 text-sm'
				>
					<TornStrip.Header
						title={workout.name}
						subTitle={workout.date.toDateString()}
					/>
					<TornStrip.Body>
						<div className='flex flex-col gap-2 text-sm'>
							<p>Resumen de tu entrenamiento:</p>
							<div className='flex justify-between items-center'>
								<p className='text-muted-foreground text-xs'>Nombre del ejercicio</p>
								<p className='text-muted-foreground text-xs'>Series</p>
							</div>
							{Object.keys(workout.sets).map((exercise) => (
								<div
									className='flex items-center justify-between'
									key={exercise}
								>
									<p className='flex gap-2 items-center'>
										<DumbbellIcon size={14} />
										<span>{exercise}</span>
									</p>
									<p className='flex gap-2 me-3'>
										<span>{workout.sets[exercise].length}</span>
									</p>
								</div>
							))}
						</div>
						<Link href={`/workouts/${workout.tag}`}>
							<Button className='w-full mt-6' type='button'>
								Ver entrenamiento
							</Button>
						</Link>
					</TornStrip.Body>
				</TornStrip>
			))}
		</section>
	);
};
