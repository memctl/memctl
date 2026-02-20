interface CacheEntry {
  data: unknown;
  etag?: string;
  expiry: number;
}

export class MemoryCache {
  private store = new Map<string, CacheEntry>();
  private defaultTtl: number;

  constructor(defaultTtlMs = 30_000) {
    this.defaultTtl = defaultTtlMs;
  }

  get(key: string): { data: unknown; etag?: string } | null {
    const entry = this.store.get(key);
    if (!entry) return null;
    if (Date.now() > entry.expiry) {
      // Expired but keep entry for ETag revalidation
      return null;
    }
    return { data: entry.data, etag: entry.etag };
  }

  /** Get the stored ETag even if the entry has expired (for revalidation). */
  getEtag(key: string): string | undefined {
    return this.store.get(key)?.etag;
  }

  set(key: string, data: unknown, etag?: string, ttlMs?: number): void {
    this.store.set(key, {
      data,
      etag,
      expiry: Date.now() + (ttlMs ?? this.defaultTtl),
    });
  }

  /** Refresh the expiry of an existing entry (e.g., after 304 revalidation). */
  touch(key: string, ttlMs?: number): void {
    const entry = this.store.get(key);
    if (entry) {
      entry.expiry = Date.now() + (ttlMs ?? this.defaultTtl);
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
