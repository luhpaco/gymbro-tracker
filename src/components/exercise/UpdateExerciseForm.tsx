"use client";

import { useForm } from "react-hook-form";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { MuscleGroup } from "@prisma/client";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { Input } from "../ui/input";
import { Textarea } from "../ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { Button } from "../ui/button";
import { useToast } from "../ui/use-toast";
import { updateExercise } from "@/actions";
import { useRouter } from "next/navigation";

interface Props {
	listMuscleGroups: MuscleGroup[];
	exerciseToEdit: {
		id: string;
		name: string;
		tag: string;
		description: string | null;
		muscleGroupTag: string;
		userId: string;
	};
}

const UpdateExerciseSchema = z.object({
	exerciseName: z
		.string({
			required_error: "Agrega un nombre para tu ejercicio",
		})
		.min(4, {
			message: "El nombre de tu ejercicio debe tener por lo menos 4 caracteres",
		}),
	description: z.string().optional(),
	muscleGroup: z.string().min(1, { message: "Selecciona un grupo muscular" }),
});

export type UpdateExerciseFormData = z.infer<typeof UpdateExerciseSchema>;

export const UpdateExerciseForm = ({
	listMuscleGroups,
	exerciseToEdit,
}: Props) => {
	const { toast } = useToast();
	const router = useRouter();

	const form = useForm<UpdateExerciseFormData>({
		resolver: zodResolver(UpdateExerciseSchema),
		defaultValues: {
			exerciseName: exerciseToEdit.name,
			description: exerciseToEdit.description ?? "",
			muscleGroup: exerciseToEdit.muscleGroupTag,
		},
	});
	const onSubmit = async (data: UpdateExerciseFormData) => {
		try {
			await updateExercise(exerciseToEdit.id, exerciseToEdit.userId, data);
			toast({
				title: "Ejercicio actualizado",
				description: "Tu ejercicio ha sido actualizado satisfactoriamente",
			});
			form.reset();
			router.push("/exercises");
		} catch (error) {
			toast({
				title: "Error",
				description: "Ups ocurrió un problema, intenta de nuevo",
				variant: "destructive",
			});
		}
	};
	return (
		<Form {...form}>
			<form className='space-y-4' onSubmit={form.handleSubmit(onSubmit)}>
				<FormField
					control={form.control}
					name='exerciseName'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Nombre de tu ejercicio:</FormLabel>
							<FormControl>
								<Input {...field} placeholder='Ej: Press de banca con barra' />
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name='description'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Descripción:</FormLabel>
							<FormControl>
								<Textarea
									{...field}
									placeholder='Ej: Este ejercicio es ideal para trabajar el pecho y los tríceps'
									className='resize-none'
								/>
							</FormControl>
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name='muscleGroup'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Grupo muscular:</FormLabel>
							<Select onValueChange={field.onChange} defaultValue={field.value}>
								<FormControl>
									<SelectTrigger>
										<SelectValue placeholder='Selecciona el grupo muscular' />
									</SelectTrigger>
								</FormControl>
								<SelectContent>
									{listMuscleGroups.map((group) => (
										<SelectItem key={group.id} value={group.tag}>
											{group.name}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button
					type='submit'
					className='w-full'
					disabled={form.formState.isSubmitting}
				>
					{form.formState.isSubmitting ? (
						<span>Guardando cambios ...</span>
					) : (
						<span>Guardar cambios</span>
					)}
				</Button>
			</form>
		</Form>
	);
};
