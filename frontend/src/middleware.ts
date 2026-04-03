import { NextResponse } from "next/server";

import { auth } from "@/auth";

export default auth((req) => {
  const path = req.nextUrl.pathname;
  const isLogin = path.startsWith("/login");
  const isNextAuth = path.startsWith("/api/auth");

  if (isNextAuth) {
    return NextResponse.next();
  }

  if (!req.auth && !isLogin) {
    return NextResponse.redirect(new URL("/login", req.nextUrl.origin));
  }

  if (req.auth && isLogin) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
