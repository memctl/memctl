import { db } from "@/lib/db";
import { planTemplates, organizations } from "@memctl/db/schema";
import { eq, count } from "drizzle-orm";
import { PageHeader } from "@/components/dashboard/shared/page-header";
import { PlanTemplatesClient } from "./client";

export const dynamic = "force-dynamic";

export default async function PlanTemplatesPage() {
  const templates = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.isArchived, false));

  const templatesWithUsage = await Promise.all(
    templates.map(async (t) => {
      const [usage] = await db
        .select({ value: count() })
        .from(organizations)
        .where(eq(organizations.planTemplateId, t.id));
      return {
        ...t,
        createdAt: t.createdAt.toISOString(),
        updatedAt: t.updatedAt.toISOString(),
        usageCount: usage?.value ?? 0,
      };
    }),
  );

  return (
    <div>
      <PageHeader
        badge="Admin"
        title="Plan Templates"
        description="Reusable plan configurations for enterprise customers"
      />
      <PlanTemplatesClient templates={templatesWithUsage} />
    </div>
  );
}
