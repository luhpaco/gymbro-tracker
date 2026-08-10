import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcryptjs from "bcryptjs";
import { z } from "zod";
import { authConfig } from "@/auth.config";
import prisma from "@/lib/prisma";

export const { signIn, signOut, auth, handlers } = NextAuth({
	...authConfig,
	providers: [
		Credentials({
			async authorize(credentials) {
				const parsedCredentials = z
					.object({
						email: z
							.string()
							.email({ message: "Debe ingresar un correo válido" }),
						password: z.string().min(5, {
							message: "La contraseña debe tener al menos 5 caracteres",
						}),
					})
					.safeParse(credentials);
				if (!parsedCredentials.success) {
					return null;
				}
				const { email, password } = parsedCredentials.data;

				// Look for user in database
				const user = await prisma.user.findFirst({
					where: {
						email: email.toLowerCase(),
					},
				});
				if (!user) return null;

				// Check password
				if (!bcryptjs.compareSync(password, user.password)) return null;

				// Return user object without the password
				const { password: _, ...rest } = user;
				// console.log({ rest });
				return rest;
			},
		}),
	],
});
