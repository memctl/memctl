import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { planTemplates } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { planTemplateCreateSchema } from "@memctl/shared/validators";
import { generateId } from "@/lib/utils";

export async function GET() {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const templates = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.isArchived, false));

  return NextResponse.json({
    result: templates.map((t) => ({
      ...t,
      createdAt: t.createdAt.toISOString(),
      updatedAt: t.updatedAt.toISOString(),
    })),
  });
}

export async function POST(req: NextRequest) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = planTemplateCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const id = generateId();
  const now = new Date();

  await db.insert(planTemplates).values({
    id,
    ...parsed.data,
    createdAt: now,
    updatedAt: now,
  });

  const [template] = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.id, id))
    .limit(1);

  return NextResponse.json({
    result: {
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    },
  });
}
