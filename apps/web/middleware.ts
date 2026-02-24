import { NextRequest, NextResponse } from "next/server";

function isHostProtected(requestHost: string): boolean {
  const enabled = process.env.BETA_GATE_ENABLED === "true";
  if (!enabled) return false;

  const configuredHosts = (process.env.BETA_GATE_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);
  if (configuredHosts.length === 0 || configuredHosts.includes("*")) return true;

  const normalizedHost = requestHost.split(":")[0]?.toLowerCase() ?? "";
  return configuredHosts.includes(normalizedHost);
}

function isAuthorized(request: NextRequest): boolean {
  const expectedPassword = process.env.BETA_GATE_PASSWORD ?? "";
  if (!expectedPassword) return false;

  const expectedUser = process.env.BETA_GATE_USERNAME ?? "beta";
  const header = request.headers.get("authorization");
  if (!header || !header.startsWith("Basic ")) return false;

  const encoded = header.slice(6).trim();
  if (!encoded) return false;

  let decoded = "";
  try {
    decoded = atob(encoded);
  } catch {
    return false;
  }

  const separatorIndex = decoded.indexOf(":");
  if (separatorIndex < 0) return false;

  const user = decoded.slice(0, separatorIndex);
  const password = decoded.slice(separatorIndex + 1);
  return user === expectedUser && password === expectedPassword;
}

export function middleware(request: NextRequest) {
  if (request.nextUrl.pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  if (isHostProtected(request.headers.get("host") ?? "") && !isAuthorized(request)) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Private Beta"',
      },
    });
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    // Skip API and static files, protect only page routes
    "/((?!api|_next/static|_next/image|favicon.ico|fonts|.*\\..*$).*)",
  ],
};
