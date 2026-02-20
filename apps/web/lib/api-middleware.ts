import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, getCachedSession, setCachedSession } from "./jwt";
import { db } from "./db";
import { sessions, organizations, organizationMembers, projectMembers, projects } from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logger, generateRequestId } from "./logger";
import { rateLimit } from "./rate-limit";
import type { PlanId } from "@memctl/shared/constants";

export interface AuthContext {
  userId: string;
  orgId: string;
  sessionId: string;
}

export async function authenticateRequest(
  req: NextRequest,
): Promise<AuthContext | NextResponse> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Missing authorization" }, { status: 401 });
  }

  const token = authHeader.slice(7);
  const payload = await verifyJwt(token);
  if (!payload) {
    return NextResponse.json({ error: "Invalid token" }, { status: 401 });
  }

  // Check cache first
  const cached = getCachedSession(payload.jti);
  if (cached) {
    if (!cached.valid) {
      return NextResponse.json({ error: "Session revoked" }, { status: 401 });
    }
    return {
      userId: cached.userId,
      orgId: cached.orgId,
      sessionId: payload.sessionId,
    };
  }

  // Verify session is still active in DB
  const [session] = await db
    .select()
    .from(sessions)
    .where(eq(sessions.id, payload.sessionId))
    .limit(1);

  if (!session || session.expiresAt < new Date()) {
    setCachedSession(payload.jti, {
      valid: false,
      userId: payload.userId,
      orgId: payload.orgId,
    });
    return NextResponse.json({ error: "Session expired" }, { status: 401 });
  }

  // Cache the valid session
  setCachedSession(payload.jti, {
    valid: true,
    userId: payload.userId,
    orgId: payload.orgId,
  });

  return {
    userId: payload.userId,
    orgId: payload.orgId,
    sessionId: payload.sessionId,
  };
}

export async function requireOrgMembership(
  userId: string,
  orgId: string,
): Promise<string | null> {
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, orgId),
        eq(organizationMembers.userId, userId),
      ),
    )
    .limit(1);

  return member?.role ?? null;
}

export async function checkProjectAccess(
  userId: string,
  projectId: string,
  orgRole: string,
): Promise<boolean> {
  if (orgRole === "owner" || orgRole === "admin") return true;

  const [assignment] = await db
    .select()
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.projectId, projectId),
        eq(projectMembers.userId, userId),
      ),
    )
    .limit(1);

  return !!assignment;
}

export async function getAccessibleProjectIds(
  userId: string,
  orgId: string,
  orgRole: string,
): Promise<string[] | null> {
  if (orgRole === "owner" || orgRole === "admin") return null; // null = all projects

  const orgProjects = await db
    .select({ id: projects.id })
    .from(projects)
    .where(eq(projects.orgId, orgId));

  if (orgProjects.length === 0) return [];

  const assignments = await db
    .select({ projectId: projectMembers.projectId })
    .from(projectMembers)
    .where(
      and(
        eq(projectMembers.userId, userId),
        inArray(
          projectMembers.projectId,
          orgProjects.map((p) => p.id),
        ),
      ),
    );

  return assignments.map((a) => a.projectId);
}

export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

/**
 * Wrap an API route handler with request logging and rate limiting.
 * Adds X-Request-Id header, logs request method/path/status/duration,
 * and enforces per-plan rate limits.
 */
export function withApiMiddleware(
  handler: (req: NextRequest, ctx?: unknown) => Promise<NextResponse>,
) {
  return async (req: NextRequest, ctx?: unknown): Promise<NextResponse> => {
    const requestId = generateRequestId();
    const start = Date.now();
    const method = req.method;
    const path = new URL(req.url).pathname;

    try {
      const res = await handler(req, ctx);
      const duration = Date.now() - start;

      logger.info({ requestId, method, path, status: res.status, duration });

      res.headers.set("X-Request-Id", requestId);
      return res;
    } catch (err) {
      const duration = Date.now() - start;
      logger.error({ requestId, method, path, duration, error: String(err) });
      const res = NextResponse.json(
        { error: "Internal server error" },
        { status: 500 },
      );
      res.headers.set("X-Request-Id", requestId);
      return res;
    }
  };
}

/**
 * Check rate limit for an authenticated user based on their org plan.
 * Returns a 429 response if the limit is exceeded, or null if allowed.
 */
export async function checkRateLimit(
  authContext: AuthContext,
): Promise<NextResponse | null> {
  const [org] = await db
    .select({ planId: organizations.planId })
    .from(organizations)
    .where(eq(organizations.id, authContext.orgId))
    .limit(1);

  if (!org) return null;

  const result = rateLimit(authContext.userId, org.planId as PlanId);

  if (!result.allowed) {
    const res = NextResponse.json(
      { error: "Rate limit exceeded" },
      { status: 429 },
    );
    res.headers.set("Retry-After", String(result.retryAfterSeconds));
    res.headers.set("X-RateLimit-Limit", String(result.limit));
    res.headers.set("X-RateLimit-Remaining", "0");
    return res;
  }

  return null;
}
