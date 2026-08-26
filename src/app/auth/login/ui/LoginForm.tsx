"use client";

import { authenticate } from "@/actions";
import { Button } from "@/components/ui/button";
import {
	Form,
	FormControl,
	FormField,
	FormItem,
	FormLabel,
	FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2 } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useSearchParams } from "next/navigation";
import { z } from "zod";

export const LoginFormSchema = z.object({
	email: z.string().email({ message: "Debe ingresar un correo válido" }),
	password: z.string().min(5, {
		message: "La contraseña debe tener al menos 5 caracteres",
	}),
});

export type LoginFormValues = z.infer<typeof LoginFormSchema>;

function isValidOrigin(origin: string | null): string | null {
	if (!origin) return null;
	// Only allow same-origin absolute paths (no //, no http, must start with /)
	if (!origin.startsWith("/")) return null;
	if (origin.startsWith("//")) return null;
	if (origin.includes(":")) return null;
	// Basic path validation — allow / and /path and /path?query
	try {
		// Use dummy base to validate
		const url = new URL(origin, "http://localhost");
		if (url.origin !== "http://localhost") return null;
		return url.pathname + url.search + url.hash;
	} catch {
		return null;
	}
}

function LoginFormInner() {
	const form = useForm<LoginFormValues>({
		resolver: zodResolver(LoginFormSchema),
		defaultValues: {
			email: "",
			password: "",
		},
	});
	const [authStatus, setAuthStatus] = useState<String | null>(null);
	const { toast } = useToast();
	const searchParams = useSearchParams();
	const originParam = searchParams.get("origin");
	const validatedOrigin = isValidOrigin(originParam);

	const onSubmit = async (values: LoginFormValues) => {
		const result = await authenticate(undefined, values);
		setAuthStatus(result);
	};

	useEffect(() => {
		if (authStatus === "Success") {
			toast({
				title: "Inicio de sesión exitoso",
				description: "Bienvenido de vuelta",
			});
			window.location.replace(validatedOrigin ?? "/dashboard");
		}
		if (authStatus === "InvalidCredentials") {
			form.setError("email", {
				type: "manual",
				message: "Credenciales inválidas",
			});
			form.setError("password", {
				type: "manual",
				message: "Credenciales inválidas",
			});
		}
	}, [authStatus, validatedOrigin, toast, form]);

	return (
		<Form {...form}>
			<form onSubmit={form.handleSubmit(onSubmit)} className='w-full space-y-8'>
				<FormField
					control={form.control}
					name='email'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Email:</FormLabel>
							<FormControl>
								<Input
									placeholder='jhon-doe@gmail.com'
									type='email'
									{...field}
								/>
							</FormControl>
							<FormMessage />
						</FormItem>
					)}
				/>
				<FormField
					control={form.control}
					name='password'
					render={({ field }) => (
						<FormItem>
							<FormLabel>Contraseña:</FormLabel>
							<FormControl>
								<Input placeholder='********' type='password' {...field} />
							</FormControl>
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
						<>
							<Loader2 className='mr-2 h-4 w-4 animate-spin' />
							Iniciando sesión...
						</>
					) : (
						<span>Ingresar</span>
					)}
				</Button>
			</form>
		</Form>
	);
}

export const LoginForm = () => {
	return (
		<Suspense
			fallback={<div className='w-full space-y-8 animate-pulse h-48' />}
		>
			<LoginFormInner />
		</Suspense>
	);
};
