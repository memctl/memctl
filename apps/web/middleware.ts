import { NextRequest, NextResponse } from "next/server";

export function middleware(request: NextRequest) {
  // Let all requests through — auth checks happen in route handlers and layouts
  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip static files, API routes handled separately
    "/((?!_next/static|_next/image|favicon.ico|fonts|.*\\..*$).*)",
  ],
};
