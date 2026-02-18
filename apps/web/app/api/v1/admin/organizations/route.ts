import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import {
  organizations,
  users,
  projects,
  organizationMembers,
} from "@memctl/db/schema";
import { desc, eq, count } from "drizzle-orm";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const allOrgs = await db
    .select()
    .from(organizations)
    .orderBy(desc(organizations.createdAt));

  const orgsWithCounts = await Promise.all(
    allOrgs.map(async (org) => {
      const [owner] = await db
        .select({ name: users.name })
        .from(users)
        .where(eq(users.id, org.ownerId))
        .limit(1);

      const [projectCount] = await db
        .select({ value: count() })
        .from(projects)
        .where(eq(projects.orgId, org.id));

      const [memberCount] = await db
        .select({ value: count() })
        .from(organizationMembers)
        .where(eq(organizationMembers.orgId, org.id));

      return {
        ...org,
        ownerName: owner?.name ?? "Unknown",
        projectCount: projectCount?.value ?? 0,
        memberCount: memberCount?.value ?? 0,
      };
    }),
  );

  return NextResponse.json({ organizations: orgsWithCounts });
}
