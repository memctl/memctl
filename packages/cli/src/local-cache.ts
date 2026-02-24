import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { homedir } from "node:os";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Database: any = null;
try {
  Database = (await import("better-sqlite3")).default;
} catch {
  // better-sqlite3 not available — local cache disabled
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type DB = any;

const STALE_THRESHOLD_MS = 5 * 60 * 1000; // 5 minutes

function getCacheDir(): string {
  return join(homedir(), ".memctl");
}

export class LocalCache {
  private static fallbackMemories = new Map<
    string,
    Map<string, Record<string, unknown>>
  >();
  private static fallbackSyncMeta = new Map<string, number>();

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
    if (!Database) {
      this.lastSyncAt =
        LocalCache.fallbackSyncMeta.get(this.getFallbackScopeKey()) ?? 0;
      return;
    }

    try {
      const cacheDir = getCacheDir();
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }

      this.db = new Database(join(cacheDir, "cache.db"));
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
        .prepare(
          "SELECT last_sync_at FROM sync_meta WHERE org = ? AND project = ?",
        )
        .get(this.org, this.project) as { last_sync_at: number } | undefined;
      this.lastSyncAt = row?.last_sync_at ?? 0;
    } catch {
      this.db = null;
      this.lastSyncAt =
        LocalCache.fallbackSyncMeta.get(this.getFallbackScopeKey()) ?? 0;
    }
  }

  sync(memories: Array<Record<string, unknown>>): void {
    if (memories.length === 0) return;

    if (this.db) {
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
              typeof m.metadata === "string"
                ? m.metadata
                : JSON.stringify(m.metadata ?? null),
              typeof m.tags === "string"
                ? m.tags
                : JSON.stringify(m.tags ?? null),
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
      return;
    }

    const store = this.getFallbackStore();
    for (const m of memories) {
      const key = String(m.key ?? "");
      if (!key) continue;

      const updatedAt =
        m.updatedAt instanceof Date
          ? m.updatedAt.getTime()
          : typeof m.updatedAt === "number"
            ? m.updatedAt
            : Date.now();

      store.set(key, {
        key,
        content: String(m.content ?? ""),
        metadata:
          typeof m.metadata === "string"
            ? m.metadata
            : JSON.stringify(m.metadata ?? null),
        tags:
          typeof m.tags === "string" ? m.tags : JSON.stringify(m.tags ?? null),
        priority: Number(m.priority ?? 0),
        project: this.project,
        org: this.org,
        updated_at: updatedAt,
      });
    }

    this.lastSyncAt = Date.now();
    LocalCache.fallbackSyncMeta.set(
      this.getFallbackScopeKey(),
      this.lastSyncAt,
    );
  }

  private getFallbackScopeKey(): string {
    return `${this.org}:${this.project}`;
  }

  private getFallbackStore(): Map<string, Record<string, unknown>> {
    const scope = this.getFallbackScopeKey();
    let store = LocalCache.fallbackMemories.get(scope);
    if (!store) {
      store = new Map();
      LocalCache.fallbackMemories.set(scope, store);
    }
    return store;
  }

  get(key: string): Record<string, unknown> | null {
    if (this.db) {
      try {
        const row = this.db
          .prepare(
            "SELECT * FROM cached_memories WHERE org = ? AND project = ? AND key = ?",
          )
          .get(this.org, this.project, key) as
          | Record<string, unknown>
          | undefined;

        return row ?? null;
      } catch {
        return null;
      }
    }

    return this.getFallbackStore().get(key) ?? null;
  }

  search(query: string): Array<Record<string, unknown>> {
    if (this.db) {
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

    const q = query.toLowerCase();
    return Array.from(this.getFallbackStore().values())
      .filter((memory) => {
        const key = String(memory.key ?? "").toLowerCase();
        const content = String(memory.content ?? "").toLowerCase();
        return key.includes(q) || content.includes(q);
      })
      .sort((a, b) => Number(b.priority ?? 0) - Number(a.priority ?? 0))
      .slice(0, 50);
  }

  list(): Array<Record<string, unknown>> {
    if (this.db) {
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

    return Array.from(this.getFallbackStore().values())
      .sort((a, b) => Number(b.updated_at ?? 0) - Number(a.updated_at ?? 0))
      .slice(0, 100);
  }

  /** Try to return cached data for a given API path. */
  getByPath(path: string): unknown {
    if (
      !this.db &&
      !LocalCache.fallbackMemories.has(this.getFallbackScopeKey())
    ) {
      return null;
    }

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

  getLastSyncAt(): number {
    return this.lastSyncAt;
  }

  removeKeys(keys: string[]): void {
    if (keys.length === 0) return;

    if (this.db) {
      try {
        const del = this.db.prepare(
          "DELETE FROM cached_memories WHERE org = ? AND project = ? AND key = ?",
        );
        const tx = this.db.transaction(() => {
          for (const key of keys) {
            del.run(this.org, this.project, key);
          }
        });
        tx();
      } catch {
        // Non-critical
      }
      return;
    }

    const store = this.getFallbackStore();
    for (const key of keys) {
      store.delete(key);
    }
  }

  isStale(): boolean {
    return Date.now() - this.lastSyncAt > STALE_THRESHOLD_MS;
  }

  // ── Pending writes queue ────────────────────────────────────

  queueWrite(operation: {
    method: string;
    path: string;
    body?: unknown;
  }): void {
    try {
      const cacheDir = getCacheDir();
      if (!existsSync(cacheDir)) {
        mkdirSync(cacheDir, { recursive: true });
      }

      const pendingPath = join(cacheDir, "pending-writes.json");
      let pending: Array<{ method: string; path: string; body?: unknown }> = [];
      if (existsSync(pendingPath)) {
        pending = JSON.parse(readFileSync(pendingPath, "utf-8"));
      }
      pending.push(operation);
      writeFileSync(pendingPath, JSON.stringify(pending, null, 2));
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
      const pendingPath = join(getCacheDir(), "pending-writes.json");
      if (existsSync(pendingPath)) {
        return JSON.parse(readFileSync(pendingPath, "utf-8"));
      }
    } catch {
      // Corrupted file — ignore
    }
    return [];
  }

  clearPendingWrites(): void {
    try {
      const pendingPath = join(getCacheDir(), "pending-writes.json");
      if (existsSync(pendingPath)) {
        writeFileSync(pendingPath, "[]");
      }
    } catch {
      // Non-critical
    }
  }
}
