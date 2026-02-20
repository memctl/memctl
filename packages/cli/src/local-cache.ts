import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

let Database: typeof import("better-sqlite3").default | null = null;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  // better-sqlite3 not available — local cache disabled
}

type DB = import("better-sqlite3").Database;

const CACHE_DIR = join(homedir(), ".memctl");
const DB_PATH = join(CACHE_DIR, "cache.db");
const PENDING_WRITES_PATH = join(CACHE_DIR, "pending-writes.json");
const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

export class LocalCache {
  private db: DB | null = null;
  private org: string;
  private project: string;
  private lastSyncAt = 0;

  constructor(org: string, project: string) {
    this.org = org;
    this.project = project;
    this.init();
  }

  private init(): void {
    if (!Database) return;

    try {
      if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
      }

      this.db = new Database!(DB_PATH);
      this.db.pragma("journal_mode = WAL");

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS cached_memories (
          key TEXT NOT NULL,
          content TEXT NOT NULL,
          metadata TEXT,
          tags TEXT,
          priority INTEGER DEFAULT 0,
          project TEXT NOT NULL,
          org TEXT NOT NULL,
          updated_at INTEGER NOT NULL,
          PRIMARY KEY (org, project, key)
        )
      `);

      this.db.exec(`
        CREATE TABLE IF NOT EXISTS sync_meta (
          org TEXT NOT NULL,
          project TEXT NOT NULL,
          last_sync_at INTEGER NOT NULL,
          PRIMARY KEY (org, project)
        )
      `);

      // Load last sync time
      const row = this.db
        .prepare("SELECT last_sync_at FROM sync_meta WHERE org = ? AND project = ?")
        .get(this.org, this.project) as { last_sync_at: number } | undefined;
      this.lastSyncAt = row?.last_sync_at ?? 0;
    } catch {
      this.db = null;
    }
  }

  sync(memories: Array<Record<string, unknown>>): void {
    if (!this.db || memories.length === 0) return;

    try {
      const upsert = this.db.prepare(`
        INSERT OR REPLACE INTO cached_memories (key, content, metadata, tags, priority, project, org, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);

      const tx = this.db.transaction(() => {
        for (const m of memories) {
          upsert.run(
            String(m.key ?? ""),
            String(m.content ?? ""),
            typeof m.metadata === "string" ? m.metadata : JSON.stringify(m.metadata ?? null),
            typeof m.tags === "string" ? m.tags : JSON.stringify(m.tags ?? null),
            Number(m.priority ?? 0),
            this.project,
            this.org,
            m.updatedAt instanceof Date
              ? m.updatedAt.getTime()
              : typeof m.updatedAt === "number"
                ? m.updatedAt
                : Date.now(),
          );
        }
      });

      tx();
      this.lastSyncAt = Date.now();

      this.db
        .prepare(
          "INSERT OR REPLACE INTO sync_meta (org, project, last_sync_at) VALUES (?, ?, ?)",
        )
        .run(this.org, this.project, this.lastSyncAt);
    } catch {
      // Non-critical
    }
  }

  get(key: string): Record<string, unknown> | null {
    if (!this.db) return null;

    try {
      const row = this.db
        .prepare(
          "SELECT * FROM cached_memories WHERE org = ? AND project = ? AND key = ?",
        )
        .get(this.org, this.project, key) as Record<string, unknown> | undefined;

      return row ?? null;
    } catch {
      return null;
    }
  }

  search(query: string): Array<Record<string, unknown>> {
    if (!this.db) return [];

    try {
      return this.db
        .prepare(
          `SELECT * FROM cached_memories
           WHERE org = ? AND project = ?
           AND (key LIKE ? OR content LIKE ?)
           ORDER BY priority DESC
           LIMIT 50`,
        )
        .all(this.org, this.project, `%${query}%`, `%${query}%`) as Array<
        Record<string, unknown>
      >;
    } catch {
      return [];
    }
  }

  list(): Array<Record<string, unknown>> {
    if (!this.db) return [];

    try {
      return this.db
        .prepare(
          "SELECT * FROM cached_memories WHERE org = ? AND project = ? ORDER BY updated_at DESC LIMIT 100",
        )
        .all(this.org, this.project) as Array<Record<string, unknown>>;
    } catch {
      return [];
    }
  }

  /** Try to return cached data for a given API path. */
  getByPath(path: string): unknown {
    if (!this.db) return null;

    // Single memory by key
    const keyMatch = path.match(/^\/memories\/([^/?]+)$/);
    if (keyMatch) {
      const key = decodeURIComponent(keyMatch[1]);
      const memory = this.get(key);
      return memory ? { memory } : null;
    }

    // Memory list/search
    if (path.startsWith("/memories")) {
      const url = new URL(`http://localhost${path}`);
      const q = url.searchParams.get("q");
      if (q) {
        return { memories: this.search(q) };
      }
      return { memories: this.list() };
    }

    return null;
  }

  isStale(): boolean {
    return Date.now() - this.lastSyncAt > STALE_THRESHOLD_MS;
  }

  // ── Pending writes queue ────────────────────────────────────

  queueWrite(operation: { method: string; path: string; body?: unknown }): void {
    try {
      if (!existsSync(CACHE_DIR)) {
        mkdirSync(CACHE_DIR, { recursive: true });
      }

      let pending: Array<{ method: string; path: string; body?: unknown }> = [];
      if (existsSync(PENDING_WRITES_PATH)) {
        pending = JSON.parse(readFileSync(PENDING_WRITES_PATH, "utf-8"));
      }
      pending.push(operation);
      writeFileSync(PENDING_WRITES_PATH, JSON.stringify(pending, null, 2));
    } catch {
      // Non-critical
    }
  }

  getPendingWrites(): Array<{
    method: string;
    path: string;
    body?: unknown;
  }> {
    try {
      if (existsSync(PENDING_WRITES_PATH)) {
        return JSON.parse(readFileSync(PENDING_WRITES_PATH, "utf-8"));
      }
    } catch {
      // Corrupted file — ignore
    }
    return [];
  }

  clearPendingWrites(): void {
    try {
      if (existsSync(PENDING_WRITES_PATH)) {
        writeFileSync(PENDING_WRITES_PATH, "[]");
      }
    } catch {
      // Non-critical
    }
  }
}
