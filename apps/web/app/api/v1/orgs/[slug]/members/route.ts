import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  projectMembers,
  users,
} from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import { headers } from "next/headers";
import { memberRoleUpdateSchema } from "@memctl/shared/validators";
import { logAudit } from "@/lib/audit";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember) {
    return NextResponse.json({ error: "Not a member" }, { status: 403 });
  }

  const members = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  const memberData = await Promise.all(
    members.map(async (m) => {
      const [user] = await db
        .select({
          id: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
        })
        .from(users)
        .where(eq(users.id, m.userId))
        .limit(1);

      const assignments = await db
        .select({ projectId: projectMembers.projectId })
        .from(projectMembers)
        .where(eq(projectMembers.userId, m.userId));

      return {
        id: m.id,
        userId: m.userId,
        role: m.role,
        createdAt: m.createdAt,
        user: user ?? null,
        projectIds: assignments.map((a) => a.projectId),
      };
    }),
  );

  return NextResponse.json({ members: memberData });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember || currentMember.role === "member") {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 },
    );
  }

  const parsed = memberRoleUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const [targetMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.id, body.memberId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  if (targetMember.role === "owner") {
    return NextResponse.json(
      { error: "Cannot change owner role" },
      { status: 400 },
    );
  }

  const oldRole = targetMember.role;

  await db
    .update(organizationMembers)
    .set({ role: parsed.data.role })
    .where(eq(organizationMembers.id, targetMember.id));

  await logAudit({
    orgId: org.id,
    actorId: session.user.id,
    action: "role_changed",
    targetUserId: targetMember.userId,
    details: { oldRole, newRole: parsed.data.role },
  });

  return NextResponse.json({ success: true, role: parsed.data.role });
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { slug } = await params;

  const [org] = await db
    .select()
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
  }

  const [currentMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!currentMember || currentMember.role === "member") {
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.memberId) {
    return NextResponse.json(
      { error: "memberId is required" },
      { status: 400 },
    );
  }

  const [targetMember] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.id, body.memberId),
      ),
    )
    .limit(1);

  if (!targetMember) {
    return NextResponse.json({ error: "Member not found" }, { status: 404 });
  }

  // Cannot remove the sole owner
  if (targetMember.role === "owner") {
    const [ownerCount] = await db
      .select({ value: count() })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.orgId, org.id),
          eq(organizationMembers.role, "owner"),
        ),
      );

    if ((ownerCount?.value ?? 0) <= 1) {
      return NextResponse.json(
        { error: "Cannot remove the sole owner" },
        { status: 400 },
      );
    }
  }

  // Remove project assignments first
  await db
    .delete(projectMembers)
    .where(eq(projectMembers.userId, targetMember.userId));

  // Remove org membership
  await db
    .delete(organizationMembers)
    .where(eq(organizationMembers.id, targetMember.id));

  await logAudit({
    orgId: org.id,
    actorId: session.user.id,
    action: "member_removed",
    targetUserId: targetMember.userId,
    details: { role: targetMember.role },
  });

  return NextResponse.json({ deleted: true });
}
