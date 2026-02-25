import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, getCachedSession, setCachedSession } from "./jwt";
import { auth } from "./auth";
import { db } from "./db";
import {
  apiTokens,
  sessions,
  organizations,
  organizationMembers,
  projectMembers,
  projects,
} from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";
import { logger, generateRequestId } from "./logger";
import { rateLimit } from "./rate-limit";
import { getOrgLimits } from "./plans";
import { LRUCache } from "lru-cache";

export interface AuthContext {
  userId: string;
  orgId: string;
  sessionId: string;
}

type CachedApiTokenAuth =
  | {
      valid: false;
    }
  | {
      valid: true;
      userId: string;
      orgId: string;
      tokenId: string;
      expiresAt: number | null;
    };

const apiTokenCache = new LRUCache<string, CachedApiTokenAuth>({
  max: 1000,
  ttl: 60_000,
});

async function hashApiToken(token: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(token);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function authenticateRequest(
  req: NextRequest,
): Promise<AuthContext | NextResponse> {
  const authHeader = req.headers.get("authorization");

  // Bearer token auth (CLI / API clients)
  if (authHeader?.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (!token) {
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }
    const payload = await verifyJwt(token);
    if (payload) {
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

    const tokenHash = await hashApiToken(token);
    const now = Date.now();
    const cachedToken = apiTokenCache.get(tokenHash);
    if (cachedToken) {
      if (!cachedToken.valid) {
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      if (cachedToken.expiresAt && cachedToken.expiresAt < now) {
        apiTokenCache.delete(tokenHash);
        return NextResponse.json({ error: "Invalid token" }, { status: 401 });
      }
      return {
        userId: cachedToken.userId,
        orgId: cachedToken.orgId,
        sessionId: `api-token:${cachedToken.tokenId}`,
      };
    }

    const [apiToken] = await db
      .select({
        id: apiTokens.id,
        userId: apiTokens.userId,
        orgId: apiTokens.orgId,
        expiresAt: apiTokens.expiresAt,
        revokedAt: apiTokens.revokedAt,
      })
      .from(apiTokens)
      .where(eq(apiTokens.tokenHash, tokenHash))
      .limit(1);

    const isInvalid =
      !apiToken ||
      !!apiToken.revokedAt ||
      (apiToken.expiresAt ? apiToken.expiresAt.getTime() < now : false);

    if (isInvalid) {
      apiTokenCache.set(tokenHash, { valid: false });
      return NextResponse.json({ error: "Invalid token" }, { status: 401 });
    }

    apiTokenCache.set(tokenHash, {
      valid: true,
      userId: apiToken.userId,
      orgId: apiToken.orgId,
      tokenId: apiToken.id,
      expiresAt: apiToken.expiresAt ? apiToken.expiresAt.getTime() : null,
    });

    const usedAt = new Date();
    void db
      .update(apiTokens)
      .set({ lastUsedAt: usedAt })
      .where(eq(apiTokens.id, apiToken.id))
      .catch(() => null);

    return {
      userId: apiToken.userId,
      orgId: apiToken.orgId,
      sessionId: `api-token:${apiToken.id}`,
    };
  }

  // Cookie-based session auth (dashboard)
  const session = await auth.api.getSession({ headers: req.headers });
  if (!session) {
    return NextResponse.json(
      { error: "Missing authorization" },
      { status: 401 },
    );
  }

  const orgSlug = req.headers.get("x-org-slug");
  if (!orgSlug) {
    return NextResponse.json(
      { error: "Missing X-Org-Slug header" },
      { status: 400 },
    );
  }

  const [org] = await db
    .select({ id: organizations.id, status: organizations.status })
    .from(organizations)
    .where(eq(organizations.slug, orgSlug))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  if (org.status === "suspended") {
    return jsonError("Organization is suspended", 403);
  }
  if (org.status === "banned") {
    return jsonError("Organization has been banned", 403);
  }

  return {
    userId: session.user.id,
    orgId: org.id,
    sessionId: session.session.id,
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
    .select({
      planId: organizations.planId,
      planOverride: organizations.planOverride,
      projectLimit: organizations.projectLimit,
      memberLimit: organizations.memberLimit,
      memoryLimitPerProject: organizations.memoryLimitPerProject,
      apiRatePerMinute: organizations.apiRatePerMinute,
    })
    .from(organizations)
    .where(eq(organizations.id, authContext.orgId))
    .limit(1);

  if (!org) return null;

  const limits = getOrgLimits(org);
  const result = rateLimit(authContext.userId, limits.apiRatePerMinute);

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
