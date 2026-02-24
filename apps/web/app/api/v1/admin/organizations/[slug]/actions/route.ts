import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { organizations, adminActions, users } from "@memctl/db/schema";
import { eq, desc } from "drizzle-orm";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { slug } = await params;

  const [org] = await db
    .select({ id: organizations.id })
    .from(organizations)
    .where(eq(organizations.slug, slug))
    .limit(1);

  if (!org) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const actions = await db
    .select({
      id: adminActions.id,
      action: adminActions.action,
      details: adminActions.details,
      createdAt: adminActions.createdAt,
      adminName: users.name,
      adminEmail: users.email,
    })
    .from(adminActions)
    .innerJoin(users, eq(adminActions.adminId, users.id))
    .where(eq(adminActions.orgId, org.id))
    .orderBy(desc(adminActions.createdAt))
    .limit(50);

  return NextResponse.json({
    result: actions.map((a) => ({
      ...a,
      createdAt: a.createdAt.toISOString(),
      details: a.details ? JSON.parse(a.details) : null,
    })),
  });
}
