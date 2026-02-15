import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { createJwt } from "@/lib/jwt";
import { db } from "@/lib/db";
import { organizationMembers } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));
  const orgId = body.orgId;

  if (!orgId) {
    return NextResponse.json({ error: "orgId is required" }, { status: 400 });
  }

  // Verify membership
  const [member] = await db
    .select()
    .from(organizationMembers)
    .where(eq(organizationMembers.orgId, orgId))
    .limit(1);

  if (!member || member.userId !== session.user.id) {
    return NextResponse.json({ error: "Not a member of this org" }, { status: 403 });
  }

  const token = await createJwt({
    userId: session.user.id,
    orgId,
    sessionId: session.session.id,
  });

  return NextResponse.json({ token });
}
