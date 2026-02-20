interface CacheEntry {
  data: unknown;
  etag?: string;
  expiry: number;
  staleUntil: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private defaultTtl: number;
  private staleTtl: number;

  constructor(defaultTtlMs = 30_000, staleTtlMs = 120_000) {
    this.defaultTtl = defaultTtlMs;
    this.staleTtl = staleTtlMs;
  }

  get(key: string): { data: unknown; etag?: string; stale?: boolean } | null {
    const entry = this.store.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now <= entry.expiry) {
      return { data: entry.data, etag: entry.etag };
    }
    // Stale but still serveable
    if (now <= entry.staleUntil) {
      return { data: entry.data, etag: entry.etag, stale: true };
    }
    // Fully expired
    return null;
  }

  /** Get the stored ETag even if the entry has expired (for revalidation). */
  getEtag(key: string): string | undefined {
    return this.store.get(key)?.etag;
  }

  set(key: string, data: unknown, etag?: string, ttlMs?: number): void {
    const ttl = ttlMs ?? this.defaultTtl;
    this.store.set(key, {
      data,
      etag,
      expiry: Date.now() + ttl,
      staleUntil: Date.now() + ttl + this.staleTtl,
    });
  }

  /** Refresh the expiry of an existing entry (e.g., after 304 revalidation). */
  touch(key: string, ttlMs?: number): void {
    const entry = this.store.get(key);
    if (entry) {
      const ttl = ttlMs ?? this.defaultTtl;
      entry.expiry = Date.now() + ttl;
      entry.staleUntil = Date.now() + ttl + this.staleTtl;
    }
  }

  invalidate(key: string): void {
    this.store.delete(key);
  }

  invalidatePrefix(prefix: string): void {
    for (const key of this.store.keys()) {
      if (key.startsWith(prefix)) {
        this.store.delete(key);
      }
    }
  }

  clear(): void {
    this.store.clear();
  }
}
