import { NextAuthConfig } from "next-auth";

const protectedRoutes = [
	"/dashboard",
	"/exercises",
	"/exercises/create",
	"/workouts",
	"/workouts/create",
];

const authenticatedRoutes = ["/auth/login", "/auth/register"];

export const authConfig: NextAuthConfig = {
	trustHost: true,
	pages: {
		signIn: "/auth/login",
		newUser: "auth/register",
	},
	callbacks: {
		authorized({ auth, request: { nextUrl } }) {
			const isLogged = !!auth?.user;
			const authRoutes = authenticatedRoutes.some((item) =>
				nextUrl.pathname.includes(item),
			);
			const routes = protectedRoutes.some((item) =>
				nextUrl.pathname.includes(item),
			);

			if (isLogged && authRoutes) {
				return Response.redirect(new URL("/dashboard", nextUrl));
			}

			if (!isLogged && routes) {
				return Response.redirect(
					new URL(`/auth/login?origin=${nextUrl.pathname}`, nextUrl),
				);
			}

			return true;
		},
		jwt({ token, user }) {
			if (user) {
				token.data = user;
			}
			return token;
		},
		session({ session, token, user }) {
			session.user = token.data as any;
			return session;
		},
	},
	providers: [],
};
