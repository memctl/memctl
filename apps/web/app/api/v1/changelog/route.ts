import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { changelogEntries, changelogItems, users } from "@memctl/db/schema";
import { eq, desc, count } from "drizzle-orm";
import { generateId } from "@/lib/utils";
import { requireAdmin, getOptionalAdmin } from "@/lib/admin";
import { z } from "zod";

const changelogItemSchema = z.object({
  category: z.enum(["feature", "fix", "improvement", "breaking"]),
  description: z.string().min(1),
  sortOrder: z.number().int().default(0),
});

const createEntrySchema = z.object({
  version: z.string().min(1).max(50),
  title: z.string().min(1).max(200),
  summary: z.string().max(500).optional(),
  releaseDate: z.string().min(1),
  status: z.enum(["draft", "published"]).default("draft"),
  items: z.array(changelogItemSchema).min(1),
});

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const statusFilter = searchParams.get("status");
  const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    50,
    Math.max(1, parseInt(searchParams.get("limit") ?? "10", 10)),
  );
  const offset = (page - 1) * limit;

  const { isAdmin } = await getOptionalAdmin();
  const showAll = isAdmin && statusFilter === "all";

  const conditions = showAll
    ? undefined
    : eq(changelogEntries.status, "published");

  const entries = await db
    .select({
      id: changelogEntries.id,
      version: changelogEntries.version,
      title: changelogEntries.title,
      summary: changelogEntries.summary,
      releaseDate: changelogEntries.releaseDate,
      status: changelogEntries.status,
      createdAt: changelogEntries.createdAt,
      updatedAt: changelogEntries.updatedAt,
      authorName: users.name,
      authorAvatar: users.avatarUrl,
    })
    .from(changelogEntries)
    .innerJoin(users, eq(changelogEntries.authorId, users.id))
    .where(conditions)
    .orderBy(desc(changelogEntries.releaseDate))
    .limit(limit)
    .offset(offset);

  // Fetch items for all entries
  const entryIds = entries.map((e) => e.id);
  let items: {
    id: string;
    entryId: string;
    category: string;
    description: string;
    sortOrder: number;
  }[] = [];
  if (entryIds.length > 0) {
    items = await db.select().from(changelogItems);
    items = items.filter((item) => entryIds.includes(item.entryId));
  }

  const entriesWithItems = entries.map((entry) => ({
    ...entry,
    items: items
      .filter((item) => item.entryId === entry.id)
      .sort((a, b) => a.sortOrder - b.sortOrder),
  }));

  const [{ total }] = await db
    .select({ total: count() })
    .from(changelogEntries)
    .where(conditions);

  return NextResponse.json({
    entries: entriesWithItems,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

export async function POST(req: NextRequest) {
  let session;
  try {
    session = await requireAdmin();
  } catch {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json().catch(() => null);
  const parsed = createEntrySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.message }, { status: 400 });
  }

  const { version, title, summary, releaseDate, status, items } = parsed.data;

  // Check version uniqueness
  const [existing] = await db
    .select({ id: changelogEntries.id })
    .from(changelogEntries)
    .where(eq(changelogEntries.version, version))
    .limit(1);

  if (existing) {
    return NextResponse.json(
      { error: "Version already exists" },
      { status: 409 },
    );
  }

  const now = new Date();
  const entryId = generateId();

  await db.insert(changelogEntries).values({
    id: entryId,
    version,
    title,
    summary: summary ?? null,
    releaseDate: new Date(releaseDate),
    status,
    authorId: session.user.id,
    createdAt: now,
    updatedAt: now,
  });

  // Insert items
  if (items.length > 0) {
    await db.insert(changelogItems).values(
      items.map((item, index) => ({
        id: generateId(),
        entryId,
        category: item.category,
        description: item.description,
        sortOrder: item.sortOrder ?? index,
      })),
    );
  }

  const [entry] = await db
    .select()
    .from(changelogEntries)
    .where(eq(changelogEntries.id, entryId))
    .limit(1);

  const entryItems = await db
    .select()
    .from(changelogItems)
    .where(eq(changelogItems.entryId, entryId));

  return NextResponse.json(
    { entry: { ...entry, items: entryItems } },
    { status: 201 },
  );
}
