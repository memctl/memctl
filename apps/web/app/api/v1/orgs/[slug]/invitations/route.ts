import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  orgInvitations,
} from "@memctl/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { headers } from "next/headers";

/** GET — list pending invitations for this org */
export async function GET(
  _req: NextRequest,
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
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const invitations = await db
    .select()
    .from(orgInvitations)
    .where(
      and(eq(orgInvitations.orgId, org.id), isNull(orgInvitations.acceptedAt)),
    );

  return NextResponse.json({ invitations });
}

/** POST — invite a user by email */
export async function POST(
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
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim()?.toLowerCase();
  const role = body?.role ?? "member";

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email is required" }, { status: 400 });
  }

  if (!["member", "admin"].includes(role)) {
    return NextResponse.json({ error: "Role must be 'member' or 'admin'" }, { status: 400 });
  }

  // Check if already a member
  const existingMembers = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, org.id));

  // We need to look up user by email to check membership
  const { users } = await import("@memctl/db/schema");
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  if (existingUser) {
    const isMember = existingMembers.some((m) => m.userId === existingUser.id);
    if (isMember) {
      return NextResponse.json(
        { error: "User is already a member of this organization" },
        { status: 409 },
      );
    }
  }

  // Check for existing pending invitation
  const [existingInvite] = await db
    .select()
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, org.id),
        eq(orgInvitations.email, email),
        isNull(orgInvitations.acceptedAt),
      ),
    )
    .limit(1);

  if (existingInvite) {
    return NextResponse.json(
      { error: "Invitation already pending for this email" },
      { status: 409 },
    );
  }

  const invitation = {
    id: generateId(),
    orgId: org.id,
    email,
    role,
    invitedBy: session.user.id,
    createdAt: new Date(),
  };

  await db.insert(orgInvitations).values(invitation);

  return NextResponse.json({ invitation }, { status: 201 });
}

/** DELETE — revoke a pending invitation */
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
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(
      and(
        eq(organizationMembers.orgId, org.id),
        eq(organizationMembers.userId, session.user.id),
      ),
    )
    .limit(1);

  if (!member || member.role === "member") {
    return NextResponse.json({ error: "Insufficient permissions" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  if (!body?.invitationId) {
    return NextResponse.json({ error: "invitationId is required" }, { status: 400 });
  }

  const [invitation] = await db
    .select()
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, org.id),
        eq(orgInvitations.id, body.invitationId),
      ),
    )
    .limit(1);

  if (!invitation) {
    return NextResponse.json({ error: "Invitation not found" }, { status: 404 });
  }

  await db
    .delete(orgInvitations)
    .where(eq(orgInvitations.id, body.invitationId));

  return NextResponse.json({ deleted: true });
}
