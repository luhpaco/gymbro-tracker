"use client";
import { Button } from "../ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "../ui/form";
import { Input } from "../ui/input";
import { useForm } from "react-hook-form";
import { Textarea } from "../ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "../ui/select";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { MuscleGroup } from "@prisma/client";
import { createExercise } from "@/actions";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/use-toast";

interface Props {
	listMuscleGroups: MuscleGroup[];
}

const CreateExerciseSchema = z.object({
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

export type CreateExerciseFormData = z.infer<typeof CreateExerciseSchema>;

export const CreateExerciseForm = ({ listMuscleGroups }: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const form = useForm<CreateExerciseFormData>({
		resolver: zodResolver(CreateExerciseSchema),
		defaultValues: {
			exerciseName: "",
			description: "",
			muscleGroup: "",
		},
	});

	const onSubmit = async (data: CreateExerciseFormData) => {
		try {
			await createExercise(data);
			toast({
				title: "Éxito!!!",
				description: `El ejercicio ${data.exerciseName} ha sido creado satisfactoriamente.`,
				variant: "default",
			});
			form.reset();
			router.push("/exercises");
		} catch (error) {
			toast({
				title: "Error",
				description: `Ups ocurrió un problema, ${error}`,
				variant: "destructive",
			});
			console.error(`Ups ocurrió un problema, ${error}`);
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
						<span>Creando ...</span>
					) : (
						<span>Crear ejercicio</span>
					)}
				</Button>
			</form>
		</Form>
	);
};
