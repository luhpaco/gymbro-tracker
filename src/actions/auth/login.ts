"use server";

import { signIn } from "@/auth";

export const login = async (email: string, password: string) => {
	try {
		await signIn("credentials", { email, password });
		return {
			ok: true,
			message: "Login successful",
		};
	} catch (error) {
		console.log(error);
		return {
			ok: false,
			message: "Login failed",
		};
	}
};
