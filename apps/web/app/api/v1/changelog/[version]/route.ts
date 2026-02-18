import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems, users } from "@memctl/db/schema";
import { eq } from "drizzle-orm";
import { requireAdmin, getOptionalAdmin } from "@/lib/admin";
import { generateId } from "@/lib/utils";
import { z } from "zod";

const changelogItemSchema = z.object({
  category: z.enum(["feature", "fix", "improvement", "breaking"]),
  description: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

const updateEntrySchema = z.object({
  version: z.string().min(1).max(50).optional(),
  title: z.string().min(1).max(200).optional(),
  summary: z.string().max(500).nullable().optional(),
  releaseDate: z.string().optional(),
  status: z.enum(["draft", "published"]).optional(),
  items: z.array(changelogItemSchema).min(1).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  const { version } = await params;

  const [entry] = await db
    .select({
      id: changelogEntries.id,
      version: changelogEntries.version,
      title: changelogEntries.title,
      summary: changelogEntries.summary,
      releaseDate: changelogEntries.releaseDate,
      status: changelogEntries.status,
      createdAt: changelogEntries.createdAt,
      updatedAt: changelogEntries.updatedAt,
      authorId: changelogEntries.authorId,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(changelogEntries)
    .innerJoin(users, eq(changelogEntries.authorId, users.id))
    .where(eq(changelogEntries.version, version))
    .limit(1);

  if (!entry) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  if (entry.status !== "published") {
    const { isAdmin } = await getOptionalAdmin();
    if (!isAdmin) {
      return NextResponse.json({ error: "Entry not found" }, { status: 404 });
    }
  }

  const items = await db
    .select()
    .from(changelogItems)
    .where(eq(changelogItems.entryId, entry.id));

  return NextResponse.json({ entry: { ...entry, items: items.sort((a, b) => a.sortOrder - b.sortOrder) } });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { version } = await params;

  const [existing] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.version, version))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  const body = await req.json().catch(() => null);
  const parsed = updateEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { items, ...fields } = parsed.data;

  // Check version uniqueness if changed
  if (fields.version && fields.version !== existing.version) {
    const [conflict] = await db
      .select({ id: changelogEntries.id })
      .from(changelogEntries)
      .where(eq(changelogEntries.version, fields.version))
      .limit(1);

    if (conflict) {
      return NextResponse.json({ error: "Version already exists" }, { status: 409 });
    }
  }

  const updates: Record<string, unknown> = {
    ...fields,
    updatedAt: new Date(),
  };

  if (fields.releaseDate) {
    updates.releaseDate = new Date(fields.releaseDate);
  }

  await db
    .update(changelogEntries)
    .set(updates)
    .where(eq(changelogEntries.id, existing.id));

  // Replace items if provided
  if (items) {
    await db.delete(changelogItems).where(eq(changelogItems.entryId, existing.id));
    if (items.length > 0) {
      await db.insert(changelogItems).values(
        items.map((item, index) => ({
          id: generateId(),
          entryId: existing.id,
          category: item.category,
          description: item.description,
          sortOrder: item.sortOrder ?? index,
        })),
      );
    }
  }

  const [updated] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, existing.id))
    .limit(1);

  const updatedItems = await db
    .select()
    .from(changelogItems)
    .where(eq(changelogItems.entryId, existing.id));

  return NextResponse.json({ entry: { ...updated, items: updatedItems } });
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ version: string }> },
) {
  try {
    await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { version } = await params;

  const [existing] = await db
    .select({ id: changelogEntries.id })
    .from(changelogEntries)
    .where(eq(changelogEntries.version, version))
    .limit(1);

  if (!existing) {
    return NextResponse.json({ error: "Entry not found" }, { status: 404 });
  }

  // Delete items first (in case cascade doesn't work with all drivers)
  await db.delete(changelogItems).where(eq(changelogItems.entryId, existing.id));
  await db.delete(changelogEntries).where(eq(changelogEntries.id, existing.id));

  return NextResponse.json({ success: true });
}
