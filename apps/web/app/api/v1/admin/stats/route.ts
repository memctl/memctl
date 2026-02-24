import { NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { users, organizations, projects, memories } from "@memctl/db/schema";
import { count } from "drizzle-orm";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [userCount, orgCount, projectCount, memoryCount] = await Promise.all([
    db
      .select({ value: count() })
      .from(users)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(organizations)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(projects)
      .then((r) => r[0]?.value ?? 0),
    db
      .select({ value: count() })
      .from(memories)
      .then((r) => r[0]?.value ?? 0),
  ]);

  return NextResponse.json({
    users: userCount,
    organizations: orgCount,
    projects: projectCount,
    memories: memoryCount,
  });
}
