import { db } from "./db";
import { sql } from "drizzle-orm";

let ftsInitialized = false;

/**
 * Initialize FTS5 virtual table and sync triggers for full-text search on memories.
 * Safe to call multiple times — only runs once per process.
 */
export async function ensureFts() {
  if (ftsInitialized) return;

  try {
    await db.run(sql`
      CREATE VIRTUAL TABLE IF NOT EXISTS memories_fts USING fts5(
        key,
        content,
        tags,
        content='memories',
        content_rowid='rowid'
      )
    `);

    // Triggers to keep FTS in sync (use IF NOT EXISTS via try/catch)
    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS memories_ai AFTER INSERT ON memories BEGIN
        INSERT INTO memories_fts(rowid, key, content, tags)
        VALUES (NEW.rowid, NEW.key, NEW.content, COALESCE(NEW.tags, ''));
      END
    `);

    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS memories_ad AFTER DELETE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, key, content, tags)
        VALUES ('delete', OLD.rowid, OLD.key, OLD.content, COALESCE(OLD.tags, ''));
      END
    `);

    await db.run(sql`
      CREATE TRIGGER IF NOT EXISTS memories_au AFTER UPDATE ON memories BEGIN
        INSERT INTO memories_fts(memories_fts, rowid, key, content, tags)
        VALUES ('delete', OLD.rowid, OLD.key, OLD.content, COALESCE(OLD.tags, ''));
        INSERT INTO memories_fts(rowid, key, content, tags)
        VALUES (NEW.rowid, NEW.key, NEW.content, COALESCE(NEW.tags, ''));
      END
    `);

    ftsInitialized = true;
  } catch {
    // FTS5 may not be available (e.g., in tests) — fall back to LIKE silently
  }
}

/**
 * Search memories using FTS5 if available, returns matching memory rowids.
 * Falls back to null if FTS is not initialized.
 */
export async function ftsSearch(
  projectId: string,
  query: string,
  limit: number,
): Promise<string[] | null> {
  if (!ftsInitialized) return null;

  try {
    // Escape FTS5 special characters for safe query
    const safeQuery = query.replace(/['"*(){}[\]^~\\:]/g, " ").trim();
    if (!safeQuery) return null;

    const ftsQuery = safeQuery.split(/\s+/).map((w) => `"${w}"`).join(" OR ");

    const results = await db.all(sql`
      SELECT m.id, rank
      FROM memories m
      JOIN memories_fts fts ON m.rowid = fts.rowid
      WHERE memories_fts MATCH ${ftsQuery}
        AND m.project_id = ${projectId}
        AND m.archived_at IS NULL
      ORDER BY rank
      LIMIT ${limit}
    `);

    return (results as Array<{ id: string }>).map((r) => r.id);
  } catch {
    return null;
  }
}

/**
 * Rebuild the FTS index from current memory data.
 * Useful after bulk imports or migrations.
 */
export async function rebuildFtsIndex() {
  if (!ftsInitialized) {
    await ensureFts();
  }

  try {
    await db.run(sql`
      INSERT INTO memories_fts(memories_fts) VALUES ('rebuild')
    `);
  } catch {
    // Silently fail if FTS is not available
  }
}
