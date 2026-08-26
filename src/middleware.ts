import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "./auth.config";

const { auth } = NextAuth(authConfig);

export default auth((req) => {
	const pathname = req.nextUrl.pathname;
	const requestHeaders = new Headers(req.headers);
	requestHeaders.set("x-pathname", pathname);
	// Also set x-invoke-path for robustness with getPathnameFromHeaders fallbacks
	requestHeaders.set("x-invoke-path", pathname);

	return NextResponse.next({
		request: { headers: requestHeaders },
	});
});

export const config = {
	// https://nextjs.org/docs/app/building-your-application/routing/middleware#matcher
	matcher: ["/((?!api|_next/static|_next/image|.*\\.png$).*)"],
};
