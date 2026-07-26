import { NextResponse, NextRequest } from "next/server";
// import { verifyToken } from "./lib/auth"; // We cannot use jsonwebtoken in Edge middleware natively unless it's a web-compatible library or we decode the JWT simply.
// Next.js middleware runs on Edge Runtime where some Node.js APIs (like crypto) aren't fully available.
// For a production app we'd use `jose` instead of `jsonwebtoken` for edge compatibility, or we just verify the cookie presence here and let the route do full verification.
// For simplicity in this demo, we'll check if the token cookie exists in middleware, and server components will fully verify it.

export default function proxy(request: NextRequest) {
  // Login step removed entirely: /admin is open (it falls back to an admin
  // account server-side), and the login/register pages just bounce straight
  // into the join page so nobody ever sees the sign-in form.
  if (request.nextUrl.pathname === "/login" || request.nextUrl.pathname === "/register") {
    return NextResponse.redirect(new URL("/join", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/login", "/register"],
};
