"use server";

import { LoginFormValues } from "@/app/auth/login/ui/LoginForm";
import { signIn } from "@/auth";
import { FormState } from "react-hook-form";

export async function authenticate(
	prevState: String | undefined,
	formData: LoginFormValues
) {
	// TODO: Clear errors in console
	try {
		await signIn("credentials", {
			redirect: false,
			email: formData.email,
			password: formData.password,
		});
		return "Success";
	} catch (error) {
		if ((error as any).type === "CredentialsSignin") {
			return "InvalidCredentials";
		}

		return "UhknownError";
	}
}
