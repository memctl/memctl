import { describe, it, expect, beforeEach, vi } from "vitest";
import { MemoryCache } from "../cache";

describe("MemoryCache", () => {
  let cache: MemoryCache;

  beforeEach(() => {
    cache = new MemoryCache(100, 50); // 100ms TTL, 50ms stale window
  });

  it("returns null for missing keys", () => {
    expect(cache.get("nonexistent")).toBeNull();
  });

  it("stores and retrieves values", () => {
    cache.set("key1", { hello: "world" });
    const result = cache.get("key1");
    expect(result).not.toBeNull();
    expect(result!.data).toEqual({ hello: "world" });
    expect(result!.stale).toBeUndefined();
  });

  it("stores and retrieves ETags", () => {
    cache.set("key1", { data: 1 }, '"abc123"');
    const result = cache.get("key1");
    expect(result!.etag).toBe('"abc123"');
  });

  it("returns stale data after TTL but within stale window", async () => {
    cache.set("key1", { data: 1 }, undefined, 10); // 10ms TTL
    await new Promise((r) => setTimeout(r, 20));
    const result = cache.get("key1");
    expect(result).not.toBeNull();
    expect(result!.stale).toBe(true);
    expect(result!.data).toEqual({ data: 1 });
  });

  it("returns null after both TTL and stale window expire", async () => {
    cache = new MemoryCache(10, 10); // 10ms TTL, 10ms stale window
    cache.set("key1", { data: 1 });
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get("key1")).toBeNull();
  });

  it("still returns ETag for expired entries via getEtag", async () => {
    cache = new MemoryCache(10, 10);
    cache.set("key1", { data: 1 }, '"etag-val"');
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get("key1")).toBeNull();
    expect(cache.getEtag("key1")).toBe('"etag-val"');
  });

  it("touch refreshes expiry", async () => {
    cache.set("key1", { data: 1 }, undefined, 50);
    await new Promise((r) => setTimeout(r, 30));
    cache.touch("key1", 100);
    await new Promise((r) => setTimeout(r, 30));
    expect(cache.get("key1")).not.toBeNull();
  });

  it("invalidates a specific key", () => {
    cache.set("key1", 1);
    cache.set("key2", 2);
    cache.invalidate("key1");
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).not.toBeNull();
  });

  it("invalidates by prefix", () => {
    cache.set("GET:/memories?q=test", 1);
    cache.set("GET:/memories/foo", 2);
    cache.set("GET:/activity-logs", 3);
    cache.invalidatePrefix("GET:/memories");
    expect(cache.get("GET:/memories?q=test")).toBeNull();
    expect(cache.get("GET:/memories/foo")).toBeNull();
    expect(cache.get("GET:/activity-logs")).not.toBeNull();
  });

  it("clears all entries", () => {
    cache.set("key1", 1);
    cache.set("key2", 2);
    cache.clear();
    expect(cache.get("key1")).toBeNull();
    expect(cache.get("key2")).toBeNull();
  });
});
