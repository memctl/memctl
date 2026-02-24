import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/admin";
import { db } from "@/lib/db";
import { planTemplates } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { planTemplateUpdateSchema } from "@memctl/shared/validators";

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [template] = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.id, id))
    .limit(1);

  if (!template) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    result: {
      ...template,
      createdAt: template.createdAt.toISOString(),
      updatedAt: template.updatedAt.toISOString(),
    },
  });
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await req.json();
  const parsed = planTemplateUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  await db
    .update(planTemplates)
    .set({ ...parsed.data, updatedAt: new Date() })
    .where(eq(planTemplates.id, id));

  const [updated] = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.id, id))
    .limit(1);

  return NextResponse.json({
    result: {
      ...updated,
      createdAt: updated.createdAt.toISOString(),
      updatedAt: updated.updatedAt.toISOString(),
    },
  });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;

  const [existing] = await db
    .select()
    .from(planTemplates)
    .where(eq(planTemplates.id, id))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  await db
    .update(planTemplates)
    .set({ isArchived: true, updatedAt: new Date() })
    .where(eq(planTemplates.id, id));

  return NextResponse.json({ success: true });
}
