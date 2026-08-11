"use server";

import { signOut } from "@/auth";

export const logout = async () => {
	await signOut({ redirectTo: "/auth/login" });
};
