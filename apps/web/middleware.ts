import { NextRequest, NextResponse } from "next/server";

function normalizeHost(input: string): string {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return "";

  if (trimmed.includes("://")) {
    try {
      return new URL(trimmed).hostname.toLowerCase();
    } catch {
      return "";
    }
  }

  return trimmed.split("/")[0]?.split(":")[0] ?? "";
}

function isHostProtected(requestHost: string): boolean {
  const enabled = process.env.BETA_GATE_ENABLED === "true";
  if (!enabled) return false;

  const configuredHosts = (process.env.BETA_GATE_HOSTS ?? "")
    .split(",")
    .map(normalizeHost)
    .filter(Boolean);
  if (configuredHosts.length === 0 || configuredHosts.includes("*"))
    return true;

  const normalizedHost = normalizeHost(requestHost);
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

  let decoded: string;
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

  if (
    isHostProtected(request.headers.get("host") ?? "") &&
    !isAuthorized(request)
  ) {
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
