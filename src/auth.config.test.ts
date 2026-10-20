import { describe, expect, it } from "vitest";
import { authConfig } from "./auth.config";

type AuthorizedArgs = Parameters<
	NonNullable<NonNullable<typeof authConfig.callbacks>["authorized"]>
>[0];

function authorize(path: string, loggedIn: boolean) {
	const authorized = authConfig.callbacks!.authorized!;
	return authorized({
		auth: loggedIn ? { user: { id: "u1" } } : null,
		request: { nextUrl: new URL(`http://localhost:3000${path}`) },
	} as unknown as AuthorizedArgs);
}

function locationOf(result: unknown) {
	expect(result).toBeInstanceOf(Response);
	return new URL((result as Response).headers.get("location")!);
}

describe("authorized callback", () => {
	describe("root route", () => {
		it("redirects / to /auth/login without a session", () => {
			const location = locationOf(authorize("/", false));
			expect(location.pathname).toBe("/auth/login");
		});

		it("redirects / to /dashboard with a session", () => {
			const location = locationOf(authorize("/", true));
			expect(location.pathname).toBe("/dashboard");
		});
	});

	describe("existing behavior", () => {
		it("sends logged-out users on a protected route to login with origin", () => {
			const location = locationOf(authorize("/dashboard", false));
			expect(location.pathname).toBe("/auth/login");
			expect(location.searchParams.get("origin")).toBe("/dashboard");
		});

		it("sends logged-in users on an auth route to /dashboard", () => {
			const location = locationOf(authorize("/auth/login", true));
			expect(location.pathname).toBe("/dashboard");
		});

		it("allows logged-in users on a protected route", () => {
			expect(authorize("/workouts", true)).toBe(true);
		});

		it("allows logged-out users on an auth route", () => {
			expect(authorize("/auth/register", false)).toBe(true);
		});
	});
});
