import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import {
  organizations,
  organizationMembers,
  orgInvitations,
  users,
} from "@memctl/db/schema";
import { eq, and, isNull, count, gte, gt } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { headers } from "next/headers";
import {
  isSelfHosted,
  INVITATIONS_PER_DAY,
  MAX_PENDING_INVITATIONS,
} from "@/lib/plans";
import {
  ensureSeatForAdditionalMember,
  syncSeatQuantityToMemberCount,
} from "@/lib/seat-billing";

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
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
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
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const now = new Date();
  const invitations = await db
    .select()
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, org.id),
        isNull(orgInvitations.acceptedAt),
        gt(orgInvitations.expiresAt, now),
      ),
    );

  // Count invitations sent in the last 24 hours (for rate limit display)
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const [dailyCount] = await db
    .select({ value: count() })
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, org.id),
        gte(orgInvitations.createdAt, oneDayAgo),
      ),
    );

  const selfHosted = isSelfHosted();

  return NextResponse.json({
    invitations,
    dailyUsed: dailyCount?.value ?? 0,
    dailyLimit: selfHosted ? null : INVITATIONS_PER_DAY,
  });
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
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
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
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const email = body?.email?.trim()?.toLowerCase();
  const role = body?.role ?? "member";
  const expiresInDays = body?.expiresInDays ?? 7;

  if (!email || typeof email !== "string" || !email.includes("@")) {
    return NextResponse.json(
      { error: "Valid email is required" },
      { status: 400 },
    );
  }

  if (!["member", "admin"].includes(role)) {
    return NextResponse.json(
      { error: "Role must be 'member' or 'admin'" },
      { status: 400 },
    );
  }

  if (
    typeof expiresInDays !== "number" ||
    expiresInDays < 1 ||
    expiresInDays > 7
  ) {
    return NextResponse.json(
      { error: "expiresInDays must be between 1 and 7" },
      { status: 400 },
    );
  }

  const selfHosted = isSelfHosted();

  // Daily rate limit (skipped in self-hosted)
  if (!selfHosted) {
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [dailyCount] = await db
      .select({ value: count() })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.orgId, org.id),
          gte(orgInvitations.createdAt, oneDayAgo),
        ),
      );

    if ((dailyCount?.value ?? 0) >= INVITATIONS_PER_DAY) {
      return NextResponse.json(
        {
          error: `Daily invitation limit reached (${INVITATIONS_PER_DAY}/day). Try again tomorrow.`,
        },
        { status: 429 },
      );
    }
  }

  // Look up whether this email already has an account
  const [existingUser] = await db
    .select()
    .from(users)
    .where(eq(users.email, email))
    .limit(1);

  // Check if already a member (use unified error message to prevent enumeration)
  if (existingUser) {
    const [alreadyMember] = await db
      .select()
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.orgId, org.id),
          eq(organizationMembers.userId, existingUser.id),
        ),
      )
      .limit(1);

    if (alreadyMember) {
      return NextResponse.json(
        { error: "Invitation already exists for this email" },
        { status: 409 },
      );
    }
  }

  // Check for existing non-expired pending invitation (same unified error)
  const [existingInvite] = await db
    .select()
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, org.id),
        eq(orgInvitations.email, email),
        isNull(orgInvitations.acceptedAt),
        gt(orgInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (existingInvite && !existingUser) {
    return NextResponse.json(
      { error: "Invitation already exists for this email" },
      { status: 409 },
    );
  }

  const now = new Date();

  // Cap pending (non-expired) invitations per org (skipped in self-hosted)
  if (!selfHosted) {
    const [pendingCount] = await db
      .select({ value: count() })
      .from(orgInvitations)
      .where(
        and(
          eq(orgInvitations.orgId, org.id),
          isNull(orgInvitations.acceptedAt),
          gt(orgInvitations.expiresAt, now),
        ),
      );

    if ((pendingCount?.value ?? 0) >= MAX_PENDING_INVITATIONS) {
      return NextResponse.json(
        {
          error: `Maximum of ${MAX_PENDING_INVITATIONS} pending invitations reached`,
        },
        { status: 400 },
      );
    }
  }

  // If user already has an account, add them directly — no email
  if (existingUser) {
    try {
      const seatResult = await ensureSeatForAdditionalMember(org.id);
      if (!seatResult.ok) {
        return NextResponse.json({ error: seatResult.error }, { status: 402 });
      }
    } catch {
      return NextResponse.json(
        { error: "Failed to update seat billing in Stripe" },
        { status: 502 },
      );
    }

    try {
      await db.insert(organizationMembers).values({
        id: generateId(),
        orgId: org.id,
        userId: existingUser.id,
        role,
        createdAt: now,
      });
    } catch {
      try {
        await syncSeatQuantityToMemberCount(org.id);
      } catch {
        // ignore seat sync failure
      }
      return NextResponse.json(
        { error: "Invitation already exists for this email" },
        { status: 409 },
      );
    }

    if (existingInvite) {
      await db
        .update(orgInvitations)
        .set({ acceptedAt: now, role })
        .where(eq(orgInvitations.id, existingInvite.id));
      const invitation = { ...existingInvite, role, acceptedAt: now };
      return NextResponse.json({ invitation, added: true }, { status: 201 });
    }

    const expiresAt = new Date(
      now.getTime() + expiresInDays * 24 * 60 * 60 * 1000,
    );
    const invitation = {
      id: generateId(),
      orgId: org.id,
      email,
      role,
      invitedBy: session.user.id,
      acceptedAt: now,
      expiresAt,
      createdAt: now,
    };
    await db.insert(orgInvitations).values(invitation);

    return NextResponse.json({ invitation, added: true }, { status: 201 });
  }

  // User doesn't exist yet — create pending invitation, no email sent
  const expiresAt = new Date(
    now.getTime() + expiresInDays * 24 * 60 * 60 * 1000,
  );
  const invitation = {
    id: generateId(),
    orgId: org.id,
    email,
    role,
    invitedBy: session.user.id,
    expiresAt,
    createdAt: now,
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
    return NextResponse.json(
      { error: "Organization not found" },
      { status: 404 },
    );
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
    return NextResponse.json(
      { error: "Insufficient permissions" },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  if (!body?.invitationId) {
    return NextResponse.json(
      { error: "invitationId is required" },
      { status: 400 },
    );
  }

  const [invitation] = await db
    .select()
    .from(orgInvitations)
    .where(
      and(
        eq(orgInvitations.orgId, org.id),
        eq(orgInvitations.id, body.invitationId),
        isNull(orgInvitations.acceptedAt),
        gt(orgInvitations.expiresAt, new Date()),
      ),
    )
    .limit(1);

  if (!invitation) {
    return NextResponse.json(
      { error: "Invitation not found" },
      { status: 404 },
    );
  }

  await db
    .delete(orgInvitations)
    .where(eq(orgInvitations.id, body.invitationId));

  return NextResponse.json({ deleted: true });
}
