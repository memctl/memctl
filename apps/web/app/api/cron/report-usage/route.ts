import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { organizations, projects, memories } from "@memctl/db/schema";
import { eq, and, count } from "drizzle-orm";
import { reportMemoryUsage } from "@/lib/stripe";
import { isBillingEnabled } from "@/lib/plans";

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isBillingEnabled()) {
    return NextResponse.json({ error: "Billing not enabled" }, { status: 400 });
  }

  const meteredOrgs = await db
    .select()
    .from(organizations)
    .where(
      and(
        eq(organizations.meteredBilling, true),
      ),
    );

  const filteredOrgs = meteredOrgs.filter((o) => o.stripeMeteredItemId);

  const results: { orgSlug: string; memoryCount: number; reported: boolean }[] = [];

  for (const org of filteredOrgs) {
    const orgProjects = await db
      .select({ id: projects.id })
      .from(projects)
      .where(eq(projects.orgId, org.id));

    let totalMemories = 0;
    for (const project of orgProjects) {
      const [result] = await db
        .select({ value: count() })
        .from(memories)
        .where(eq(memories.projectId, project.id));
      totalMemories += result?.value ?? 0;
    }

    try {
      await reportMemoryUsage({
        subscriptionItemId: org.stripeMeteredItemId!,
        memoryCount: totalMemories,
      });
      results.push({ orgSlug: org.slug, memoryCount: totalMemories, reported: true });
    } catch (err) {
      console.error(`Failed to report usage for ${org.slug}:`, err);
      results.push({ orgSlug: org.slug, memoryCount: totalMemories, reported: false });
    }
  }

  return NextResponse.json({ result: results });
}
