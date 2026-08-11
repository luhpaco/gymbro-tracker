import { getWorkoutBySlug } from "@/actions";
import { auth } from "@/auth";
import { ReturnButton } from "@/components";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@/components/ui/table";
import { WorkoutDetail } from "@/interfaces";
import { notFound, redirect } from "next/navigation";

interface Props {
	params: Promise<{
		slug: string;
	}>;
}

export default async function WorkoutDetailPage({ params }: Props) {
	const { slug } = await params;
	const session = await auth();
	if (!session) return redirect("/login");
	const workoutDetail = (await getWorkoutBySlug(
		decodeURIComponent(slug),
		session.user.id
	)) as WorkoutDetail;

	if (!workoutDetail) redirect("/workouts");
	return (
		<section>
			<h1>Entrenamiento: {workoutDetail.name}</h1>
			<p className='text-gray-400 mt-2'>
				Fecha: {workoutDetail.date.toLocaleDateString()}
			</p>
			<div>
				<div className='my-5'>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Nombre del ejercicio</TableHead>
								<TableHead className='text-center'>Serie</TableHead>
								<TableHead className='text-center'>Reps(N°)</TableHead>
								<TableHead className='text-center'>Peso (Kg)</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{Object.keys(workoutDetail.sets).map((exercise) => (
								<TableRow key={exercise}>
									<TableCell>{exercise}</TableCell>
									<TableCell className='text-center space-y-4'>
										{workoutDetail.sets[exercise].map((set, index) => (
											<p key={set.id}>{index + 1}</p>
										))}
									</TableCell>
									<TableCell className='text-center space-y-4'>
										{workoutDetail.sets[exercise].map((set) => (
											<p key={set.id}>{set.reps}</p>
										))}
									</TableCell>
									<TableCell className='text-center space-y-4'>
										{workoutDetail.sets[exercise].map((set) => (
											<p key={set.id}>{set.weight}</p>
										))}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			</div>
			<div className='flex justify-center items-center'>
				<ReturnButton>Regresar</ReturnButton>
			</div>
		</section>
	);
}
