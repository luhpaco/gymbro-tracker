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
import { useForm } from "react-hook-form";
import { z } from "zod";
import { AddExerciseFormSchema } from "./AddExerciseForm";
import { Input } from "../ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { Calendar } from "../ui/calendar";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon } from "lucide-react";
import { Exercise, useWorkoutStore } from "@/store";
import { createWorkout } from "@/actions";
import { useRouter } from "next/navigation";
import { useToast } from "../ui/use-toast";
import { useState } from "react";

interface Props {
	exerciseList: Exercise[];
}

const AddWorkoutFormSchema = z.object({
	nameWorkout: z
		.string()
		.min(1, { message: "Agrega un nombre a tu entrenamiento." }),
	dateWorkout: z.date({
		required_error: "Añade la fecha de tu entrenamiento",
	}),
	tagWorkout: z.string(),
	listExercises: z
		.array(AddExerciseFormSchema)
		.min(1, { message: "Agrega ejercicios a tu entrenamiento" }),
});

export type CreateWorkoutFormData = z.infer<typeof AddWorkoutFormSchema>;

export const SummaryWorkoutForm = ({ exerciseList }: Props) => {
	const router = useRouter();
	const { toast } = useToast();
	const [isCalendarOpen, setIsCalendarOpen] = useState<boolean>(false);
	const form = useForm<CreateWorkoutFormData>({
		resolver: zodResolver(AddWorkoutFormSchema),
		defaultValues: {
			nameWorkout: "",
			listExercises: exerciseList,
		},
	});
	const resetExercises = useWorkoutStore((state) => state.resetExercises);
	const onSubmit = async (data: CreateWorkoutFormData) => {
		try {
			await createWorkout(data);
			form.reset();
			resetExercises();
			toast({
				title: "Éxito!!!",
				description: `El entrenamiento ${data.nameWorkout} ha sido creado satisfactoriamente.`,
				variant: "default",
			});
			router.push("/workouts");
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
			<form
				className='flex flex-col gap-4'
				onSubmit={form.handleSubmit(onSubmit)}
			>
				<FormField
					control={form.control}
					name='nameWorkout'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Nombre del entrenamiento:</FormLabel>
							<FormControl>
								<Input
									{...field}
									placeholder='Ejemplo: Día de pierna'
									type='text'
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name='dateWorkout'
					render={({ field }) => (
						<FormItem className='flex flex-col'>
							<FormLabel>Fecha del entrenamiento:</FormLabel>
							<Popover open={isCalendarOpen} onOpenChange={setIsCalendarOpen}>
								<PopoverTrigger asChild>
									<FormControl>
										<Button
											variant='outline'
											className={cn(
												"w-full pl-3 text-left font-normal",
												field.value
													? "text-foreground"
													: "text-muted-foreground",
											)}
										>
											{field.value ? (
												format(field.value, "PPPP")
											) : (
												<span>Selecciona una fecha</span>
											)}
											<CalendarIcon
												className={cn(
													"ml-auto h-4 w-4",
													field.value
														? "text-foreground"
														: "text-muted-foreground",
												)}
											/>
										</Button>
									</FormControl>
								</PopoverTrigger>
								<PopoverContent className='w-full p-0' align='center'>
									<Calendar
										mode='single'
										selected={field.value}
										onSelect={(e) => {
											field.onChange(e);
											setIsCalendarOpen(false);
										}}
										disabled={(date) =>
											date > new Date() || date < new Date("1900-01-01")
										}
										autoFocus
									/>
								</PopoverContent>
							</Popover>
							<FormMessage />
						</FormItem>
					)}
				/>
				<Button
					type='submit'
					variant='default'
					className='mt-4'
					onClick={() => {
						if (
							exerciseList.length > 0 &&
							form.getValues("nameWorkout").length > 1
						) {
							form.setValue("listExercises", exerciseList);
							form.setValue(
								"tagWorkout",
								form
									.getValues("nameWorkout")
									.toLowerCase()
									.replace(/\s+/g, "-"),
							);
						}
					}}
				>
					Guardar entrenamiento
				</Button>
			</form>
		</Form>
	);
};
