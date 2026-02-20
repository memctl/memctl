import { NextRequest, NextResponse } from "next/server";
import { verifyJwt, getCachedSession, setCachedSession } from "./jwt";
import { db } from "./db";
import { sessions, organizationMembers, projectMembers, projects } from "@memctl/db/schema";
import { eq, and, inArray } from "drizzle-orm";

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
